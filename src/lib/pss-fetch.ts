import fs from "node:fs";
import path from "node:path";
import tls from "node:tls";
import {
  Agent,
  fetch as undiciFetch,
  type RequestInit as UndiciRequestInit,
} from "undici";

import { recordPssCall } from "@/lib/pss-api-log";

/** Hostname for PSS / card APIs that require the corporate CA (`certs/pss.crt`). */
const PSS_HOST = process.env.PSS_HOST ?? "";

let cachedAgent: Agent | null | undefined;

function getPssTlsAgent(): Agent | null {
  if (cachedAgent !== undefined) return cachedAgent;

  const certPath =
    process.env.PSS_CA_CERT_PATH ??
    path.join(process.cwd(), "certs", "pss.crt");

  if (!fs.existsSync(certPath)) {
    cachedAgent = null;
    return null;
  }

  try {
    const extra = fs.readFileSync(certPath);
    const ca = Buffer.concat([
      Buffer.from(tls.rootCertificates.join("\n") + "\n"),
      extra,
    ]);

    cachedAgent = new Agent({
      connect: {
        rejectUnauthorized: true,
        ca,
      },
    });
  } catch {
    cachedAgent = null;
  }

  return cachedAgent;
}

export function isPssBackendUrl(urlString: string): boolean {
  try {
    return new URL(urlString).hostname === PSS_HOST;
  } catch {
    return false;
  }
}

/**
 * Same as global `fetch`, but for `http(s)://172.16.40.1/...` uses TLS settings
 * from `certs/pss.crt` (or `PSS_CA_CERT_PATH`) when the URL uses HTTPS.
 */
export async function fetchPss(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const agent = getPssTlsAgent();
  const startedAt = Date.now();

  // Log every call made through this function, not only those matching
  // PSS_HOST. This is the PSS boundary by construction - each of its callers is
  // a PSS service - whereas PSS_HOST only decides which TLS settings apply, and
  // is empty in environments where the corporate CA is not installed. Keying
  // the audit trail off it would silently log nothing in exactly those
  // environments.
  const record = (response?: Response, error?: unknown) =>
    recordPssCall({
      url,
      method: init?.method ?? "GET",
      requestHeaders: init?.headers,
      requestBody: init?.body,
      startedAt,
      response,
      error,
    });

  const useAgent = isPssBackendUrl(url) && agent;

  try {
    let response: Response;

    if (useAgent) {
      const { next: _omitNext, ...rest } = (init ?? {}) as RequestInit & {
        next?: unknown;
      };

      response = (await undiciFetch(url, {
        ...rest,
        dispatcher: agent,
      } as UndiciRequestInit)) as unknown as Response;
    } else {
      response = await fetch(url, init);
    }

    await record(response);
    return response;
  } catch (error) {
    // Record the failure, then rethrow untouched: callers already handle
    // transport errors and must keep seeing the original.
    await record(undefined, error);
    throw error;
  }
}

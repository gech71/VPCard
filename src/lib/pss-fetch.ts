import fs from "node:fs";
import path from "node:path";
import tls from "node:tls";
import {
  Agent,
  fetch as undiciFetch,
  type RequestInit as UndiciRequestInit,
} from "undici";

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

  if (!isPssBackendUrl(url) || !agent) {
    return fetch(url, init);
  }

  const { next: _omitNext, ...rest } = (init ?? {}) as RequestInit & {
    next?: unknown;
  };

  const res = await undiciFetch(url, {
    ...rest,
    dispatcher: agent,
  } as UndiciRequestInit);
  return res as unknown as Response;
}

import prisma from "@/lib/prisma";
import {
  extractCorrelationId,
  redactBody,
  redactHeaders,
  redactUrl,
  serviceNameFromUrl,
} from "@/lib/pss-redact";

/**
 * Records one PSS API exchange for the audit screen.
 *
 * Two rules govern everything here:
 *
 *  1. Logging must never break the call it observes. Every path is wrapped, and
 *     a failure to record is swallowed - an integration that goes down because
 *     its own audit trail failed would be a worse outcome than a missing row.
 *  2. Nothing is written before it has been through the redactor. See
 *     lib/pss-redact.ts; the secret never reaches the table in the first place.
 */

type RecordArgs = {
  url: string;
  method: string;
  requestHeaders?: HeadersInit;
  requestBody?: BodyInit | null;
  startedAt: number;
  /** Present when the exchange completed, whatever the status code. */
  response?: Response;
  /** Present when the request never produced a response at all. */
  error?: unknown;
};

/** Bodies arrive as strings for every current PSS caller; be tolerant anyway. */
function bodyToText(body: BodyInit | null | undefined): string | null {
  if (body == null) return null;
  if (typeof body === "string") return body;
  if (body instanceof URLSearchParams) return body.toString();
  // FormData, Blob, streams: not worth reconstructing, and not used by PSS.
  return null;
}

function headersToRecord(init: HeadersInit | undefined): Record<string, string> | null {
  if (!init) return null;
  try {
    return Object.fromEntries(new Headers(init).entries());
  } catch {
    return null;
  }
}

function errorMessageOf(error: unknown): string {
  if (error instanceof Error) {
    // Node wraps connection failures; the cause is usually the useful half.
    const cause = (error as { cause?: unknown }).cause;
    if (cause instanceof Error && cause.message) {
      return `${error.message}: ${cause.message}`;
    }
    return error.message;
  }
  return String(error);
}

export async function recordPssCall(args: RecordArgs): Promise<void> {
  try {
    const durationMs = Date.now() - args.startedAt;

    const requestHeaders = redactHeaders(headersToRecord(args.requestHeaders));
    const requestBody = redactBody(bodyToText(args.requestBody));

    let statusCode: number | null = null;
    let success = false;
    let responseHeaders: Record<string, string> | null = null;
    let responseBody: unknown = null;
    let errorMessage: string | null = null;

    if (args.response) {
      statusCode = args.response.status;
      success = args.response.ok;
      responseHeaders = redactHeaders(args.response.headers);

      // The caller still needs the body, so read a clone rather than the
      // original - clone() tees the stream, leaving the caller's copy intact.
      try {
        responseBody = redactBody(await args.response.clone().text());
      } catch {
        responseBody = null;
      }

      if (!success) {
        errorMessage = `HTTP ${args.response.status} ${args.response.statusText}`.trim();
      }
    } else {
      errorMessage = errorMessageOf(args.error);
    }

    await prisma.pssApiLog.create({
      data: {
        serviceName: serviceNameFromUrl(args.url),
        endpoint: redactUrl(args.url),
        method: args.method.toUpperCase(),
        environment:
          process.env.PSS_ENVIRONMENT ?? process.env.NODE_ENV ?? null,
        statusCode,
        success,
        durationMs,
        correlationId: extractCorrelationId(
          responseHeaders ?? requestHeaders,
          responseBody,
          requestBody,
        ),
        requestHeaders: requestHeaders ?? undefined,
        requestBody: (requestBody as never) ?? undefined,
        responseHeaders: responseHeaders ?? undefined,
        responseBody: (responseBody as never) ?? undefined,
        errorMessage,
      },
    });
  } catch (loggingError) {
    // Deliberately terminal. See rule 1 above.
    console.error("Failed to record PSS API call:", loggingError);
  }
}

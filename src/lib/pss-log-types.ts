/**
 * Shapes shared between the PSS API audit page and its endpoints.
 *
 * Two types rather than one, because the list and the detail views genuinely
 * differ: the list endpoint omits payloads so a page of results stays small,
 * and the detail endpoint adds them for one record at a time. Modelling that
 * split here keeps the table from assuming it has payloads it was never sent.
 */

export type PssApiLogRow = {
  id: string;
  createdAt: string;
  serviceName: string;
  endpoint: string;
  method: string;
  environment: string | null;
  statusCode: number | null;
  success: boolean;
  durationMs: number;
  correlationId: string | null;
  errorMessage: string | null;
};

export type PssApiLogDetail = PssApiLogRow & {
  requestHeaders: unknown;
  requestBody: unknown;
  responseHeaders: unknown;
  responseBody: unknown;
};

export type PssApiLogSummary = {
  total: number;
  successes: number;
  failures: number;
  avgDurationMs: number;
};

export type PssApiLogListResponse = {
  logs: PssApiLogRow[];
  total: number;
  summary: PssApiLogSummary;
  services: string[];
};

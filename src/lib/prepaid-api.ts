const PREPAID_API_URL = process.env.PREPAID_API_URL;
const PREPAID_API_USER = process.env.PREPAID_API_USER;
const PREPAID_API_PASS = process.env.PREPAID_API_PASS;

export async function fetchCustInfoByAccount(accountNumber: string) {
  if (!PREPAID_API_URL || !PREPAID_API_USER || !PREPAID_API_PASS) {
    throw new Error("Prepaid API configuration missing");
  }

  const response = await fetch(`${PREPAID_API_URL}/prepaid/cust-info-by-acct`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${PREPAID_API_USER}:${PREPAID_API_PASS}`).toString("base64")}`,
    },
    body: JSON.stringify({ accountNumber }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to fetch customer info: ${response.status} - ${errorText}`,
    );
  }

  return response.json() as Promise<unknown>;
}

export function getCustDetailFromResponse(data: unknown): Record<string, unknown> {
  if (data && typeof data === "object" && "detail" in data) {
    const detail = (data as { detail: unknown }).detail;
    if (detail && typeof detail === "object" && !Array.isArray(detail)) {
      return detail as Record<string, unknown>;
    }
  }
  return (typeof data === "object" && data !== null
    ? data
    : {}) as Record<string, unknown>;
}

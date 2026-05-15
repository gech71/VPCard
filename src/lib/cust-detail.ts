export function extractCustomerIdFromCustDetail(
  detail: Record<string, unknown> | null | undefined,
): string | undefined {
  if (!detail || typeof detail !== "object") return undefined;
  const raw =
    detail.CustomerId ||
    detail.customerId ||
    detail.customerID ||
    detail.id;
  return raw != null && String(raw).trim() ? String(raw).trim() : undefined;
}

/** Customer id on get-accounts rows / envelope (no generic `id` field). */
export function extractCustomerIdFromAccountSource(
  source: Record<string, unknown> | null | undefined,
): string | undefined {
  if (!source || typeof source !== "object") return undefined;
  const raw =
    source.CustomerId || source.customerId || source.customerID;
  return raw != null && String(raw).trim() ? String(raw).trim() : undefined;
}

/**
 * Map prepaid cust-info-by-acct `detail` fields into values used for PSS card creation.
 * Gender: MALE -> "1", FEMALE -> "3" (PSS codes).
 * Branch from `Branch`, title from `Title` as returned by the API.
 */
export function extractPssFieldsFromCustDetail(
  detail: Record<string, unknown> | null | undefined,
) {
  const safe = detail && typeof detail === "object" ? detail : {};

  const branchRaw = safe.Branch ?? safe.branch;
  const branchcode =
    branchRaw !== null && branchRaw !== undefined && branchRaw !== ""
      ? String(branchRaw)
      : "";

  const genderRaw = String(safe.Gender ?? safe.gender ?? "").toUpperCase();
  let gender = "M";
  if (
    genderRaw === "FEMALE" ||
    genderRaw === "F" ||
    genderRaw.includes("FEMALE")
  ) {
    gender = "F";
  } else if (
    genderRaw === "MALE" ||
    genderRaw === "M" ||
    genderRaw.includes("MALE")
  ) {
    gender = "M";
  }

  const title = gender === "M" ? "1" : "3";

  return { branchcode, gender, title };
}

import prisma from "@/lib/prisma";

/**
 * Retrieves the PSS customer ID for a given NIB customer ID.
 * If no mapping exists, returns the NIB customer ID itself (fallback for newly created cards).
 */
export async function getPssCustomerId(nibCusId: string): Promise<string> {
  if (!nibCusId) {
    throw new Error("NIB customer ID is required");
  }

  const mapping = await prisma.customerIdMapping.findUnique({
    where: { nibCusId },
  });

  // If mapping exists, return the PSS customer ID
  if (mapping) {
    return mapping.pssCusId;
  }

  // Fallback: return NIB customer ID itself (for newly created cards)
  return nibCusId;
}

/**
 * Stores or updates a customer ID mapping.
 * For newly created cards, both nibCusId and pssCusId are initially the same.
 */
export async function setCustomerIdMapping(
  nibCusId: string,
  pssCusId: string,
): Promise<void> {
  if (!nibCusId || !pssCusId) {
    throw new Error("Both NIB and PSS customer IDs are required");
  }

  await prisma.customerIdMapping.upsert({
    where: { nibCusId },
    create: {
      nibCusId,
      pssCusId,
    },
    update: {
      pssCusId,
    },
  });
}

/**
 * Retrieves the NIB customer ID for a given PSS customer ID.
 * Useful for reverse lookups if needed.
 */
export async function getNibCustomerIdByPssCusId(
  pssCusId: string,
): Promise<string | null> {
  if (!pssCusId) {
    return null;
  }

  const mapping = await prisma.customerIdMapping.findFirst({
    where: { pssCusId },
  });

  return mapping?.nibCusId || null;
}

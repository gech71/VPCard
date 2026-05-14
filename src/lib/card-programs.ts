import prisma from "@/lib/prisma";

export type CardProgramAudience = "maker" | "self";

export async function assertCardProgramAllowed(
  code: string,
  audience: CardProgramAudience,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const program = await prisma.cardProgram.findUnique({
    where: { code },
  });

  if (!program) {
    return { ok: false, error: "Unknown card program code." };
  }

  if (audience === "maker" && !program.enabledForMaker) {
    return { ok: false, error: "This card program is not available for maker requests." };
  }

  if (audience === "self" && !program.enabledForSelf) {
    return {
      ok: false,
      error: "This card program is not available for self-initiated requests.",
    };
  }

  return { ok: true };
}

export async function getCardProgramsForAudience(audience: CardProgramAudience) {
  const where =
    audience === "maker"
      ? { enabledForMaker: true }
      : { enabledForSelf: true };

  return prisma.cardProgram.findMany({
    where,
    orderBy: { code: "asc" },
    select: {
      code: true,
      name: true,
      bin: true,
    },
  });
}

export function defaultPrepaidProgram(programPrepaid: string | null | undefined) {
  return (
    programPrepaid ||
    process.env.DEFAULT_PREPAID_PROGRAM ||
    "1012500"
  );
}

export function defaultLegacyCardProgramCode() {
  return process.env.DEFAULT_CARD_PROGRAM_CODE || "32141";
}

import bcrypt from "bcryptjs";

import prisma from "@/lib/prisma";

/**
 * Password history enforcement (VA-016).
 *
 * Every path that sets a password routes through here, so a reset link cannot
 * become a way round a rule the change form enforces - the same divergence that
 * produced VA-014.
 */

/**
 * How many previous passwords are remembered and refused.
 *
 * PCI DSS 8.3.7 requires that a new password not match any of the last four.
 * Five is kept here so the control still holds if one entry is ever lost to a
 * failed write, and because the cost of the extra comparison is paid only on a
 * password change.
 */
export const PASSWORD_HISTORY_DEPTH = 5;

/**
 * True when `newPassword` matches the account's current password or any of the
 * last PASSWORD_HISTORY_DEPTH it has used.
 *
 * bcrypt hashes are salted, so there is no way to look a password up - each
 * stored hash has to be compared in turn. That makes this deliberately slow:
 * up to six comparisons at cost 12, roughly a second in the worst case. It runs
 * only when someone changes a password, which is rare, and it short-circuits on
 * the first match.
 */
export async function isPasswordPreviouslyUsed(
  userId: string,
  newPassword: string,
  currentHash?: string | null,
): Promise<boolean> {
  if (currentHash && (await bcrypt.compare(newPassword, currentHash))) {
    return true;
  }

  const history = await prisma.passwordHistory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: PASSWORD_HISTORY_DEPTH,
    select: { passwordHash: true },
  });

  for (const entry of history) {
    if (await bcrypt.compare(newPassword, entry.passwordHash)) {
      return true;
    }
  }

  return false;
}

/**
 * The write that records a password being retired.
 *
 * Returns the unexecuted Prisma promise rather than awaiting it, so callers can
 * pass it into the same $transaction that rotates the password. The history
 * entry and the rotation then commit together: a password that was never
 * actually replaced must not be recorded as used, and one that was must never
 * be forgotten.
 */
export function recordRetiredPassword(userId: string, retiredHash: string) {
  return prisma.passwordHistory.create({
    data: { userId, passwordHash: retiredHash },
  });
}

/**
 * Drops entries past the retained depth.
 *
 * Best-effort and deliberately outside the rotation transaction - a history
 * that is briefly one entry too long is harmless, whereas a failed cleanup
 * that rolled back a completed password change would not be.
 */
export async function trimPasswordHistory(userId: string): Promise<void> {
  try {
    const keep = await prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: PASSWORD_HISTORY_DEPTH,
      select: { id: true },
    });

    await prisma.passwordHistory.deleteMany({
      where: { userId, id: { notIn: keep.map((entry) => entry.id) } },
    });
  } catch (error) {
    console.error("Failed to trim password history:", error);
  }
}

/** One wording for both paths, so the two forms cannot drift apart. */
export const PASSWORD_REUSE_MESSAGE =
  `You have used this password before. Choose one you have not used in your last ${PASSWORD_HISTORY_DEPTH} passwords.`;

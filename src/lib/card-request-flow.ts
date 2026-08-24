import type { TermsStatus } from "@/components/terms-agreement";

/**
 * The order of the Guest card-request flow: agree to the terms, then pay, then
 * fill in the request.
 *
 * Kept out of the component so the ordering is one pure function that can be
 * reasoned about and tested, rather than a chain of ternaries in JSX.
 */

export type CardRequestStage =
  | "loading"
  | "blocked"
  | "terms"
  | "payment"
  | "details";

/** Why this Guest cannot make a request at all, if they cannot. */
export type CardRequestBlocker = "pending" | "disabled" | "noPrograms" | null;

export function resolveBlocker(input: {
  loadingUser: boolean;
  hasPendingRequest: boolean;
  allowSelfRequest: boolean;
  cardProgramCount: number;
}): CardRequestBlocker {
  if (input.loadingUser) return null;
  if (input.hasPendingRequest) return "pending";
  if (!input.allowSelfRequest) return "disabled";
  if (input.cardProgramCount === 0) return "noPrograms";
  return null;
}

export function resolveStage(input: {
  feeLoading: boolean;
  loadingUser: boolean;
  blocker: CardRequestBlocker;
  termsStatus: TermsStatus;
  termsConfirmed: boolean;
  paymentRequired: boolean;
  paymentTransactionId: string | null;
}): CardRequestStage {
  if (input.feeLoading || input.loadingUser) return "loading";

  // Anything that makes the request impossible comes before either gate.
  // Asking someone to accept terms and hand over a fee, only to tell them
  // afterwards that they already have a request pending, takes real money for
  // something that was never going to be submittable.
  if (input.blocker) return "blocked";

  // "none" means nothing is published, so there is nothing to agree to and the
  // step is skipped. "failed" means we could not find out - which must hold the
  // flow rather than wave it through a gate that was never opened.
  const termsCleared =
    input.termsStatus === "none" ||
    (input.termsStatus === "ready" && input.termsConfirmed);

  if (!termsCleared) return "terms";

  if (input.paymentRequired && !input.paymentTransactionId) return "payment";

  return "details";
}

/** The steps this particular Guest will actually walk through. */
export function resolveSteps(input: {
  termsStatus: TermsStatus;
  paymentRequired: boolean;
}): { key: CardRequestStage; label: string }[] {
  return [
    ...(input.termsStatus === "ready"
      ? [{ key: "terms" as const, label: "Terms" }]
      : []),
    ...(input.paymentRequired
      ? [{ key: "payment" as const, label: "Payment" }]
      : []),
    { key: "details" as const, label: "Your details" },
  ];
}

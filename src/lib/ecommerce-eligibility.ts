/**
 * Eligibility rules for e-commerce activation.
 *
 * Activation is a separate step from card approval: approval creates the card at
 * PSS and leaves it deactivated, and a checker activates it explicitly later.
 * Kept in one place so the list endpoint, the activation endpoint and the UI all
 * agree on what "eligible" means.
 */

export type EcommerceActivationState =
  | "ACTIVATED"
  | "ELIGIBLE"
  | "AWAITING_APPROVAL"
  | "NOT_APPLICABLE"
  | "MISSING_CARD";

export type EcommerceEligibilityInput = {
  status: string;
  pan: string | null;
  ecommerceActivated: boolean;
};

export function getEcommerceActivationState(
  request: EcommerceEligibilityInput,
): EcommerceActivationState {
  if (request.ecommerceActivated) return "ACTIVATED";
  if (request.status === "PENDING") return "AWAITING_APPROVAL";
  if (request.status !== "APPROVED") return "NOT_APPLICABLE";
  // Approved but PSS never returned a card number - nothing to activate.
  if (!request.pan) return "MISSING_CARD";
  return "ELIGIBLE";
}

export function isEligibleForEcommerceActivation(
  request: EcommerceEligibilityInput,
): boolean {
  return getEcommerceActivationState(request) === "ELIGIBLE";
}

/** Human-readable reason shown in the UI when a card cannot be activated. */
export const ACTIVATION_STATE_LABEL: Record<EcommerceActivationState, string> = {
  ACTIVATED: "E-commerce active",
  ELIGIBLE: "Ready to activate",
  AWAITING_APPROVAL: "Awaiting card approval",
  NOT_APPLICABLE: "Not applicable",
  MISSING_CARD: "No card number on record",
};

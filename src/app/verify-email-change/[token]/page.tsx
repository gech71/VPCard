import { inspectEmailChangeToken } from "@/app/lib/account-actions";
import AuthShell from "@/components/auth-shell";
import ConfirmEmailChangeForm from "./ConfirmEmailChangeForm";

export default async function VerifyEmailChangePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tokenState = await inspectEmailChangeToken(token);

  // Every visual state lives in the form, including the failure panels. Next
  // re-renders this route once the confirm action completes, and confirming is
  // exactly what consumes the token - so choosing the subtree here would swap
  // the form for "already used" at the moment the change actually succeeded.
  return (
    <AuthShell
      title="Confirm email change"
      description="Verify this address to finish updating your account"
    >
      <ConfirmEmailChangeForm token={token} tokenState={tokenState} />
    </AuthShell>
  );
}

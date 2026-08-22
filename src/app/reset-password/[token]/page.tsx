import { validateResetToken } from "@/app/lib/auth-actions";
import AuthShell from "@/components/auth-shell";
import ResetPasswordForm from "./ResetPasswordForm";

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = await params;
  const token = resolvedParams.token;
  const isValidToken = await validateResetToken(token);

  // The form renders every state, including the invalid-link one, rather than
  // this page choosing between two different subtrees. Next re-renders the
  // route once the action completes, and a successful reset consumes the token
  // - so deciding here would replace the form (and the success message it just
  // produced) with "invalid or expired" at the exact moment it worked.
  return (
    <AuthShell title="New password" description="Enter your new password below">
      <ResetPasswordForm token={token} isValidToken={isValidToken} />
    </AuthShell>
  );
}

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, UserX } from "lucide-react";

import { inspectEmailChangeToken } from "@/app/lib/account-actions";
import AuthShell from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import ConfirmEmailChangeForm from "./ConfirmEmailChangeForm";

/** One panel per failure state, so the reason a link did not work is explicit. */
function LinkProblem({
  icon: Icon,
  tone,
  title,
  description,
}: {
  icon: typeof AlertTriangle;
  tone: "danger" | "warning";
  title: string;
  description: string;
}) {
  return (
    <div className="flex animate-scale-in flex-col items-center gap-4 text-center">
      <span
        className={
          tone === "danger"
            ? "flex h-12 w-12 items-center justify-center rounded-full bg-destructive-muted text-destructive"
            : "flex h-12 w-12 items-center justify-center rounded-full bg-warning-muted text-warning"
        }
      >
        <Icon className="h-6 w-6" />
      </span>
      <div className="space-y-1">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      <Button asChild variant="outline" className="w-full">
        <Link href="/login">Return to login</Link>
      </Button>
    </div>
  );
}

export default async function VerifyEmailChangePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await inspectEmailChangeToken(token);

  return (
    <AuthShell
      title="Confirm email change"
      description="Verify this address to finish updating your account"
    >
      {result.status === "VALID" ? (
        <ConfirmEmailChangeForm
          token={token}
          currentEmail={result.currentEmail}
          newEmail={result.newEmail}
        />
      ) : result.status === "EXPIRED" ? (
        <LinkProblem
          icon={Clock}
          tone="warning"
          title="This link has expired"
          description="Verification links are valid for one hour. Sign in and request a new one from Settings to try again."
        />
      ) : result.status === "USED" ? (
        <LinkProblem
          icon={CheckCircle2}
          tone="warning"
          title="This link has already been used"
          description="Your email address may already have been changed. Try signing in with the new address, or request a new link from Settings."
        />
      ) : result.status === "CONFLICT" ? (
        <LinkProblem
          icon={UserX}
          tone="danger"
          title="Address no longer available"
          description="That email address has since been registered to another user, so it can no longer be used for this account."
        />
      ) : (
        <LinkProblem
          icon={AlertTriangle}
          tone="danger"
          title="Invalid verification link"
          description="This email verification link is not recognised. Check that you opened the most recent link, or request a new one from Settings."
        />
      )}
    </AuthShell>
  );
}

"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  UserX,
} from "lucide-react";

import {
  confirmEmailChangeAction,
  type EmailChangeTokenState,
} from "@/app/lib/account-actions";
import { Button } from "@/components/ui/button";

type ConfirmEmailChangeFormProps = {
  token: string;
  /** The server's reading of the link as of the last render of this route. */
  tokenState: EmailChangeTokenState;
};

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

export default function ConfirmEmailChangeForm({
  token,
  tokenState,
}: ConfirmEmailChangeFormProps) {
  const [state, formAction, isPending] = useActionState(
    confirmEmailChangeAction,
    null,
  );

  // Success is checked before the token state, and deliberately so: confirming
  // is what consumes the link, so a spent token here means it worked.
  if (state?.success) {
    return (
      <div className="flex animate-scale-in flex-col items-center gap-4 text-center">
        <span className="flex h-12 w-12 animate-check-pop items-center justify-center rounded-full bg-success-muted text-success">
          <CheckCircle2 className="h-6 w-6" />
        </span>
        <div className="space-y-1">
          <p className="font-semibold text-foreground">Email address updated</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Your account email is now{" "}
            <span className="font-medium text-foreground">
              {state.newEmail}
            </span>
            . Use it to sign in from now on.
          </p>
        </div>
        {state.sessionRefreshed ? (
          <Button asChild className="w-full">
            <Link href="/admin/settings">
              Back to Settings
              <ArrowRight />
            </Link>
          </Button>
        ) : (
          <Button asChild className="w-full">
            <Link href="/login">Go to login</Link>
          </Button>
        )}
      </div>
    );
  }

  if (tokenState.status === "EXPIRED") {
    return (
      <LinkProblem
        icon={Clock}
        tone="warning"
        title="This link has expired"
        description="Verification links are valid for one hour. Sign in and request a new one from Settings to try again."
      />
    );
  }

  if (tokenState.status === "USED") {
    return (
      <LinkProblem
        icon={CheckCircle2}
        tone="warning"
        title="This link has already been used"
        description="Your email address may already have been changed. Try signing in with the new address, or request a new link from Settings."
      />
    );
  }

  if (tokenState.status === "CONFLICT") {
    return (
      <LinkProblem
        icon={UserX}
        tone="danger"
        title="Address no longer available"
        description="That email address has since been registered to another user, so it can no longer be used for this account."
      />
    );
  }

  if (tokenState.status !== "VALID") {
    return (
      <LinkProblem
        icon={AlertTriangle}
        tone="danger"
        title="Invalid verification link"
        description="This email verification link is not recognised. Check that you opened the most recent link, or request a new one from Settings."
      />
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="token" value={token} />

      <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Current address
          </p>
          <p className="break-all text-sm text-muted-foreground line-through">
            {tokenState.currentEmail}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            New address
          </p>
          <p className="flex items-start gap-2 break-all text-sm font-semibold text-foreground">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            {tokenState.newEmail}
          </p>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">
        Confirming updates the account immediately. Sign-in and all future
        notifications will use the new address.
      </p>

      {state?.error && (
        <p className="rounded-md border border-destructive/25 bg-destructive-muted px-3 py-2 text-sm font-medium text-destructive-muted-foreground">
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="animate-spin" />
            Confirming&hellip;
          </>
        ) : (
          "Confirm email change"
        )}
      </Button>
    </form>
  );
}

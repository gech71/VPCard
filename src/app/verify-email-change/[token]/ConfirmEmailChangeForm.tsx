"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Loader2, Mail } from "lucide-react";

import { confirmEmailChangeAction } from "@/app/lib/account-actions";
import { Button } from "@/components/ui/button";

type ConfirmEmailChangeFormProps = {
  token: string;
  currentEmail: string;
  newEmail: string;
};

export default function ConfirmEmailChangeForm({
  token,
  currentEmail,
  newEmail,
}: ConfirmEmailChangeFormProps) {
  const [state, formAction, isPending] = useActionState(
    confirmEmailChangeAction,
    null,
  );

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
            <Link href="/admin">
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

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="token" value={token} />

      <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Current address
          </p>
          <p className="break-all text-sm text-muted-foreground line-through">
            {currentEmail}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            New address
          </p>
          <p className="flex items-start gap-2 break-all text-sm font-semibold text-foreground">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            {newEmail}
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

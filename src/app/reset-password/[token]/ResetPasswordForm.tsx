"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2, Lock } from "lucide-react";

import { resetPasswordAction } from "@/app/lib/auth-actions";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

type ResetPasswordFormProps = {
  token: string;
  /** The server's verdict on the link as of the last render of this route. */
  isValidToken: boolean;
};

export default function ResetPasswordForm({
  token,
  isValidToken,
}: ResetPasswordFormProps) {
  const [state, formAction, isPending] = useActionState(resetPasswordAction, null);

  // Success is checked before the token, and deliberately so: finishing the
  // reset is what kills the link, so a consumed token here means it worked.
  if (state?.success) {
    return (
      <div className="flex animate-scale-in flex-col items-center gap-4 text-center">
        <span className="flex h-12 w-12 animate-check-pop items-center justify-center rounded-full bg-success-muted text-success">
          <CheckCircle2 className="h-6 w-6" />
        </span>
        <div className="space-y-1">
          <p className="font-semibold text-foreground">
            Password reset successfully
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Your password has been changed. You can now log in with your new
            credentials.
          </p>
        </div>
        <Button asChild className="w-full">
          <Link href="/login">Go to login</Link>
        </Button>
      </div>
    );
  }

  if (!isValidToken) {
    return (
      <div className="flex animate-scale-in flex-col items-center gap-4 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive-muted text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </span>
        <div className="space-y-1">
          <p className="font-semibold text-foreground">
            Invalid or expired link
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            This password reset link is invalid, has expired, or has already
            been used. If you have already set a new password, sign in with it.
          </p>
        </div>
        <div className="grid w-full gap-2">
          <Button asChild className="w-full">
            <Link href="/forgot-password">Request a new link</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Go to login</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="token" value={token} />

      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <PasswordInput
          id="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          aria-invalid={state?.errors?.password ? true : undefined}
          aria-describedby="password-rules"
          startIcon={Lock}
          className="h-11"
          placeholder="At least 8 characters"
        />
        {/* State the policy up front — the server enforces all three rules. */}
        <p id="password-rules" className="text-xs text-muted-foreground">
          Must be at least 8 characters and include a letter and a number.
        </p>
        {state?.errors?.password && (
          <p className="text-sm font-medium text-destructive">
            {state.errors.password[0]}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          required
          minLength={8}
          autoComplete="new-password"
          aria-invalid={state?.errors?.confirmPassword ? true : undefined}
          startIcon={Lock}
          className="h-11"
          placeholder="Re-enter your new password"
        />
        {state?.errors?.confirmPassword && (
          <p className="text-sm font-medium text-destructive">
            {state.errors.confirmPassword[0]}
          </p>
        )}
      </div>

      {state?.error && (
        <p className="rounded-md border border-destructive/25 bg-destructive-muted px-3 py-2 text-sm font-medium text-destructive-muted-foreground">
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="animate-spin" />
            Resetting&hellip;
          </>
        ) : (
          "Reset password"
        )}
      </Button>
    </form>
  );
}

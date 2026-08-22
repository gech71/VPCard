"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Lock } from "lucide-react";

import { resetPasswordAction } from "@/app/lib/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(resetPasswordAction, null);

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

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="token" value={token} />

      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="password"
            id="password"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            aria-invalid={state?.errors?.password ? true : undefined}
            className="h-11 pl-9"
            placeholder="At least 8 characters"
          />
        </div>
        {state?.errors?.password && (
          <p className="text-sm font-medium text-destructive">
            {state.errors.password[0]}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            required
            minLength={8}
            autoComplete="new-password"
            aria-invalid={state?.errors?.confirmPassword ? true : undefined}
            className="h-11 pl-9"
            placeholder="Re-enter your new password"
          />
        </div>
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

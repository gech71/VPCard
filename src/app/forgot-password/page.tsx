"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";

import { requestPasswordResetAction } from "@/app/lib/auth-actions";
import AuthShell from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [state, formAction, isPending] = useActionState(requestPasswordResetAction, null);

  return (
    <AuthShell
      title="Reset password"
      description="Enter your email to request a reset link"
    >
      {state?.success ? (
        <div className="flex animate-scale-in flex-col items-center gap-4 text-center">
          <span className="flex h-12 w-12 animate-check-pop items-center justify-center rounded-full bg-success-muted text-success">
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">Request sent</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              If an account with that email exists, we have sent a reset link to
              it.
            </p>
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">
              <ArrowLeft />
              Return to login
            </Link>
          </Button>
        </div>
      ) : (
        <form action={formAction} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="email"
                id="email"
                name="email"
                required
                autoComplete="username"
                aria-invalid={state?.error ? true : undefined}
                aria-describedby={state?.error ? "email-error" : undefined}
                className="h-11 pl-9"
                placeholder="admin@vpcard.com"
              />
            </div>
            {state?.error && (
              <p id="email-error" className="text-sm font-medium text-destructive">
                {state.error}
              </p>
            )}
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="animate-spin" />
                Sending&hellip;
              </>
            ) : (
              "Send reset link"
            )}
          </Button>

          <div className="text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 transition-colors hover:text-primary/80 hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to login
            </Link>
          </div>
        </form>
      )}
    </AuthShell>
  );
}

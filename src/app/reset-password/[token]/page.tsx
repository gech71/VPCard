import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { validateResetToken } from "@/app/lib/auth-actions";
import AuthShell from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import ResetPasswordForm from "./ResetPasswordForm";

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = await params;
  const token = resolvedParams.token;
  const isValid = await validateResetToken(token);

  return (
    <AuthShell title="New password" description="Enter your new password below">
      {!isValid ? (
        <div className="flex animate-scale-in flex-col items-center gap-4 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive-muted text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </span>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">
              Invalid or expired link
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              This password reset link is invalid or has expired.
            </p>
          </div>
          <Button asChild className="w-full">
            <Link href="/forgot-password">Request a new link</Link>
          </Button>
        </div>
      ) : (
        <ResetPasswordForm token={token} />
      )}
    </AuthShell>
  );
}

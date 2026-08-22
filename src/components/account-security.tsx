"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  KeyRound,
  Loader2,
  Mail,
  MailCheck,
  Save,
  ShieldCheck,
  X,
} from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type PendingChange = {
  newEmail: string;
  expiresAt: string;
  requestedAt: string;
};

/**
 * The complexity rules enforced by validatePassword() in @/lib/jwt-auth. Listed
 * here purely so the form can show progress against them - the server remains
 * the authority and re-checks every rule.
 */
const PASSWORD_RULES = [
  { label: "At least 10 characters", test: (v: string) => v.length >= 10 },
  { label: "An uppercase letter", test: (v: string) => /[A-Z]/.test(v) },
  { label: "A lowercase letter", test: (v: string) => /[a-z]/.test(v) },
  { label: "A number", test: (v: string) => /[0-9]/.test(v) },
  {
    label: "A special character",
    test: (v: string) => /[!@#$%^&*(),.?":{}|<>]/.test(v),
  },
] as const;

function SectionIcon({ icon: Icon }: { icon: typeof Mail }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-primary-muted-foreground">
      <Icon className="h-4 w-4" />
    </span>
  );
}

export default function AccountSecurity() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [currentEmail, setCurrentEmail] = useState("");
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);

  // Email change
  const [newEmail, setNewEmail] = useState("");
  const [sendingVerification, setSendingVerification] = useState(false);
  const [cancellingChange, setCancellingChange] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    void loadAccount();
  }, []);

  async function loadAccount() {
    try {
      const res = await fetch("/api/admin/account/email");
      const data = await res.json();

      if (res.ok) {
        setCurrentEmail(data.email || "");
        setPendingChange(data.pendingChange || null);
      }
    } catch {
      /* the cards below degrade to empty state on failure */
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestEmailChange(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(null);

    const trimmed = newEmail.trim();

    if (!trimmed) {
      setEmailError("Enter the new email address.");
      return;
    }

    if (trimmed.toLowerCase() === currentEmail.toLowerCase()) {
      setEmailError("That is already your current email address.");
      return;
    }

    setSendingVerification(true);

    try {
      const res = await fetch("/api/admin/account/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail: trimmed }),
      });
      const data = await res.json();

      if (!res.ok) {
        setEmailError(data.error || "Could not start the email change.");
        toast({
          variant: "destructive",
          title: "Verification not sent",
          description: data.error || "Could not start the email change.",
        });
        return;
      }

      setPendingChange(data.pendingChange || null);
      setNewEmail("");
      toast({
        title: "Verification sent",
        description: `Open the link sent to ${trimmed} to confirm the change.`,
      });
    } catch {
      setEmailError("An unexpected error occurred. Please try again.");
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred",
      });
    } finally {
      setSendingVerification(false);
    }
  }

  async function handleCancelEmailChange() {
    setCancellingChange(true);

    try {
      const res = await fetch("/api/admin/account/email", { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Could not cancel the pending change.",
        });
        return;
      }

      setPendingChange(null);
      setEmailError(null);
      toast({
        title: "Request cancelled",
        description: "The pending email change is no longer valid.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred",
      });
    } finally {
      setCancellingChange(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    const unmetRule = PASSWORD_RULES.find((rule) => !rule.test(newPassword));

    if (unmetRule) {
      setPasswordError(`New password is missing: ${unmetRule.label.toLowerCase()}.`);
      return;
    }

    setChangingPassword(true);

    try {
      const res = await fetch("/api/admin/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setPasswordError(data.error || "Could not change the password.");
        toast({
          variant: "destructive",
          title: "Password not changed",
          description: data.error || "Could not change the password.",
        });
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({
        title: "Password changed",
        description: "Use your new password the next time you sign in.",
      });
    } catch {
      setPasswordError("An unexpected error occurred. Please try again.");
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred",
      });
    } finally {
      setChangingPassword(false);
    }
  }

  const passwordsMatch =
    confirmPassword.length > 0 && newPassword === confirmPassword;
  const passwordFormReady =
    currentPassword.length > 0 &&
    passwordsMatch &&
    PASSWORD_RULES.every((rule) => rule.test(newPassword));

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <section className="space-y-6" aria-labelledby="account-security-heading">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
        <h2
          id="account-security-heading"
          className="font-headline text-lg font-semibold tracking-tight text-foreground"
        >
          Account security
        </h2>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Email address                                                     */}
      {/* ---------------------------------------------------------------- */}
      <Card className="animate-fade-in-up">
        <CardHeader>
          <div className="flex items-center gap-3">
            <SectionIcon icon={Mail} />
            <div className="space-y-0.5">
              <CardTitle>Email address</CardTitle>
              <CardDescription>
                Change the address you sign in with. The new address must verify
                itself before anything moves.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="space-y-1 rounded-lg border border-border bg-muted/40 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Current address
            </p>
            <p className="break-all font-medium text-foreground">
              {currentEmail || "—"}
            </p>
          </div>

          {pendingChange && (
            <div className="animate-fade-in-down space-y-3 rounded-lg border border-warning/25 bg-warning-muted p-4">
              <div className="flex items-start gap-2.5">
                <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-warning-muted-foreground">
                    Waiting for verification
                  </p>
                  <p className="break-all text-sm leading-relaxed text-warning-muted-foreground">
                    A link was sent to{" "}
                    <span className="font-medium">{pendingChange.newEmail}</span>
                    . Your address changes only once that link is opened, and it
                    expires{" "}
                    {new Date(pendingChange.expiresAt).toLocaleString()}.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={cancellingChange}
                onClick={() => void handleCancelEmailChange()}
              >
                {cancellingChange ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Cancelling&hellip;
                  </>
                ) : (
                  <>
                    <X />
                    Cancel request
                  </>
                )}
              </Button>
            </div>
          )}

          <form onSubmit={handleRequestEmailChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newEmail">New email address</Label>
              <Input
                id="newEmail"
                type="email"
                autoComplete="email"
                placeholder="name@nibbank.com.et"
                value={newEmail}
                disabled={sendingVerification}
                aria-invalid={emailError ? true : undefined}
                aria-describedby={emailError ? "newEmail-error" : undefined}
                onChange={(e) => {
                  setNewEmail(e.target.value);
                  setEmailError(null);
                }}
                className="max-w-md"
              />
              {emailError ? (
                <p
                  id="newEmail-error"
                  className="text-sm font-medium text-destructive"
                >
                  {emailError}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  We send a verification link there. The change is applied only
                  after you open it.
                </p>
              )}
            </div>

            <div className="flex justify-end border-t border-border pt-4">
              <Button type="submit" disabled={sendingVerification}>
                {sendingVerification ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Sending&hellip;
                  </>
                ) : (
                  <>
                    <MailCheck />
                    Send verification link
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ---------------------------------------------------------------- */}
      {/* Password                                                          */}
      {/* ---------------------------------------------------------------- */}
      <Card className="animate-fade-in-up">
        <CardHeader>
          <div className="flex items-center gap-3">
            <SectionIcon icon={KeyRound} />
            <div className="space-y-0.5">
              <CardTitle>Password</CardTitle>
              <CardDescription>
                Change your sign-in password. Any outstanding password reset
                links are revoked once the change goes through.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-5">
            <div className="grid gap-5 md:max-w-md">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current password</Label>
                <PasswordInput
                  id="currentPassword"
                  revealLabel="current password"
                  autoComplete="current-password"
                  value={currentPassword}
                  disabled={changingPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    setPasswordError(null);
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">New password</Label>
                <PasswordInput
                  id="newPassword"
                  revealLabel="new password"
                  autoComplete="new-password"
                  aria-describedby="password-rules"
                  value={newPassword}
                  disabled={changingPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setPasswordError(null);
                  }}
                />
                <ul id="password-rules" className="space-y-1 pt-1">
                  {PASSWORD_RULES.map((rule) => {
                    const met = rule.test(newPassword);
                    return (
                      <li
                        key={rule.label}
                        className={cn(
                          "flex items-center gap-2 text-xs transition-colors",
                          met ? "text-success" : "text-muted-foreground",
                        )}
                      >
                        {met ? (
                          <Check className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <span
                            aria-hidden="true"
                            className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50"
                          />
                        )}
                        {rule.label}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm new password</Label>
                <PasswordInput
                  id="confirmPassword"
                  revealLabel="password confirmation"
                  autoComplete="new-password"
                  value={confirmPassword}
                  disabled={changingPassword}
                  aria-invalid={
                    confirmPassword.length > 0 && !passwordsMatch
                      ? true
                      : undefined
                  }
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setPasswordError(null);
                  }}
                />
                {confirmPassword.length > 0 && (
                  <p
                    className={cn(
                      "flex items-center gap-1.5 text-xs",
                      passwordsMatch ? "text-success" : "text-destructive",
                    )}
                  >
                    {passwordsMatch ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        Passwords match
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        Passwords do not match
                      </>
                    )}
                  </p>
                )}
              </div>
            </div>

            {passwordError && (
              <p className="rounded-md border border-destructive/25 bg-destructive-muted px-3 py-2 text-sm font-medium text-destructive-muted-foreground md:max-w-md">
                {passwordError}
              </p>
            )}

            <div className="flex justify-end border-t border-border pt-4">
              <Button
                type="submit"
                disabled={changingPassword || !passwordFormReady}
              >
                {changingPassword ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Updating&hellip;
                  </>
                ) : (
                  <>
                    <Save />
                    Change password
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}

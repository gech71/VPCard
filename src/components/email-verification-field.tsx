"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, BadgeCheck, Loader2, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const OTP_LENGTH = 6;

/** Matches the server's normalisation, so the two agree on what "verified" means. */
function normalise(email: string) {
  return email.trim().toLowerCase();
}

function looksLikeEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

type EmailVerificationFieldProps = {
  email: string;
  onEmailChange: (email: string) => void;
  /** The address a code has actually been confirmed for, or null. */
  verifiedEmail: string | null;
  onVerifiedEmailChange: (email: string | null) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * Email address plus the one-time code that proves the Guest can receive mail
 * at it.
 *
 * The confirmed address is held rather than a boolean, so editing the field
 * after verifying silently invalidates the proof instead of leaving a stale
 * tick beside a different address.
 */
export default function EmailVerificationField({
  email,
  onEmailChange,
  verifiedEmail,
  onVerifiedEmailChange,
  disabled,
  className,
}: EmailVerificationFieldProps) {
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const codeInput = useRef<HTMLInputElement>(null);

  const isVerified =
    verifiedEmail !== null && verifiedEmail === normalise(email);

  useEffect(() => {
    if (resendIn <= 0) return;

    const timer = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const startCooldown = useCallback((seconds: number) => {
    setResendIn(Math.max(0, Math.ceil(seconds)));
  }, []);

  async function sendCode() {
    setError(null);
    setNotice(null);
    setSending(true);

    try {
      const res = await fetch("/api/card-requests-self/email-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Could not send the verification code.");
        if (typeof data.retryAfterSeconds === "number") {
          startCooldown(data.retryAfterSeconds);
        }
        return;
      }

      setCodeSent(true);
      setCode("");
      setNotice(`We sent a ${OTP_LENGTH}-digit code to ${email.trim()}.`);
      startCooldown(data.resendAfterSeconds ?? 60);
      // The Guest's next move is always to type the code.
      window.setTimeout(() => codeInput.current?.focus(), 0);
    } catch {
      setError("Could not send the verification code. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function verifyCode() {
    setError(null);
    setNotice(null);
    setVerifying(true);

    try {
      const res = await fetch("/api/card-requests-self/email-otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "That code is not correct.");
        setCode("");
        return;
      }

      onVerifiedEmailChange(normalise(email));
      setCodeSent(false);
      setCode("");
    } catch {
      setError("Could not verify the code. Please try again.");
    } finally {
      setVerifying(false);
    }
  }

  function editAddress() {
    // Whatever was proved no longer applies to whatever they type next.
    onVerifiedEmailChange(null);
    setCodeSent(false);
    setCode("");
    setError(null);
    setNotice(null);
  }

  const canSend =
    !disabled && !sending && resendIn === 0 && looksLikeEmail(email);

  if (isVerified) {
    return (
      <div className={cn("space-y-2", className)}>
        <Label htmlFor="email">Email address</Label>
        <div className="flex items-center gap-2.5 rounded-lg border border-success/25 bg-success-muted px-3 py-2.5 text-sm text-success-muted-foreground">
          <BadgeCheck className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate font-medium">{email}</span>
          <span className="shrink-0">Verified</span>
        </div>
        <button
          type="button"
          onClick={editAddress}
          disabled={disabled}
          className="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50"
        >
          Use a different address
        </button>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor="email">
        Email address <span className="text-destructive">*</span>
      </Label>

      <div className="flex gap-2">
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            onEmailChange(e.target.value);
            // Editing the address abandons any code already in flight.
            if (codeSent) {
              setCodeSent(false);
              setCode("");
              setNotice(null);
            }
            setError(null);
          }}
          placeholder="you@example.com"
          className="h-11"
          required
          disabled={disabled || sending}
        />
        <Button
          type="button"
          variant="outline"
          className="h-11 shrink-0"
          onClick={() => void sendCode()}
          disabled={!canSend}
        >
          {sending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Mail className="h-4 w-4" />
          )}
          {resendIn > 0
            ? `${resendIn}s`
            : codeSent
              ? "Resend"
              : "Send code"}
        </Button>
      </div>

      {codeSent && (
        <div className="animate-fade-in-down space-y-2 rounded-lg border border-border bg-muted/30 p-3">
          <Label htmlFor="emailOtp" className="text-xs">
            Enter the {OTP_LENGTH}-digit code
          </Label>
          <div className="flex gap-2">
            <Input
              id="emailOtp"
              ref={codeInput}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH));
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && code.length === OTP_LENGTH) {
                  e.preventDefault();
                  void verifyCode();
                }
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              maxLength={OTP_LENGTH}
              className="h-11 font-mono text-lg tracking-[0.4em]"
              disabled={disabled || verifying}
            />
            <Button
              type="button"
              className="h-11 shrink-0"
              onClick={() => void verifyCode()}
              disabled={disabled || verifying || code.length !== OTP_LENGTH}
            >
              {verifying ? <Loader2 className="animate-spin" /> : null}
              Verify
            </Button>
          </div>
        </div>
      )}

      {notice && !error && (
        <p className="text-xs text-muted-foreground">{notice}</p>
      )}

      {error && (
        <p className="flex items-start gap-1.5 text-xs text-destructive-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}

      {!codeSent && !error && !notice && (
        <p className="text-xs text-muted-foreground">
          We will send a code here to confirm the address, then use it for card
          notifications.
        </p>
      )}
    </div>
  );
}

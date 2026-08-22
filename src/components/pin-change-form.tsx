"use client";

import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useActionState } from "react";
import { useFormStatus } from "react-dom";
import { changePin } from "@/app/actions";
import { KeyRound, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

type PinChangeFormProps = {
  cardNumber: string;
};

const initialFormState = {
  success: false,
  message: "",
  errors: {},
};

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" size="lg" disabled={pending} className="w-full">
            {pending ? (
              <>
                <Loader2 className="animate-spin" />
                Changing PIN&hellip;
              </>
            ) : (
              <>
                <KeyRound />
                Change PIN
              </>
            )}
        </Button>
    )
}

/** A single 4-digit PIN field with its inline validation message. */
function PinField({
  id,
  label,
  error,
  autoComplete,
}: {
  id: string;
  label: string;
  error?: string[];
  autoComplete: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <PasswordInput
        id={id}
        name={id}
        revealLabel="PIN"
        centered
        wrapperClassName="max-w-[12rem]"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        autoComplete={autoComplete}
        placeholder="••••"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="font-mono text-lg tracking-[0.5em]"
        required
      />
      {error && (
        <p id={`${id}-error`} className="text-sm font-medium text-destructive">
          {error[0]}
        </p>
      )}
    </div>
  );
}

export default function PinChangeForm({ cardNumber }: PinChangeFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [formState, formAction] = useActionState(changePin, initialFormState);

  useEffect(() => {
    if (formState.message) {
      toast({
        title: formState.success ? "Success" : "Error",
        description: formState.message,
        variant: formState.success ? "default" : "destructive",
      });
      if (formState.success) {
        // Redirect to dashboard after a short delay
        setTimeout(() => router.push('/'), 1500);
      }
    }
  }, [formState, toast, router]);

  return (
    <form action={formAction} className="space-y-6">
        <input type="hidden" name="pan_number" value={cardNumber} />

        <PinField
          id="old_pin"
          label="Current PIN"
          error={formState.errors?.old_pin}
          autoComplete="current-password"
        />
        <PinField
          id="new_pin"
          label="New PIN"
          error={formState.errors?.new_pin}
          autoComplete="new-password"
        />
        <PinField
          id="confirm_pin"
          label="Confirm new PIN"
          error={formState.errors?.confirm_pin}
          autoComplete="new-password"
        />

        <div className="pt-2">
            <SubmitButton />
        </div>
    </form>
  );
}


"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { changePin } from "@/app/actions";
import { Loader2 } from "lucide-react";

type PinChangeDialogProps = {
  children: React.ReactNode;
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
        <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Change PIN
        </Button>
    )
}

export default function PinChangeDialog({ children, cardNumber }: PinChangeDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [formState, formAction] = useFormState(changePin, initialFormState);

  useEffect(() => {
    if (formState.message) {
      toast({
        title: formState.success ? "Success" : "Error",
        description: formState.message,
        variant: formState.success ? "default" : "destructive",
      });
      if (formState.success) {
        setOpen(false);
      }
    }
  }, [formState, toast]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form action={formAction}>
          <input type="hidden" name="pan_number" value={cardNumber} />
          <DialogHeader>
            <DialogTitle>Change Your PIN</DialogTitle>
            <DialogDescription>
              Enter your current PIN and a new 4-digit PIN for your card.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="old_pin">
                Current PIN
              </Label>
              <Input
                id="old_pin"
                name="old_pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                className="font-mono"
                required
              />
              {formState.errors?.old_pin && <p className="text-destructive text-sm">{formState.errors.old_pin[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_pin">
                New PIN
              </Label>
              <Input
                id="new_pin"
                name="new_pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                className="font-mono"
                required
              />
               {formState.errors?.new_pin && <p className="text-destructive text-sm">{formState.errors.new_pin[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm_pin">
                Confirm PIN
              </Label>
              <Input
                id="confirm_pin"
                name="confirm_pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                className="font-mono"
                required
              />
              {formState.errors?.confirm_pin && <p className="text-destructive text-sm">{formState.errors.confirm_pin[0]}</p>}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
                <Button type="button" variant="secondary">
                Cancel
                </Button>
            </DialogClose>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
import { useState } from "react";

type PinChangeDialogProps = {
  children: React.ReactNode;
};

export default function PinChangeDialog({ children }: PinChangeDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // In a real app, add validation and an API call
    toast({
      title: "PIN Change Successful",
      description: "Your card PIN has been updated securely.",
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Change Your PIN</DialogTitle>
            <DialogDescription>
              Enter your current PIN and a new 4-digit PIN for your card.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="current-pin" className="text-right">
                Current PIN
              </Label>
              <Input
                id="current-pin"
                type="password"
                maxLength={4}
                className="col-span-3 font-mono"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-pin" className="text-right">
                New PIN
              </Label>
              <Input
                id="new-pin"
                type="password"
                maxLength={4}
                className="col-span-3 font-mono"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="confirm-pin" className="text-right">
                Confirm PIN
              </Label>
              <Input
                id="confirm-pin"
                type="password"
                maxLength={4}
                className="col-span-3 font-mono"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
                <Button type="button" variant="secondary">
                Cancel
                </Button>
            </DialogClose>
            <Button type="submit">Change PIN</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

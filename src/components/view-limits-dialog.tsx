
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
import { atmLimit, posLimit } from "@/lib/data";
import { Landmark, Store } from "lucide-react";
import { Progress } from "./ui/progress";

type ViewLimitsDialogProps = {
  children: React.ReactNode;
};

export default function ViewLimitsDialog({ children }: ViewLimitsDialogProps) {
  
  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Your Current Limits</DialogTitle>
            <DialogDescription>
              This is a summary of your transaction limits. You can edit them in the sections below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                    <Store className="h-5 w-5 text-primary" />
                    <span>POS Limit</span>
                </div>
                <Progress value={(posLimit.current / posLimit.max) * 100} className="h-2" />
                <div className="flex justify-between text-sm">
                    <span className="font-bold">{currencyFormatter.format(posLimit.current)}</span>
                    <span className="text-muted-foreground">of {currencyFormatter.format(posLimit.max)}</span>
                </div>
            </div>
             <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                    <Landmark className="h-5 w-5 text-primary" />
                    <span>ATM Limit</span>
                </div>
                <Progress value={(atmLimit.current / atmLimit.max) * 100} className="h-2" />
                <div className="flex justify-between text-sm">
                    <span className="font-bold">{currencyFormatter.format(atmLimit.current)}</span>
                    <span className="text-muted-foreground">of {currencyFormatter.format(atmLimit.max)}</span>
                </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
                <Button type="button">
                Got it
                </Button>
            </DialogClose>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

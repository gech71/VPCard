
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
import { type Limit } from "@/lib/data";
import { type LimitApiResponse } from "@/app/actions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LimitSummary from "./limit-summary";
import LimitManager from "./limit-manager";

type LimitSettingsDialogProps = {
  children: React.ReactNode;
  allLimits: LimitApiResponse[];
  posLimit: Limit;
  atmLimit: Limit;
  isLoading: boolean;
};

export default function LimitSettingsDialog({ children, allLimits, posLimit, atmLimit, isLoading }: LimitSettingsDialogProps) {
  
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Limit Settings</DialogTitle>
            <DialogDescription>
              View a summary of your limits or set a new limit for a specific transaction type.
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="summary">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="set-limit">Set Limit</TabsTrigger>
            </TabsList>
            <TabsContent value="summary">
                <LimitSummary allLimits={allLimits} isLoading={isLoading} />
            </TabsContent>
            <TabsContent value="set-limit">
                <LimitManager allLimits={allLimits} />
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Close
                </Button>
            </DialogClose>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

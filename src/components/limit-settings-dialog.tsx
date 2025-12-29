
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
import LimitManager from "./limit-manager";
import LimitSummary from "./limit-summary";

type LimitSettingsDialogProps = {
  children: React.ReactNode;
  allLimits: LimitApiResponse[];
  posLimit: Limit;
  atmLimit: Limit;
  isLoading: boolean;
};

export default function LimitSettingsDialog({ children, allLimits, posLimit, atmLimit, isLoading }: LimitSettingsDialogProps) {
  
  const atmLimits = allLimits.filter(limit => limit.channel === 'ATM CHANNEL');
  const posLimits = allLimits.filter(limit => limit.channel === 'POS CHANNEL');

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Limit Settings</DialogTitle>
            <DialogDescription>
              View and manage the transaction limits for your card.
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="atm">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="atm">ATM Channel</TabsTrigger>
                <TabsTrigger value="pos">POS Channel</TabsTrigger>
            </TabsList>
            <TabsContent value="atm">
                <LimitSummary allLimits={atmLimits} isLoading={isLoading} />
                <LimitManager allLimits={atmLimits} channel="ATM CHANNEL" />
            </TabsContent>
            <TabsContent value="pos">
                <LimitSummary allLimits={posLimits} isLoading={isLoading} />
                <LimitManager allLimits={posLimits} channel="POS CHANNEL" />
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

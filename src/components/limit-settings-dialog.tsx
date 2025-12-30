
"use client";

import React, { useState } from 'react';
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
import { ScrollArea } from "./ui/scroll-area";

type LimitSettingsDialogProps = {
  children: React.ReactNode;
  allLimits: LimitApiResponse[];
  posLimit: Limit;
  atmLimit: Limit;
  isLoading: boolean;
  onLimitUpdate: () => void;
};

export default function LimitSettingsDialog({ children, allLimits, posLimit, atmLimit, isLoading, onLimitUpdate }: LimitSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  
  const atmLimits = allLimits.filter(limit => limit.channel === 'ATM CHANNEL');
  const posLimits = allLimits.filter(limit => limit.channel === 'POS CHANNEL');

  const handleLimitUpdateAndClose = () => {
    onLimitUpdate();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Limit Settings</DialogTitle>
            <DialogDescription>
              View and manage the transaction limits for your card.
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="atm" className="flex-grow flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="atm">ATM Channel</TabsTrigger>
                <TabsTrigger value="pos">POS Channel</TabsTrigger>
            </TabsList>
            <TabsContent value="atm" className="mt-0 flex-grow overflow-hidden">
                <ScrollArea className="h-full">
                    <LimitSummary allLimits={atmLimits} isLoading={isLoading} onUpdate={handleLimitUpdateAndClose} />
                </ScrollArea>
            </TabsContent>
            <TabsContent value="pos" className="mt-0 flex-grow overflow-hidden">
                <ScrollArea className="h-full">
                    <LimitSummary allLimits={posLimits} isLoading={isLoading} onUpdate={handleLimitUpdateAndClose} />
                </ScrollArea>
            </TabsContent>
          </Tabs>
          <DialogFooter className="mt-auto pt-4 border-t">
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

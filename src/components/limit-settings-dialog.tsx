
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
import { ScrollArea } from "./ui/scroll-area";

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
      <DialogContent className="sm:max-w-xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Limit Settings</DialogTitle>
            <DialogDescription>
              View the transaction limits for your card.
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="atm" className="flex-grow flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="atm">ATM Channel</TabsTrigger>
                <TabsTrigger value="pos">POS Channel</TabsTrigger>
            </TabsList>
            <ScrollArea className="flex-grow">
                <TabsContent value="atm" className="mt-0 pt-4">
                    <LimitSummary allLimits={atmLimits} isLoading={isLoading} />
                </TabsContent>
                <TabsContent value="pos" className="mt-0 pt-4">
                    <LimitSummary allLimits={posLimits} isLoading={isLoading} />
                </TabsContent>
            </ScrollArea>
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

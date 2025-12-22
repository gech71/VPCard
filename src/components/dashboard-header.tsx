import { Wallet } from "lucide-react";

export default function DashboardHeader() {
  return (
    <header className="bg-card border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center gap-3">
          <Wallet className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold text-foreground font-headline">
            Nib Virtual Card
          </h1>
        </div>
      </div>
    </header>
  );
}

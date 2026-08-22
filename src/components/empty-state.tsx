import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  /** Optional call to action, e.g. "Clear filters". */
  action?: React.ReactNode;
  className?: string;
  /** Compact variant for use inside a table cell. */
  compact?: boolean;
};

/** Consistent "nothing here" block for tables, lists and panels. */
export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center animate-fade-in",
        compact ? "gap-2 py-8" : "gap-3 py-14",
        className
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full bg-muted text-muted-foreground",
          compact ? "h-10 w-10" : "h-14 w-14"
        )}
      >
        <Icon className={compact ? "h-5 w-5" : "h-6 w-6"} />
      </span>
      <div className="space-y-1">
        <p className="font-semibold text-foreground">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

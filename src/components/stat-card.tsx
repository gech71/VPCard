import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Tone = "brand" | "success" | "warning" | "danger" | "info" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  brand: "bg-primary-muted text-primary-muted-foreground",
  success: "bg-success-muted text-success-muted-foreground",
  warning: "bg-warning-muted text-warning-muted-foreground",
  danger: "bg-destructive-muted text-destructive-muted-foreground",
  info: "bg-info-muted text-info-muted-foreground",
  neutral: "bg-muted text-muted-foreground",
};

type StatCardProps = {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  hint?: string;
  isLoading?: boolean;
  className?: string;
};

/**
 * The single metric tile used by every dashboard and import summary.
 *
 * Label and icon sit on one line with the icon pinned right, so the tile reads
 * the same whether it is 240px or 540px wide. The hint slot always occupies a
 * line so tiles with and without one stay the same height.
 */
export default function StatCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  hint,
  isLoading = false,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 pt-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          {Icon ? (
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                TONE_CLASSES[tone]
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
          ) : null}
        </div>

        <div className="mt-3">
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <p className="text-3xl font-bold leading-none tracking-tight tabular-nums text-foreground">
              {value}
            </p>
          )}
        </div>

        {/* Reserved even when empty, to keep a row of tiles aligned. */}
        <p className="mt-1.5 h-4 truncate text-xs text-muted-foreground">
          {hint ?? ""}
        </p>
      </CardContent>
    </Card>
  );
}

import {
  CheckCircle2,
  CircleDot,
  Clock,
  ShieldAlert,
  XCircle,
} from "lucide-react";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = NonNullable<BadgeProps["variant"]>;

/**
 * One place that maps a domain status string to a visual tone, so PENDING looks
 * the same in the maker table, the checker table and the admin table.
 */
const TONES: Record<string, { tone: Tone; icon?: typeof Clock }> = {
  // Card request lifecycle
  PENDING: { tone: "warning", icon: Clock },
  APPROVED: { tone: "success", icon: CheckCircle2 },
  REJECTED: { tone: "danger", icon: XCircle },
  // Card state
  ACTIVE: { tone: "success", icon: CircleDot },
  INACTIVE: { tone: "neutral", icon: CircleDot },
  FROZEN: { tone: "info", icon: CircleDot },
  // Transactions
  COMPLETED: { tone: "success" },
  FAILED: { tone: "danger" },
  // Roles
  SUPER_ADMIN: { tone: "danger", icon: ShieldAlert },
  MAKER: { tone: "success" },
  CHECKER: { tone: "info" },
  // Import rows
  VALID: { tone: "success" },
  DUPLICATE: { tone: "warning" },
  INVALID: { tone: "danger" },
};

type StatusBadgeProps = {
  status: string | null | undefined;
  /** Force a tone when the label is not one of the known statuses. */
  tone?: Tone;
  /** Show the leading status icon. */
  withIcon?: boolean;
  /** Render the label verbatim instead of prettifying SNAKE_CASE. */
  raw?: boolean;
  className?: string;
};

function prettify(value: string) {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function StatusBadge({
  status,
  tone,
  withIcon = false,
  raw = false,
  className,
}: StatusBadgeProps) {
  if (!status) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  const key = status.toUpperCase();
  const config = TONES[key];
  const variant = tone ?? config?.tone ?? "neutral";
  const Icon = withIcon ? config?.icon : undefined;

  return (
    <Badge variant={variant} className={cn("whitespace-nowrap", className)}>
      {Icon ? <Icon className="h-3 w-3" /> : null}
      {raw ? status : prettify(status)}
    </Badge>
  );
}

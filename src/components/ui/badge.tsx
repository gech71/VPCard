import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/85",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/70",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/85",
        outline: "border-border text-foreground",
        /* Tinted variants — the default for status pills in tables and lists. */
        success:
          "border-success/20 bg-success-muted text-success-muted-foreground",
        warning:
          "border-warning/20 bg-warning-muted text-warning-muted-foreground",
        info: "border-info/20 bg-info-muted text-info-muted-foreground",
        danger:
          "border-destructive/20 bg-destructive-muted text-destructive-muted-foreground",
        brand:
          "border-primary/20 bg-primary-muted text-primary-muted-foreground",
        neutral: "border-border bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: React.ReactNode;
  /** Buttons or filters; wraps below the title on narrow screens. */
  actions?: React.ReactNode;
  className?: string;
};

/** Consistent screen title block: heading, supporting copy, and actions. */
export default function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div className="min-w-0 space-y-1">
        <h2 className="font-headline text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h2>
        {description ? (
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

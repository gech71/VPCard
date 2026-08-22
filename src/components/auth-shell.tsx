import { Wallet } from "lucide-react";

type AuthShellProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Fine print rendered under the card. */
  footer?: React.ReactNode;
};

/**
 * Shared frame for login, forgot-password and reset-password so all three
 * unauthenticated screens share one layout, brand mark and card treatment.
 */
export default function AuthShell({
  title,
  description,
  children,
  footer,
}: AuthShellProps) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 py-10">
      {/* Soft brand wash - decorative only. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_40rem_at_50%_-20%,hsl(var(--primary)/0.16),transparent_70%)]"
      />

      <div className="relative w-full max-w-md animate-fade-in-up">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
            <Wallet className="h-6 w-6" />
          </span>
          <div className="space-y-1">
            <h1 className="font-headline text-2xl font-bold tracking-tight text-foreground">
              {title}
            </h1>
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-lg sm:p-8">
          {children}
        </div>

        {footer ? (
          <div className="mt-6 text-center text-sm text-muted-foreground">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

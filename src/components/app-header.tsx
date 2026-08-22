import Link from "next/link";
import { LogOut, Wallet } from "lucide-react";

import { cn } from "@/lib/utils";

type AppHeaderProps = {
  /** Product name shown next to the brand mark. */
  title?: string;
  /** Section or screen name, shown as a secondary line. */
  subtitle?: string;
  /** Short role label rendered as a pill (e.g. "Maker"). */
  role?: string;
  /** Signed-in identity, hidden on narrow screens to protect the layout. */
  userEmail?: string;
  /** Renders the logout form. Off for unauthenticated/customer screens. */
  showLogout?: boolean;
  /** Where the brand mark links to. Omit to render it as static text. */
  homeHref?: string;
  className?: string;
  children?: React.ReactNode;
};

/**
 * The single top bar for every authenticated area (customer, maker, checker,
 * admin). Server-component safe: logout stays a plain form POST.
 */
export default function AppHeader({
  title = "NIB Prepaid Card",
  subtitle,
  role,
  userEmail,
  showLogout = false,
  homeHref,
  className,
  children,
}: AppHeaderProps) {
  const brand = (
    <span className="flex min-w-0 items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <Wallet className="h-5 w-5" />
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate font-headline text-base font-bold tracking-tight text-foreground sm:text-lg">
          {title}
        </span>
        {subtitle ? (
          <span className="truncate text-xs text-muted-foreground sm:text-sm">
            {subtitle}
          </span>
        ) : null}
      </span>
    </span>
  );

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-border bg-card/85 backdrop-blur supports-[backdrop-filter]:bg-card/70",
        className
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        {homeHref ? (
          <Link
            href={homeHref}
            className="min-w-0 rounded-md transition-opacity hover:opacity-85"
          >
            {brand}
          </Link>
        ) : (
          brand
        )}

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {children}

          {role ? (
            <span className="hidden rounded-full border border-primary/25 bg-primary-muted px-2.5 py-1 text-xs font-semibold text-primary-muted-foreground sm:inline-block">
              {role}
            </span>
          ) : null}

          {userEmail ? (
            <span
              className="hidden max-w-[16rem] truncate text-sm text-muted-foreground lg:inline-block"
              title={userEmail}
            >
              {userEmail}
            </span>
          ) : null}

          {showLogout ? (
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-xs transition-all hover:bg-accent hover:text-accent-foreground active:translate-y-px"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
                <span className="sr-only sm:hidden">Logout</span>
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </header>
  );
}

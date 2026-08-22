"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  ScrollText,
  Settings,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

const links = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "User Management", icon: Users },
  { href: "/admin/requests", label: "Card Requests", icon: CreditCard },
  { href: "/admin/audit", label: "Audit Logs", icon: ScrollText },
  { href: "/admin/customer-mapping", label: "Customer Mapping", icon: ClipboardList },
  { href: "/admin/settings", label: "Settings", icon: Settings },
] as const;

type AdminNavProps = {
  /** Optional override; defaults to the current route. */
  activePath?: string;
};

export default function AdminNav({ activePath }: AdminNavProps) {
  const pathname = usePathname();
  const current = activePath ?? pathname;

  return (
    <nav
      aria-label="Admin sections"
      className="sticky top-16 z-30 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="no-scrollbar -mb-px flex gap-1 overflow-x-auto">
          {links.map((link) => {
            const isActive = current === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group relative flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3.5 text-sm transition-colors",
                  isActive
                    ? "border-primary font-semibold text-foreground"
                    : "border-transparent font-medium text-muted-foreground hover:border-border hover:text-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 transition-colors",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground/70 group-hover:text-foreground"
                  )}
                />
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

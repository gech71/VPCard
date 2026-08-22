"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, ShoppingCart } from "lucide-react";

import { cn } from "@/lib/utils";

const links = [
  { href: "/checker", label: "Card Requests", icon: CreditCard },
  {
    href: "/checker/ecommerce-activation",
    label: "E-Commerce Activation",
    icon: ShoppingCart,
  },
] as const;

/** Section nav for the checker area - approval and activation are separate screens. */
export default function CheckerNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Checker sections"
      className="sticky top-16 z-30 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="no-scrollbar -mb-px flex gap-1 overflow-x-auto">
          {links.map((link) => {
            const isActive = pathname === link.href;
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
                    : "border-transparent font-medium text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 transition-colors",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground/70 group-hover:text-foreground",
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

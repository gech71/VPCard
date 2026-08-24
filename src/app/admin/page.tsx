import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/jwt-auth";
import prisma from "@/lib/prisma";
import {
  Activity,
  ClipboardList,
  CreditCard,
  ScrollText,
  Shield,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";

import PageHeader from "@/components/page-header";
import StatCard from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const QUICK_ACTIONS = [
  {
    href: "/admin/users",
    label: "Manage users",
    description: "Create makers and checkers, reset passwords",
    icon: Users,
  },
  {
    href: "/admin/requests",
    label: "Manage requests",
    description: "Search and export every card request",
    icon: CreditCard,
  },
  {
    href: "/admin/payments",
    label: "Payment history",
    description: "Track card request fees collected from Guests",
    icon: Wallet,
  },
  {
    href: "/admin/audit",
    label: "View audit logs",
    description: "Track user actions and system events",
    icon: ScrollText,
  },
  {
    href: "/admin/customer-mapping",
    label: "Customer mapping",
    description: "Import NIB to PSS customer ID mappings",
    icon: ClipboardList,
  },
] as const;

export default async function SuperAdminDashboard() {
  const user = await getCurrentUser();

  if (!user || user.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  // Get statistics
  const [totalUsers, makerCount, checkerCount, pendingRequests, totalRequests] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "MAKER" } }),
      prisma.user.count({ where: { role: "CHECKER" } }),
      prisma.cardRequest.count({ where: { status: "PENDING" } }),
      prisma.cardRequest.count(),
    ]);

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        title="Dashboard overview"
        description="Users, roles and card request activity across the platform."
      />

      <div className="stagger-children grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total users"
          value={totalUsers}
          icon={Users}
          tone="brand"
          hint="Across all roles"
        />
        <StatCard
          label="Makers"
          value={makerCount}
          icon={Shield}
          tone="success"
          hint="Can raise requests"
        />
        <StatCard
          label="Checkers"
          value={checkerCount}
          icon={ShieldCheck}
          tone="info"
          hint="Can approve requests"
        />
        <StatCard
          label="Pending requests"
          value={pendingRequests}
          icon={Activity}
          tone="warning"
          hint={`of ${totalRequests} total`}
        />
      </div>

      <Card className="animate-fade-in-up">
        <CardHeader>
          <CardTitle>Quick actions</CardTitle>
          <CardDescription>
            Jump straight to the most common administration tasks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group flex items-start gap-3 rounded-lg border border-border bg-card p-4 transition-all duration-200 ease-smooth hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-primary-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-foreground">
                      {action.label}
                    </span>
                    <span className="block text-sm leading-relaxed text-muted-foreground">
                      {action.description}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {pendingRequests > 0 ? (
        <Card className="animate-fade-in-up border-warning/25 bg-warning-muted/40">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning-muted text-warning-muted-foreground">
                <Activity className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-foreground">
                  {pendingRequests} request{pendingRequests === 1 ? "" : "s"}{" "}
                  awaiting review
                </p>
                <p className="text-sm text-muted-foreground">
                  Checkers still need to approve or reject these card requests.
                </p>
              </div>
            </div>
            <Button asChild className="shrink-0">
              <Link href="/admin/requests?status=PENDING">Review requests</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}

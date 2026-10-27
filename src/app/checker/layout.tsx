import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/jwt-auth";
import AppHeader from "@/components/app-header";
import CheckerNav from "@/components/checker-nav";

export default async function CheckerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user || user.role !== "CHECKER") {
    redirect("/login");
  }

  // Header and section nav live here so the approval and activation screens
  // share one chrome, and so nested routes render instead of being swallowed.
  return (
    <div className="min-h-dvh bg-background">
      <AppHeader
        title="NIB Prepaid Card"
        subtitle="Checker"
        role="Checker"
        userEmail={user.email}
        homeHref="/checker"
        showLogout
      />
      <CheckerNav />
      {children}
    </div>
  );
}

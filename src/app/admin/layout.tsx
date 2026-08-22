import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/jwt-auth";
import AppHeader from "@/components/app-header";
import AdminNav from "@/components/admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user || user.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  // Header and section nav live here so every admin screen shares one chrome.
  return (
    <div className="min-h-dvh bg-background">
      <AppHeader
        title="NIB Prepaid Card"
        subtitle="Administration"
        role="Super Admin"
        userEmail={user.email}
        homeHref="/admin"
        showLogout
      />
      <AdminNav />
      {children}
    </div>
  );
}

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/jwt-auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user || user.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  return <>{children}</>;
}

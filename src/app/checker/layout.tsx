import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/jwt-auth";
import CheckerDashboard from "./page";

export default async function CheckerPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== "CHECKER") {
    redirect("/login");
  }

  return <CheckerDashboard />;
}

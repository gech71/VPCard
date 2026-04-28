import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/jwt-auth";
import MakerDashboard from "./page";

export default async function MakerPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== "MAKER") {
    redirect("/login");
  }

  return <MakerDashboard />;
}

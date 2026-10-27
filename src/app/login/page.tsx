import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/jwt-auth";
import { LoginForm } from "@/components/login-form";
import AuthShell from "@/components/auth-shell";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    // Redirect based on role
    if (user.role === "SUPER_ADMIN") {
      redirect("/admin");
    } else if (user.role === "MAKER") {
      redirect("/maker");
    } else if (user.role === "CHECKER") {
      redirect("/checker");
    }
  }

  return (
    <AuthShell
      title="Prepaid Card Admin"
      description="Sign in to your account"
      footer="For Super Admin access, contact your system administrator."
    >
      <LoginForm />
    </AuthShell>
  );
}

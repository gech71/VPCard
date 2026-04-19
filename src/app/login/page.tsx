import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/jwt-auth";
import { LoginForm } from "@/components/login-form";

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary">
      <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg border border-primary/20">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-primary">VPCard Admin</h1>
          <p className="text-gray-500 mt-2">Sign in to your account</p>
        </div>

        <LoginForm />

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            For Super Admin access, contact system administrator
          </p>
        </div>
      </div>
    </div>
  );
}

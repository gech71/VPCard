import { validateResetToken } from "@/app/lib/auth-actions";
import ResetPasswordForm from "./ResetPasswordForm";
import Link from "next/link";

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = await params;
  const token = resolvedParams.token;
  const isValid = await validateResetToken(token);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary">
      <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg border border-primary/20">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-primary">New Password</h1>
          <p className="text-gray-500 mt-2">Enter your new password below</p>
        </div>

        {!isValid ? (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg text-center mb-6 border border-red-200">
            <p className="font-medium">Invalid or Expired Token</p>
            <p className="text-sm mt-1">This password reset link is invalid or has expired.</p>
            <Link href="/forgot-password" className="mt-4 block text-sm font-medium text-primary hover:underline">
              Request a new link
            </Link>
          </div>
        ) : (
          <ResetPasswordForm token={token} />
        )}
      </div>
    </div>
  );
}

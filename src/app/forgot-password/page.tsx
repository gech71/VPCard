"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordResetAction } from "@/app/lib/auth-actions";

export default function ForgotPasswordPage() {
  const [state, formAction, isPending] = useActionState(requestPasswordResetAction, null);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary">
      <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg border border-primary/20">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-primary">Reset Password</h1>
          <p className="text-gray-500 mt-2">Enter your email to request a reset link</p>
        </div>

        {state?.success ? (
          <div className="bg-green-50 text-green-700 p-4 rounded-lg text-center mb-6 border border-green-200">
            <p className="font-medium">Request Sent</p>
            <p className="text-sm mt-1">If an account with that email exists, we have sent a reset link to it.</p>
            <Link href="/login" className="mt-4 block text-sm font-medium text-primary hover:underline">
              Return to Login
            </Link>
          </div>
        ) : (
          <form action={formAction} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                placeholder="admin@vpcard.com"
              />
              {state?.error && (
                <p className="text-sm text-red-500 mt-2">{state.error}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? "Sending..." : "Send Reset Link"}
            </button>
            <div className="text-center">
              <Link href="/login" className="text-sm font-medium text-primary hover:underline">
                  Back to Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

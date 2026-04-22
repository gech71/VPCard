"use client";

import { useActionState } from "react";
import { resetPasswordAction } from "@/app/lib/auth-actions";
import Link from "next/link";

export default function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(resetPasswordAction, null);

  if (state?.success) {
    return (
      <div className="bg-green-50 text-green-700 p-4 rounded-lg text-center border border-green-200">
        <p className="font-medium">Password Reset Successfully</p>
        <p className="text-sm mt-1">Your password has been changed. You can now login with your new credentials.</p>
        <Link href="/login" className="mt-4 block text-sm font-medium text-primary hover:underline">
          Go to Login
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="token" value={token} />
      
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
          New Password
        </label>
        <input
          type="password"
          id="password"
          name="password"
          required
          minLength={8}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
          placeholder="••••••••"
        />
        {state?.errors?.password && (
          <p className="text-sm text-red-500 mt-2">{state.errors.password[0]}</p>
        )}
      </div>
      
      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
          Confirm Password
        </label>
        <input
          type="password"
          id="confirmPassword"
          name="confirmPassword"
          required
          minLength={8}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
          placeholder="••••••••"
        />
        {state?.errors?.confirmPassword && (
          <p className="text-sm text-red-500 mt-2">{state.errors.confirmPassword[0]}</p>
        )}
      </div>

      {state?.error && (
        <p className="text-sm text-red-500">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? "Resetting..." : "Reset Password"}
      </button>
    </form>
  );
}

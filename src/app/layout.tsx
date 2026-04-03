import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { headers } from "next/headers";
import { COOKIE_NAME } from "@/lib/auth";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Nib Virtual Card",
  description: "Manage your virtual cards with ease.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const showAuthError = !!headersList.get("x-auth-failed");
  const nonce = headersList.get("x-nonce") || "";

  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="font-body antialiased" suppressHydrationWarning>
        {showAuthError ? (
          <div className="flex items-center justify-center min-h-screen bg-background">
            <div className="text-center p-8 bg-card rounded-lg shadow-md">
              <h1 className="text-2xl font-bold text-destructive mb-4">
                Authentication Failed
              </h1>
              <p className="text-muted-foreground">
                Could not validate your session. Please try again.
              </p>
            </div>
          </div>
        ) : (
          children
        )}
        <Toaster />
      </body>
    </html>
  );
}

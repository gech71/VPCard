import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { headers } from "next/headers";
import { cookies } from "next/headers";
import { COOKIE_NAME } from "@/lib/auth";
import { ShieldAlert } from "lucide-react";

export const metadata: Metadata = {
  title: "Nib Prepaid Card",
  description: "Manage your prepaid cards with ease.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#17150f" },
  ],
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
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased" suppressHydrationWarning>
        {showAuthError ? (
          <div className="flex min-h-dvh items-center justify-center bg-background px-4">
            <div className="w-full max-w-md animate-fade-in-up rounded-xl border border-border bg-card p-8 text-center shadow-lg">
              <span className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-destructive-muted text-destructive">
                <ShieldAlert className="h-6 w-6" />
              </span>
              <h1 className="mb-2 font-headline text-xl font-bold tracking-tight text-foreground">
                Authentication failed
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
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

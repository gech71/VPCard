
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { headers } from 'next/headers';
import { cookies } from 'next/headers';
import { COOKIE_NAME } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Nib Virtual Card',
  description: 'Manage your virtual cards with ease.',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const authFailed = headersList.get('x-auth-failed');
  const cookieStore = await cookies();
  const hasCookie = cookieStore.has(COOKIE_NAME);

  // If middleware signaled failure OR there's no cookie, show auth error.
  if (authFailed || !hasCookie) {
    return (
      <html lang="en" suppressHydrationWarning>
         <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        </head>
        <body className="font-body antialiased" suppressHydrationWarning>
          <div className="flex items-center justify-center min-h-screen bg-background">
            <div className="text-center p-8 bg-card rounded-lg shadow-md">
              <h1 className="text-2xl font-bold text-destructive mb-4">Authentication Failed</h1>
              <p className="text-muted-foreground">
                Could not validate your session. Please try again.
              </p>
            </div>
          </div>
          <Toaster />
        </body>
      </html>
    );
  }

  // Otherwise, user is authenticated, render the app.
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased" suppressHydrationWarning>
        {children}
        <Toaster />
      </body>
    </html>
  );
}

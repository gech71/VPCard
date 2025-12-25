
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { headers } from 'next/headers';

export const metadata: Metadata = {
  title: 'Nib Virtual Card',
  description: 'Manage your virtual cards with ease.',
};

async function getPhoneNumber(token: string): Promise<string | null> {
  try {
    const response = await fetch('http://172.24.47.138:90/api/Authenticate/Validate', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    if (response.ok) {
      const data = await response.json();
      // Assuming the API returns a JSON object with a 'phoneNumber' property
      return data.phoneNumber || null;
    }
    return null;
  } catch (error) {
    console.error('Token validation error:', error);
    return null;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = headers();
  const authHeader = headersList.get('Authorization');
  
  let phoneNumber: string | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    phoneNumber = await getPhoneNumber(token);
  }

  if (!phoneNumber) {
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
                Could not validate your token. Please ensure you have a valid session.
              </p>
            </div>
          </div>
          <Toaster />
        </body>
      </html>
    );
  }

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

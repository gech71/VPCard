
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { COOKIE_NAME, getCookieConfig, getEncryptedPhone } from '@/lib/auth';

async function getPhoneNumberFromToken(token: string): Promise<string | null> {
  try {
    const validationUrl = process.env.TOKEN_VALIDATION_ENDPOINT;
    if (!validationUrl) {
      console.error('Token validation endpoint is not configured.');
      return null;
    }

    const response = await fetch(validationUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    if (response.ok) {
      const data = await response.json();
      return data.phone || null;
    }
    console.error('Token validation failed with status:', response.status);
    return null;
  } catch (error) {
    console.error('Token validation error:', error);
    return null;
  }
}

export async function middleware(request: NextRequest) {
  // If the phone number cookie already exists, we assume the user is authenticated.
  if (request.cookies.has(COOKIE_NAME)) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get('Authorization');

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const phoneNumber = await getPhoneNumberFromToken(token);

    if (phoneNumber) {
      // If we get a phone number, the user is authenticated.
      // We'll set the cookie on the response and proceed.
      const response = NextResponse.next();
      const encryptedPhone = getEncryptedPhone(phoneNumber);
      response.cookies.set(getCookieConfig(encryptedPhone));
      return response;
    }
  }

  // If there's no cookie, no valid auth header, or token validation fails,
  // we let the request go to the layout, which will then render the
  // "Authentication Failed" message because `getDecryptedPhoneFromCookie` will return null.
  return NextResponse.next();
}

export const config = {
  // Match all request paths except for the ones starting with:
  // - _next/static (static files)
  // - _next/image (image optimization files)
  // - favicon.ico (favicon file)
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

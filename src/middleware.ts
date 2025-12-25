
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { COOKIE_NAME, encrypt } from '@/lib/auth';

// Force middleware to run on Node.js runtime to use 'crypto'
export const runtime = 'nodejs';

export async function middleware(request: NextRequest) {
  // If the phone number cookie already exists, we assume the user is authenticated.
  if (request.cookies.has(COOKIE_NAME)) {
    return NextResponse.next();
  }
  
  const authHeader = request.headers.get('Authorization');

  // If there's no cookie and no auth header, let the layout handle showing an error.
  if (!authHeader) {
    const response = NextResponse.next();
    // Signal to layout that auth has failed
    response.headers.set('x-auth-failed', 'true');
    return response;
  }

  try {
    const validationUrl = process.env.TOKEN_VALIDATION_ENDPOINT;
    if (!validationUrl) {
      throw new Error('Token validation endpoint is not configured.');
    }

    const tokenResponse = await fetch(validationUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
      },
      cache: 'no-store',
    });

    if (tokenResponse.ok) {
      const data = await tokenResponse.json();
      const phoneNumber = data.phone;
      
      if (phoneNumber) {
        const encryptedPhone = encrypt(phoneNumber);
        // We need to create a new response to set a cookie
        const response = NextResponse.next();
        response.cookies.set(COOKIE_NAME, encryptedPhone, {
          httpOnly: true,
          secure: process.env.NODE_ENV !== 'development',
          sameSite: 'strict',
          maxAge: 60 * 60 * 24, // 1 day
          path: '/',
        });
        return response;
      }
    }
    
    // Token validation failed
    const response = NextResponse.next();
    response.headers.set('x-auth-failed', 'true');
    return response;

  } catch (error) {
    console.error('Middleware token validation error:', error);
    const response = NextResponse.next();
    response.headers.set('x-auth-failed', 'true');
    return response;
  }
}

export const config = {
  // Match all request paths except for the ones starting with:
  // - _next/static (static files)
  // - _next/image (image optimization files)
  // - favicon.ico (favicon file)
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

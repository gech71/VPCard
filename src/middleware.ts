
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { COOKIE_NAME, encrypt } from '@/lib/auth';
import * as crypto from 'crypto';

// Force middleware to run on Node.js runtime to use 'crypto'
export const runtime = 'nodejs';

export async function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomBytes(16)).toString('base64');
  
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}';
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' https://picsum.photos https://play-lh.googleusercontent.com;
    font-src 'self' https://fonts.gstatic.com;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    block-all-mixed-content;
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, ' ').trim();


  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  
  // Start with the base response by calling NextResponse.next()
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Always set the CSP header on the response
  response.headers.set('Content-Security-Policy', cspHeader);

  // If the phone number cookie already exists, we assume the user is authenticated.
  if (request.cookies.has(COOKIE_NAME)) {
    return response;
  }
  
  const authHeader = request.headers.get('Authorization');

  // If there's no cookie and no auth header, let the layout handle showing an error.
  if (!authHeader) {
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
    response.headers.set('x-auth-failed', 'true');
    return response;

  } catch (error) {
    console.error('Middleware token validation error:', error);
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

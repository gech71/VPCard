
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { COOKIE_NAME } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  // If the phone number cookie already exists, we assume the user is authenticated.
  if (request.cookies.has(COOKIE_NAME)) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get('Authorization');
  const requestHeaders = new Headers(request.headers)

  if (authHeader) {
    requestHeaders.set('x-authorization', authHeader)
  }

  // Pass the token to the server component via request headers
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  // Match all request paths except for the ones starting with:
  // - _next/static (static files)
  // - _next/image (image optimization files)
  // - favicon.ico (favicon file)
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

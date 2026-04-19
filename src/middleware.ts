// Force middleware to run on Node.js runtime to use 'crypto'
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME, encrypt } from "@/lib/auth";
import { verifyToken } from "@/lib/jwt-auth";

// Public paths that don't require authentication
const publicPaths = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/reset-password",
  "/api/customer/search",
  "/login",
  "/register",
];

// Check if path is public
function isPublicPath(pathname: string): boolean {
  return publicPaths.some((path) => pathname.startsWith(path));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Generate nonce using Web Crypto API (works in both Edge and Node runtimes)
  const nonce = btoa(Math.random().toString(36).substring(2));

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
  `
    .replace(/\s{2,}/g, " ")
    .trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Check for JWT auth token first (new Maker-Checker system)
  const authToken = request.cookies.get("auth-token")?.value;

  if (authToken) {
    const payload = verifyToken(authToken);
    if (payload) {
      // JWT auth successful - add user info to headers
      requestHeaders.set("x-user-id", payload.userId);
      requestHeaders.set("x-user-email", payload.email);
      requestHeaders.set("x-user-role", payload.role);

      // Recreate response with updated headers
      response = NextResponse.next({
        request: { headers: requestHeaders },
      });
    } else {
      // Invalid JWT - clear cookie and redirect to login
      response.cookies.delete("auth-token");
      if (!pathname.startsWith("/api/") && !isPublicPath(pathname)) {
        return NextResponse.redirect(new URL("/login", request.url));
      }
    }
  } else if (!isPublicPath(pathname)) {
    // No JWT token and not a public path - check legacy phone auth or redirect
    // If the phone number cookie already exists, we assume the user is authenticated.
    if (request.cookies.has(COOKIE_NAME)) {
      // Legacy auth - allow through
    } else {
      // No auth at all - redirect to login for non-API routes
      if (!pathname.startsWith("/api/")) {
        return NextResponse.redirect(new URL("/login", request.url));
      }
    }
  }

  // Set all security headers on the final response object
  response.headers.set("Content-Security-Policy", cspHeader);
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");

  return response;
}

export const config = {
  // Match all request paths except for the ones starting with:
  // - _next/static (static files)
  // - _next/image (image optimization files)
  // - favicon.ico (favicon file)
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME, encrypt } from "@/lib/auth";
import { verifyToken } from "@/lib/jwt-auth";

// Public paths that don't require authentication
const publicPaths = [
  "/api/auth/login",
  "/api/auth/logout",
  "/forgot-password",
  "/api/auth/reset-password",
  "/login",
  "/register",
  "/reset-password",
];

// Check if path is public
function isPublicPath(pathname: string): boolean {
  return publicPaths.some((path) => pathname.startsWith(path));
}

export async function proxy(request: NextRequest) {
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
  let isDashboardAuthProcessed = false;

  const isDashboardRoute =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/maker") ||
    pathname.startsWith("/checker");

  if (authToken) {
    const payload = await verifyToken(authToken);
    if (payload) {
      // JWT auth successful - add user info to headers
      requestHeaders.set("x-user-id", payload.userId);
      requestHeaders.set("x-user-email", payload.email);
      requestHeaders.set("x-user-role", payload.role);

      // Recreate response with updated headers
      response = NextResponse.next({
        request: { headers: requestHeaders },
      });

      // Sliding session: reset cookie expiration on every activity
      response.cookies.set("auth-token", authToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 15 * 60, // 15 minutes inactivity timeout
        path: "/",
      });
      
      isDashboardAuthProcessed = true;
    } else {
      // Invalid JWT - clear cookie
      response.cookies.delete("auth-token");
      if (isDashboardRoute) {
        return NextResponse.redirect(new URL("/login", request.url));
      }
    }
  } else if (isDashboardRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // If the requested route is not part of the dashboard and is not public,
  // enforce the strict legacy phone token system even if they have an active auth-token
  if (!isPublicPath(pathname) && !isDashboardRoute) {
    // If the phone number cookie already exists, we assume the user is authenticated in legacy app
    if (request.cookies.has(COOKIE_NAME)) {
      // Legacy auth - allow through
    } else {
      const authHeader = request.headers.get("Authorization");
      let authFailed = false;

      if (!authHeader) {
        authFailed = true;
      } else {
        try {
          const validationUrl = process.env.TOKEN_VALIDATION_ENDPOINT;
          if (!validationUrl) {
            throw new Error("Token validation endpoint is not configured.");
          }

          const tokenResponse = await fetch(validationUrl, {
            method: "GET",
            headers: { Authorization: authHeader },
            cache: "no-store",
          });

          if (tokenResponse.ok) {
            const data = await tokenResponse.json();
            const phoneNumber = data.phone;

            if (phoneNumber) {
              const encryptedPhone = encrypt(phoneNumber);
              response.cookies.set(COOKIE_NAME, encryptedPhone, {
                httpOnly: true,
                secure: process.env.NODE_ENV !== "development",
                sameSite: "strict",
                maxAge: 60 * 60 * 24, // 1 day
                path: "/",
              });
            } else {
              authFailed = true; // Token valid but no phone number
            }
          } else {
            authFailed = true; // Token validation failed
          }
        } catch (error) {
          authFailed = true; // Error during validation
        }
      }

      if (authFailed) {
        requestHeaders.set("x-auth-failed", "true");
        // Re-create the response object with the modified headers
        response = NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        });
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

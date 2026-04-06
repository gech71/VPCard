import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME, encrypt } from "@/lib/auth";
import * as crypto from "crypto";

// Force middleware to run on Node.js runtime to use 'crypto'
export const runtime = "nodejs";

export async function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomBytes(16)).toString("base64");

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

  // If the phone number cookie already exists, we assume the user is authenticated.
  // We can proceed and just set the security headers.
  const isMiniAppAuthEnabled = process.env.ENABLE_MINIAPP_AUTH === "true";

  // If the phone number cookie already exists, we assume the user is authenticated.
  if (request.cookies.has(COOKIE_NAME)) {
    // Already authenticated, continue as normal
  } else if (!isMiniAppAuthEnabled) {
    // If mini app auth is disabled, use the default phone number
    const phoneNumber = "251933704978";
    const encryptedPhone = encrypt(phoneNumber);
    response.cookies.set(COOKIE_NAME, encryptedPhone, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== "development",
      sameSite: "strict",
      maxAge: 60 * 60 * 24, // 1 day
      path: "/",
    });
  } else {
    // Mini app auth is enabled, proceed with normal auth flow
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

import { NextResponse } from "next/server";
import { removeAuthCookie, getCurrentUser, revokeToken, getAuthCookie } from "@/lib/jwt-auth";
import { clearAuthCookies } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    const token = await getAuthCookie();

    if (user) {
      await createAuditLog({
        userId: user.userId,
        action: "LOGOUT",
        entityType: "AUTH",
        entityId: user.userId,
      });
    }

    if (token) {
      await revokeToken(token);
    }

    await clearAuthCookies();
    await removeAuthCookie();

    return NextResponse.redirect(new URL("/login", request.url), { status: 302 });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { removeAuthCookie, getCurrentUser } from "@/lib/jwt-auth";
import { clearAuthCookies } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (user) {
      await createAuditLog({
        userId: user.userId,
        action: "LOGOUT",
        entityType: "AUTH",
        entityId: user.userId,
      });
    }

    await clearAuthCookies();
    await removeAuthCookie();

    return NextResponse.redirect(new URL("/login", request.url), { status: 302 });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

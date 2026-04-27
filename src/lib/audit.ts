import { headers } from "next/headers";
import prisma from "./prisma";

export type AuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "REGISTER_USER"
  | "RESET_PASSWORD"
  | "CREATE_REQUEST"
  | "ASSIGN_REQUEST"
  | "APPROVE_REQUEST"
  | "REJECT_REQUEST"
  | "VIEW_REQUEST";

export type AuditEntityType = "USER" | "CARD_REQUEST" | "AUTH";

interface AuditLogParams {
  userId?: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string;
  details?: Record<string, unknown>;
  cardRequestId?: string;
}

export async function createAuditLog({
  userId,
  action,
  entityType,
  entityId,
  details,
  cardRequestId,
}: AuditLogParams) {
  try {
    // Capture IP and User-Agent from request headers
    let ipAddress = "unknown";
    let userAgent = "unknown";
    
    try {
      const headerList = await headers();
      // Try to get IP from standard proxy headers
      ipAddress = headerList.get("x-forwarded-for")?.split(",")[0] || 
                  headerList.get("x-real-ip") || 
                  "unknown";
      userAgent = headerList.get("user-agent") || "unknown";
    } catch (e) {
      // headers() might fail if called outside of a request context
      console.warn("Audit Log: Could not retrieve request headers.");
    }

    // Verify user exists if userId is provided
    let verifiedUserId = userId;
    if (userId) {
      const userExists = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (!userExists) {
        console.warn(`Audit Log: User ID ${userId} not found. Logging as anonymous.`);
        verifiedUserId = undefined; // Set to undefined so Prisma omits it, column is nullable
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: verifiedUserId,
        action,
        entityType,
        entityId,
        details: details || {},
        cardRequestId,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    // Log to console but don't fail the main operation
    console.error("Critical: Failed to create audit log:", {
      error,
      params: { userId, action, entityType, entityId, cardRequestId },
    });
  }
}

export async function getAuditLogs(options: {
  userId?: string;
  entityType?: AuditEntityType;
  entityId?: string;
  cardRequestId?: string;
  limit?: number;
  offset?: number;
}) {
  const {
    userId,
    entityType,
    entityId,
    cardRequestId,
    limit = 50,
    offset = 0,
  } = options;

  return prisma.auditLog.findMany({
    where: {
      ...(userId && { userId }),
      ...(entityType && { entityType }),
      ...(entityId && { entityId }),
      ...(cardRequestId && { cardRequestId }),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
    include: {
      user: {
        select: { email: true, role: true },
      },
    },
  });
}

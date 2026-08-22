import { headers } from "next/headers";
import prisma from "./prisma";

export type AuditAction =
  | "LOGIN"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "REGISTER_USER"
  | "RESET_PASSWORD"
  | "REQUEST_PASSWORD_RESET"
  | "CREATE_REQUEST"
  | "SELF_REQUEST"
  | "ASSIGN_REQUEST"
  | "APPROVE_REQUEST"
  | "REJECT_REQUEST"
  | "VIEW_REQUEST"
  | "ACTIVATE_ECOMMERCE"
  | "ACTIVATE_ECOMMERCE_FAILED"
  | "CHANGE_PIN"
  | "UPDATE_LIMIT"
  | "VIEW_LIMITS"
  | "VIEW_TRANSACTIONS";

export type AuditEntityType = "USER" | "CARD_REQUEST" | "AUTH" | "CARD";
export type AuditActorType = "USER" | "SYSTEM" | "ADMIN";

interface AuditLogParams {
  userId?: string; // The primary user ID associated with the record (legacy)
  actorType: AuditActorType;
  actorId?: string;
  actorEmail?: string;
  targetUserId?: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string;
  details?: Record<string, unknown>;
  cardRequestId?: string;
}

export async function createAuditLog({
  userId,
  actorType,
  actorId,
  actorEmail,
  targetUserId,
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
    }

    // Verify user exists if userId is provided
    let verifiedUserId = userId || actorId; // Map actorId to userId for backward compatibility if needed
    if (verifiedUserId) {
      const userExists = await prisma.user.findUnique({
        where: { id: verifiedUserId },
        select: { id: true },
      });
      if (!userExists) {
        verifiedUserId = undefined;
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: verifiedUserId,
        actorType,
        actorId: actorId || "SYSTEM",
        actorEmail,
        targetUserId,
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
    console.error("Failed to create audit log:", error);
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

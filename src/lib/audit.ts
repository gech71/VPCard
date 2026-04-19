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
    // Get request headers for IP and user agent
    const headers = new Map<string, string>();

    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        details: details || {},
        cardRequestId,
        ipAddress:
          headers.get("x-forwarded-for") ||
          headers.get("x-real-ip") ||
          "unknown",
        userAgent: headers.get("user-agent") || "unknown",
      },
    });
  } catch (error) {
    // Log to console but don't fail the main operation
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

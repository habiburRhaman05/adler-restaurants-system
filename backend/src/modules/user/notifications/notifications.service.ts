import { prisma } from "../../../config/db";
import { AppError } from "../../../utils/AppError";
import type { Prisma } from "../../../generated/prisma/client";

const notificationSelect = {
  id: true,
  type: true,
  channel: true,
  status: true,
  title: true,
  body: true,
  payload: true,
  sentAt: true,
  readAt: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

// ─── List Notifications ──────────────────────────────────────────
const listNotifications = async (
  userId: string,
  query: { page: number; limit: number; unreadOnly?: boolean }
) => {
  const { page, limit, unreadOnly } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.NotificationWhereInput = { userId };
  if (unreadOnly) where.readAt = null;

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: notificationSelect,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);

  return {
    notifications,
    unreadCount,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// ─── Mark One As Read ────────────────────────────────────────────
const markAsRead = async (userId: string, notificationId: string) => {
  const existing = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
    select: { id: true, readAt: true },
  });
  if (!existing) {
    throw new AppError("Notification not found.", 404);
  }

  if (existing.readAt) {
    return prisma.notification.findUniqueOrThrow({
      where: { id: notificationId },
      select: notificationSelect,
    });
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date(), status: "READ" },
    select: notificationSelect,
  });
};

// ─── Mark All As Read ────────────────────────────────────────────
const markAllAsRead = async (userId: string) => {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date(), status: "READ" },
  });
  return { updatedCount: result.count };
};

export const notificationServices = {
  listNotifications,
  markAsRead,
  markAllAsRead,
};

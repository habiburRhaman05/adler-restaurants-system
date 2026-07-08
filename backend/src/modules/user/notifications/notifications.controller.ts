import type { Request, Response } from "express";
import { notificationServices } from "./notifications.service";
import { sendSuccess } from "../../../utils/apiResponse";
import type { ListNotificationsQuery } from "./notifications.validation";

// ─── List Notifications ──────────────────────────────────────────
export const listNotifications = async (req: Request, res: Response): Promise<void> => {
  const userId = res.locals.auth!.userId;
  const validated = req.validated as ListNotificationsQuery;

  const query: { page: number; limit: number; unreadOnly?: boolean } = {
    page: validated.page,
    limit: validated.limit,
  };
  if (validated.unreadOnly !== undefined) query.unreadOnly = validated.unreadOnly;

  const result = await notificationServices.listNotifications(userId, query);

  sendSuccess(res, {
    statusCode: 200,
    message: "Notifications fetched successfully.",
    data: { notifications: result.notifications, unreadCount: result.unreadCount },
    meta: { pagination: result.pagination },
  });
};

// ─── Mark One As Read ────────────────────────────────────────────
export const markAsRead = async (req: Request, res: Response): Promise<void> => {
  const userId = res.locals.auth!.userId;
  const notificationId = req.params.notificationId as string;

  const notification = await notificationServices.markAsRead(userId, notificationId);

  sendSuccess(res, {
    statusCode: 200,
    message: "Notification marked as read.",
    data: { notification },
  });
};

// ─── Mark All As Read ────────────────────────────────────────────
export const markAllAsRead = async (req: Request, res: Response): Promise<void> => {
  const userId = res.locals.auth!.userId;

  const result = await notificationServices.markAllAsRead(userId);

  sendSuccess(res, {
    statusCode: 200,
    message: "All notifications marked as read.",
    data: { updatedCount: result.updatedCount },
  });
};

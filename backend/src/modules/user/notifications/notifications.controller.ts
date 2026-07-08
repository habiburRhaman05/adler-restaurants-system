import type { Request, Response } from "express";
import { notificationServices } from "./notifications.service";
import { sendSuccess } from "../../../utils/apiResponse";
import type {
  ListNotificationsQuery,
  RegisterDeviceInput,
  UnregisterDeviceInput,
} from "./notifications.validation";

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

// ─── Register This Device For Push ───────────────────────────────
export const registerDevice = async (req: Request, res: Response): Promise<void> => {
  const userId = res.locals.auth!.userId;
  const input = req.validated as RegisterDeviceInput;

  const result = await notificationServices.registerDevice(userId, input);

  sendSuccess(res, {
    statusCode: 200,
    message: result.ok ? "Device registered for push notifications." : "Invalid push token.",
    data: { registered: result.ok },
  });
};

// ─── Unregister This Device ──────────────────────────────────────
export const unregisterDevice = async (req: Request, res: Response): Promise<void> => {
  const userId = res.locals.auth!.userId;
  const { token } = req.validated as UnregisterDeviceInput;

  await notificationServices.unregisterDevice(userId, token);

  sendSuccess(res, {
    statusCode: 200,
    message: "Device unregistered.",
    data: { unregistered: true },
  });
};

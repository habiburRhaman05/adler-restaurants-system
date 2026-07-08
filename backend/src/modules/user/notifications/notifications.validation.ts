import { z } from "zod";

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),
});

export const notificationIdParamSchema = z.object({
  notificationId: z.string({ required_error: "Notification ID is required" }).min(1),
});

export const registerDeviceSchema = z.object({
  token: z.string({ required_error: "Push token is required" }).min(1),
  platform: z.enum(["ios", "android"]).optional(),
  deviceName: z.string().max(120).optional(),
});

export const unregisterDeviceSchema = z.object({
  token: z.string({ required_error: "Push token is required" }).min(1),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;
export type UnregisterDeviceInput = z.infer<typeof unregisterDeviceSchema>;

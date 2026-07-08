import { z } from 'zod';

// Mirrors backend/src/modules/user/notifications (Notification + notificationSelect).

export const notificationTypeSchema = z.enum([
  'WEEKLY_SHIFTS_PUBLISHED',
  'SHIFT_OFFER_PUBLISHED',
  'AVAILABILITY_REMINDER',
  'SWAP_REQUEST_RECEIVED',
  'SWAP_REQUEST_RESULT',
  'SWAP_PENDING_ADMIN_APPROVAL',
  'SHIFT_CHANGED',
  'RULE_VIOLATION',
  'LEAVE_REQUEST_RESULT',
  'GENERAL',
]);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const notificationSchema = z.object({
  id: z.string(),
  // Stay lenient on the enum: a new backend type must never crash the inbox.
  type: z.string(),
  channel: z.string(),
  status: z.string(),
  title: z.string(),
  body: z.string(),
  payload: z.record(z.string(), z.unknown()).nullish(),
  sentAt: z.string().nullish(),
  readAt: z.string().nullish(),
  createdAt: z.string(),
});
export type AppNotification = z.infer<typeof notificationSchema>;

export const notificationsListSchema = z.object({
  notifications: z.array(notificationSchema),
  unreadCount: z.number(),
});
export type NotificationsList = z.infer<typeof notificationsListSchema>;

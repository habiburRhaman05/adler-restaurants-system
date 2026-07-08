import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { z } from 'zod';
import { apiEnvelope } from '../../shared/schema';
import { notificationsListSchema, type NotificationsList } from '../schema';

const listEnvelope = apiEnvelope(notificationsListSchema);

/** GET /api/v1/notifications — my notifications + unread count. */
export async function fetchNotifications(): Promise<NotificationsList> {
  const { data } = await apiClient.get(ENDPOINTS.notifications.list, { params: { limit: 50 } });
  return listEnvelope.parse(data).data;
}

/** PATCH /api/v1/notifications/:id/read — mark one read. */
export async function markNotificationRead(id: string): Promise<void> {
  await apiClient.patch(ENDPOINTS.notifications.markRead(id));
}

/** PATCH /api/v1/notifications/read-all — mark everything read. */
export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.patch(ENDPOINTS.notifications.markAllRead);
}

/** POST /api/v1/notifications/devices — register this device's Expo push token. */
export async function registerPushDevice(input: {
  token: string;
  platform?: 'ios' | 'android';
  deviceName?: string;
}): Promise<boolean> {
  const { data } = await apiClient.post(ENDPOINTS.notifications.registerDevice, input);
  return apiEnvelope(z.object({ registered: z.boolean() }))
    .parse(data)
    .data.registered;
}

/** DELETE /api/v1/notifications/devices — unregister on logout. */
export async function unregisterPushDevice(token: string): Promise<void> {
  await apiClient.delete(ENDPOINTS.notifications.unregisterDevice, { data: { token } });
}

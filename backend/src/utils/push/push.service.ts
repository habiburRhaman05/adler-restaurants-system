import { Expo, type ExpoPushMessage, type ExpoPushTicket } from "expo-server-sdk";
import { prisma } from "../../config/db";
import { envConfig } from "../../config/env";
import { logger } from "../logger";

/**
 * Expo push delivery. Mirrors the mailer pattern: this is a best-effort side
 * channel — every function swallows its own errors and logs, so a push failure
 * can never fail the API request (schedule publish, swap approval, …) that
 * triggered it. The in-app Notification row is the source of truth; push is the
 * "buzz the phone" layer on top.
 *
 * This is the seam the whole notification system funnels through. Upgrading from
 * "send inline" (Rung 1) to "enqueue a job" (Rung 2) is a change to
 * `sendPushToUsers` only — no call site changes.
 */

let expo: Expo | null = null;
const getExpo = (): Expo => {
  if (!expo) {
    expo = new Expo(
      envConfig.EXPO_ACCESS_TOKEN ? { accessToken: envConfig.EXPO_ACCESS_TOKEN } : {}
    );
  }
  return expo;
};

export interface PushPayload {
  title: string;
  body: string;
  /** Data ferried to the app; used for deep-linking on tap (e.g. { screen, id }). */
  data?: Record<string, unknown>;
}

// ─── Register / unregister a device ──────────────────────────────
export const registerDeviceToken = async (
  userId: string,
  token: string,
  platform?: string,
  deviceName?: string
): Promise<{ ok: boolean }> => {
  if (!Expo.isExpoPushToken(token)) {
    // Not a fatal error for the caller — just an unusable token.
    return { ok: false };
  }

  // A token is globally unique to one device; if it moves to a new user
  // (someone else logs in on that phone) the row is reassigned, not duplicated.
  await prisma.devicePushToken.upsert({
    where: { token },
    create: { userId, token, platform: platform ?? null, deviceName: deviceName ?? null },
    update: { userId, platform: platform ?? null, deviceName: deviceName ?? null, lastUsedAt: new Date() },
  });
  return { ok: true };
};

export const removeDeviceToken = async (userId: string, token: string): Promise<void> => {
  // Scoped by userId so one user can't unregister another's device.
  await prisma.devicePushToken.deleteMany({ where: { userId, token } });
};

// ─── Send to a set of users ──────────────────────────────────────
export const sendPushToUsers = async (
  userIds: string[],
  payload: PushPayload
): Promise<void> => {
  try {
    const uniqueIds = [...new Set(userIds)].filter(Boolean);
    if (uniqueIds.length === 0) return;

    const devices = await prisma.devicePushToken.findMany({
      where: { userId: { in: uniqueIds } },
      select: { token: true },
    });
    if (devices.length === 0) return;

    const client = getExpo();
    const messages: ExpoPushMessage[] = [];
    const validTokens: string[] = [];
    for (const { token } of devices) {
      if (!Expo.isExpoPushToken(token)) continue;
      validTokens.push(token);
      messages.push({
        to: token,
        sound: "default",
        title: payload.title,
        body: payload.body,
        ...(payload.data ? { data: payload.data } : {}),
      });
    }
    if (messages.length === 0) return;

    const chunks = client.chunkPushNotifications(messages);
    const deadTokens: string[] = [];
    let msgOffset = 0;

    for (const chunk of chunks) {
      let tickets: ExpoPushTicket[] = [];
      try {
        tickets = await client.sendPushNotificationsAsync(chunk);
      } catch (err) {
        logger.error({ err }, "Expo push chunk failed");
        msgOffset += chunk.length;
        continue;
      }
      // Tickets align 1:1 with the chunk; map a DeviceNotRegistered error back
      // to the token that produced it so we can prune it.
      tickets.forEach((ticket, i) => {
        const token = validTokens[msgOffset + i];
        if (token && ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
          deadTokens.push(token);
        }
      });
      msgOffset += chunk.length;
    }

    if (deadTokens.length > 0) {
      await prisma.devicePushToken.deleteMany({ where: { token: { in: deadTokens } } });
      logger.info({ count: deadTokens.length }, "Pruned unregistered device push tokens");
    }
  } catch (err) {
    logger.error({ err }, "sendPushToUsers failed");
  }
};

export const pushService = { registerDeviceToken, removeDeviceToken, sendPushToUsers };

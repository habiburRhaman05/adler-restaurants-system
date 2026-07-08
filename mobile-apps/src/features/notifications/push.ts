import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { logger } from '@/lib/logger';

/**
 * True when running inside Expo Go, where remote push was removed in SDK 53+
 * (calling into it throws). `appOwnership === 'expo'` is the reliable signal;
 * executionEnvironment is a secondary check. Real push only works in a
 * dev/production build — in Expo Go we skip it and the in-app inbox still works.
 */
export const isExpoGo =
  Constants.appOwnership === 'expo' ||
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Show a banner + play a sound even when the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Android needs an explicit high-importance channel to show heads-up banners. */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#2563EB',
  });
}

/**
 * Ask for permission (if not already granted) and return this device's Expo
 * push token — or null if it's a simulator, permission was denied, or anything
 * failed. Never throws: push is best-effort and must not break login.
 */
export async function getExpoPushToken(): Promise<string | null> {
  try {
    if (isExpoGo) return null; // remote push isn't available in Expo Go
    if (!Device.isDevice) return null; // push only works on real hardware

    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted && existing.canAskAgain) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.granted;
    }
    if (!granted) return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    if (!projectId) {
      logger.error('Missing EAS projectId — cannot get Expo push token');
      return null;
    }

    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (err) {
    logger.error('getExpoPushToken failed', err);
    return null;
  }
}

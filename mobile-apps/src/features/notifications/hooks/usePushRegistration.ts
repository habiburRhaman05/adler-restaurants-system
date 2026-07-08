import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { secureStorage } from '@/lib/storage';
import { logger } from '@/lib/logger';
import { queryClient } from '@/lib/queryClient';
import { getExpoPushToken, isExpoGo } from '../push';
import { registerPushDevice } from '../api/notifications.api';
import { notificationKeys } from './useNotifications';

// Where each notification type sends the user when tapped.
function routeForData(data: Record<string, unknown> | undefined): string {
  const screen = typeof data?.screen === 'string' ? data.screen : undefined;
  if (screen === 'schedule') return '/(tabs)/schedule';
  if (screen === 'swaps') return '/(tabs)/swaps';
  if (screen === 'availability') return '/(tabs)/availability';
  return '/notifications';
}

/**
 * When the user is authenticated: register this device for push, keep the
 * inbox badge in sync on foreground delivery, and deep-link on tap. All of it
 * is best-effort — a failure here never blocks the app.
 */
export function usePushRegistration(enabled: boolean): void {
  const router = useRouter();
  const registered = useRef(false);

  // Register the device once per authenticated session.
  useEffect(() => {
    if (!enabled || registered.current || isExpoGo) return;
    registered.current = true;

    (async () => {
      const token = await getExpoPushToken();
      if (!token) return;
      try {
        await secureStorage.set('pushToken', token);
        await registerPushDevice({
          token,
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
        });
        logger.info('Push device registered');
      } catch (err) {
        logger.error('Push device registration failed', err);
      }
    })();

    if (!enabled) registered.current = false;
  }, [enabled]);

  // Reset the guard on logout so the next login re-registers.
  useEffect(() => {
    if (!enabled) registered.current = false;
  }, [enabled]);

  // Listeners live for the whole authenticated session.
  useEffect(() => {
    if (!enabled || isExpoGo) return;

    const receivedSub = Notifications.addNotificationReceivedListener(() => {
      // A push arrived while the app is open — refresh the inbox + badge.
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        | Record<string, unknown>
        | undefined;
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      try {
        router.push(routeForData(data) as never);
      } catch (err) {
        logger.error('Failed to route from notification tap', err);
      }
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [enabled, router]);
}

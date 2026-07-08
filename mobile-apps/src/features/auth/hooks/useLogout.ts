import { useMutation } from '@tanstack/react-query';
import { logoutRequest } from '../api/auth.api';
import { useAuthStore } from '../store/authStore';
import { queryClient } from '@/lib/queryClient';
import { secureStorage } from '@/lib/storage';
import { unregisterPushDevice } from '@/features/notifications';
import { logger } from '@/lib/logger';

export function useLogout() {
  const logout = useAuthStore((s) => s.logout);

  return useMutation({
    mutationFn: logoutRequest,
    onSettled: async () => {
      // Stop pushing to this device. Done before tokens are cleared (the call
      // is authenticated) and best-effort — a failure never blocks logout.
      try {
        const pushToken = await secureStorage.get('pushToken');
        if (pushToken) {
          await unregisterPushDevice(pushToken);
          await secureStorage.remove('pushToken');
        }
      } catch (err) {
        logger.error('Failed to unregister push device on logout', err);
      }

      await secureStorage.remove('accessToken');
      await secureStorage.remove('refreshToken');
      queryClient.clear();
      logout();
    },
  });
}

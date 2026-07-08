import { useMutation } from '@tanstack/react-query';
import { logoutRequest } from '../api/auth.api';
import { useAuthStore } from '../store/authStore';
import { queryClient } from '@/lib/queryClient';
import { secureStorage } from '@/lib/storage';

export function useLogout() {
  const logout = useAuthStore((s) => s.logout);

  return useMutation({
    mutationFn: logoutRequest,
    onSettled: async () => {
      await secureStorage.remove('accessToken');
      await secureStorage.remove('refreshToken');
      queryClient.clear();
      logout();
    },
  });
}

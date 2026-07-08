import { useMutation } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { loginRequest } from '../api/auth.api';
import { useAuthStore } from '../store/authStore';
import { secureStorage } from '@/lib/storage';
import type { LoginPayload } from '../types';

export function getLoginErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    if (error.response?.status === 401) {
      const serverMsg = (error.response?.data as { message?: string })?.message;
      return serverMsg || 'Wrong email or password. Please try again.';
    }
    if (error.response?.status === 403) {
      const serverMsg = (error.response?.data as { message?: string })?.message;
      return serverMsg || 'This account has been deactivated. Contact your admin.';
    }
    if (error.code === 'ERR_NETWORK') {
      return 'Unable to connect to the server. Check your internet connection.';
    }
    if (error.code === 'ECONNABORTED') {
      return 'Request timed out. Please try again.';
    }
  }
  return 'Something went wrong. Please try again later.';
}

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: (payload: LoginPayload) => loginRequest(payload),
    onSuccess: async (response) => {
      // response.data contains accessToken and refreshToken
      const tokens = response.data as any; // Cast as any if LoginResponseData isn't completely accurate yet
      if (tokens.accessToken && tokens.refreshToken) {
        await secureStorage.set('accessToken', tokens.accessToken);
        await secureStorage.set('refreshToken', tokens.refreshToken);
      }
      setSession(response.data.user);
    },
  });
}

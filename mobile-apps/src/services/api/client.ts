import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import axios, { AxiosError } from 'axios';
import { secureStorage } from '@/lib/storage';

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}> = [];

function processQueue(error: unknown) {
  failedQueue.forEach(({ reject }) => reject(error));
  failedQueue = [];
}

export const apiClient = axios.create({
  // Single source of truth: .env → env.ts (which swaps localhost for the dev
  // machine's LAN IP on devices). Never hardcode a URL here.
  baseURL: env.API_URL,
  timeout: 10000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

logger.info('API baseURL', env.API_URL);

// Auth endpoints must never trigger the refresh flow: a 401 from login means
// wrong credentials, and a 401 from refresh/logout means the session is gone.
const AUTH_PATHS = ['/auth/user/login', '/auth/user/refresh', '/auth/user/logout'];

apiClient.interceptors.request.use(async (config) => {
  const token = await secureStorage.get('accessToken');
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;
    const isAuthRequest = AUTH_PATHS.some((p) => originalRequest?.url?.includes(p));

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !isAuthRequest &&
      !(originalRequest as unknown as { _retry?: boolean })._retry
    ) {
      if (isRefreshing) {
        return new Promise<unknown>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => apiClient(originalRequest));
      }

      (originalRequest as unknown as { _retry: boolean })._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await secureStorage.get('refreshToken');
        const { data } = await apiClient.post('/api/v1/auth/user/refresh', { refreshToken });
        
        const newAccessToken = data.data.accessToken;
        const newRefreshToken = data.data.refreshToken;
        
        if (newAccessToken && newRefreshToken) {
          await secureStorage.set('accessToken', newAccessToken);
          await secureStorage.set('refreshToken', newRefreshToken);
          
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          }
        }
        
        processQueue(null);
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        await secureStorage.remove('accessToken');
        await secureStorage.remove('refreshToken');
        const { useAuthStore } = await import('@/features/auth/store/authStore');
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    logger.error('API request failed', error.config?.url, error.message);
    return Promise.reject(error);
  },
);

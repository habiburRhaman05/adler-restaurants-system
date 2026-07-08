import axios, { type AxiosError } from 'axios';

/** Standard error thrown for all failed API calls. */
export class ApiError extends Error {
  status: number;
  statusText: string;
  data: unknown;

  constructor(message: string, status: number, statusText: string, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.data = data;
  }
}

/** Backend envelope shape: { success, message, data, statusCode }. */
export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  statusCode: number;
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  withCredentials: true,
});

// ─── Response Interceptor ───────────────────────────────────

api.interceptors.response.use(
  (response) => {
    const body = response.data as Partial<ApiEnvelope<unknown>> | undefined;

    // Envelope with success=false but HTTP 200 → treat as error
    if (body && typeof body === 'object' && body.success === false) {
      return Promise.reject(
        new ApiError(
          body.message || 'Operation failed',
          body.statusCode || response.status,
          response.statusText,
          body.data
        )
      );
    }

    return response;
  },
  (error: AxiosError<Partial<ApiEnvelope<unknown>>>) => {
    if (error.response) {
      const { status, statusText, data } = error.response;

      // Auto-logout on 401 Unauthorized (session expired / invalid)
      if (status === 401) {
        handleSessionExpired();
      }

      const message = data?.message || error.message || 'An unexpected error occurred';
      return Promise.reject(
        new ApiError(message, data?.statusCode || status, statusText, data?.data ?? data)
      );
    }

    if (error.request) {
      return Promise.reject(
        new ApiError(
          'Network error — please check your connection',
          0,
          'Network Error'
        )
      );
    }

    return Promise.reject(
      new ApiError(error.message || 'Request configuration error', 0, 'Request Error')
    );
  }
);


// Handle 401 — clear auth state and redirect.

let redirecting = false;

function handleSessionExpired(): void {
  if (redirecting) return;
  redirecting = true;

  // Dynamic import avoids circular dependency
  import('@/stores/auth.store').then(({ useAuthStore }) => {
    const state = useAuthStore.getState();
    if (state.isAuthenticated) {
      state.logout();
      // Use a microtask to avoid React state update during render
      queueMicrotask(() => {
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        redirecting = false;
      });
    } else {
      redirecting = false;
    }
  }).catch(() => {
    // Fallback if dynamic import fails
    localStorage.removeItem('auth-storage');
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    redirecting = false;
  });
}

export default api;

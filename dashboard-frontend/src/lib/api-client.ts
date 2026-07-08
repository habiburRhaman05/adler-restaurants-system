import type { AxiosRequestConfig } from 'axios';
import type { ZodType } from 'zod';
import api, { type ApiEnvelope } from './axios';

interface ApiRequestConfig<T> extends AxiosRequestConfig {
  schema?: ZodType<T>;
}

/**
 * Execute an API request. The backend always returns a
 * { success, message, data, statusCode } envelope — this unwraps `data`.
 * If a schema is provided, the unwrapped data is validated at runtime.
 */
async function request<T>(config: ApiRequestConfig<T>): Promise<T> {
  const response = await api.request<ApiEnvelope<T>>(config);

  // Unwrap the envelope. Fall back to raw body if a plain response is returned.
  const body = response.data;
  const payload =
    body && typeof body === 'object' && 'data' in body ? body.data : (body as unknown as T);

  if (config.schema) {
    return config.schema.parse(payload);
  }

  return payload as T;
}

/** Type-safe API client with Zod runtime validation */
export const apiClient = {
  get: <T>(url: string, config?: Omit<ApiRequestConfig<T>, 'method' | 'url'>) =>
    request<T>({ ...config, method: 'GET', url }),

  post: <T>(
    url: string,
    data?: unknown,
    config?: Omit<ApiRequestConfig<T>, 'method' | 'url' | 'data'>
  ) => request<T>({ ...config, method: 'POST', url, data }),

  put: <T>(
    url: string,
    data?: unknown,
    config?: Omit<ApiRequestConfig<T>, 'method' | 'url' | 'data'>
  ) => request<T>({ ...config, method: 'PUT', url, data }),

  patch: <T>(
    url: string,
    data?: unknown,
    config?: Omit<ApiRequestConfig<T>, 'method' | 'url' | 'data'>
  ) => request<T>({ ...config, method: 'PATCH', url, data }),

  delete: <T>(url: string, config?: Omit<ApiRequestConfig<T>, 'method' | 'url'>) =>
    request<T>({ ...config, method: 'DELETE', url }),
};

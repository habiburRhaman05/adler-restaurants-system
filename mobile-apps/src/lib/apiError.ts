import { AxiosError } from 'axios';

/**
 * The backend uses two error envelopes:
 *  - errorHandler:     { success: false, message: string }          (4xx / 5xx)
 *  - validateRequest:  { success: false, errors: ZodIssue[] }       (400)
 */
type ErrorBody = {
  message?: string;
  errors?: Array<{ message?: string; path?: (string | number)[] }> | string;
};

function statusFallback(status: number | undefined): string | null {
  if (!status) return null;
  if (status === 401) return 'Your session has expired. Please log in again.';
  if (status === 403) return 'You do not have permission to perform this action.';
  if (status === 400 || status === 422) return 'Some of the submitted data is invalid.';
  if (status >= 500) return 'The server ran into a problem. Please try again shortly.';
  return null;
}

/** Extract a user-friendly message from any API error, with sane fallbacks. */
export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof AxiosError) {
    const body = error.response?.data as ErrorBody | undefined;

    if (body?.message) return body.message;

    // Zod validation failures arrive as an `errors` array without a message.
    if (Array.isArray(body?.errors)) {
      const first = body.errors.find((e) => e?.message);
      if (first?.message) {
        const field = first.path?.length ? String(first.path[first.path.length - 1]) : '';
        return field ? `${field}: ${first.message}` : first.message;
      }
    }
    if (typeof body?.errors === 'string') return body.errors;

    const byStatus = statusFallback(error.response?.status);
    if (byStatus) return byStatus;

    if (error.code === 'ERR_NETWORK') return 'Unable to connect to the server. Check your internet connection.';
    if (error.code === 'ECONNABORTED') return 'Request timed out. Please try again.';
  }
  return fallback;
}

/** True when the failure is a client-side (4xx) response — retrying won't help. */
export function isClientError(error: unknown): boolean {
  return (
    error instanceof AxiosError &&
    error.response !== undefined &&
    error.response.status >= 400 &&
    error.response.status < 500
  );
}

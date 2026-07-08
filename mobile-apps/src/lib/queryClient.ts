import { QueryClient } from "@tanstack/react-query";
import { isClientError } from "./apiError";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 4xx responses (auth, permission, validation, not-found) are stable —
      // retrying only delays the error state. Network/5xx get two retries.
      retry: (failureCount, error) => !isClientError(error) && failureCount < 2,
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30,   // 30 minutes
    },
    mutations: {
      // Never auto-retry mutations: a timed-out submit may have succeeded
      // server-side, and a retry would duplicate it.
      retry: false,
    },
  },
});

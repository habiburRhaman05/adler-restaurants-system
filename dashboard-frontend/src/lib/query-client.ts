import { QueryClient, type DefaultOptions } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from './axios';

const queryConfig: DefaultOptions = {
  queries: {
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        return false;
      }
      return failureCount < 3;
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  },
  mutations: {
    onError: (error) => {
      const message =
        error instanceof ApiError ? error.message : 'An unexpected error occurred';
      toast.error(message);
    },
  },
};

export const queryClient = new QueryClient({ defaultOptions: queryConfig });

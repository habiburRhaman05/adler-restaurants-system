import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from '@/lib/axios';
import {
  scheduleSwapService,
  type ScheduleSwap,
  type ScheduleSwapFilters,
  type ScheduleSwapListResult,
} from '../api/schedule-swap.service';

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const scheduleSwapKeys = {
  all: ['schedule-swaps'] as const,
  lists: () => [...scheduleSwapKeys.all, 'list'] as const,
  list: (filters: ScheduleSwapFilters) => [...scheduleSwapKeys.lists(), filters] as const,
};

// ─── Queries ────────────────────────────────────────────────────────────────

export function useScheduleSwaps(filters: ScheduleSwapFilters = {}): UseQueryResult<ScheduleSwapListResult> {
  return useQuery({
    queryKey: scheduleSwapKeys.list(filters),
    queryFn: () => scheduleSwapService.getAll(filters),
    refetchInterval: 60_000, // approval queue should stay fresh without a manual reload
  });
}

/** Lightweight count of swaps awaiting admin approval (sidebar badge / overview). */
export function usePendingScheduleSwapCount(): { count: number; isLoading: boolean; isError: boolean } {
  const query = useScheduleSwaps({ status: 'PENDING_ADMIN_APPROVAL', limit: 1 });
  return {
    count: query.data?.pagination?.total ?? query.data?.swaps.length ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

// ─── Mutations ──────────────────────────────────────────────────────────────

// Approval exchanges the two shifts' owners on the published roster, so the
// Schedule page caches are stale afterwards — invalidate them alongside our own.
function invalidateAfterReview(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: scheduleSwapKeys.all });
  qc.invalidateQueries({ queryKey: ['schedule'] });
  qc.invalidateQueries({ queryKey: ['schedule-detail'] });
}

const reviewErrorMessage = (error: Error, fallback: string) =>
  error instanceof ApiError && error.status === 409
    ? error.message // e.g. "One of the shifts has changed since this swap was requested…"
    : fallback;

export function useApproveScheduleSwap(): UseMutationResult<{ swap: ScheduleSwap }, Error, { swapId: string; reason?: string }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ swapId, reason }) => scheduleSwapService.approve(swapId, reason),
    onSuccess: () => {
      invalidateAfterReview(qc);
      toast.success('Swap approved — the two shifts have been exchanged');
    },
    onError: (error) => {
      qc.invalidateQueries({ queryKey: scheduleSwapKeys.all }); // a 409 means the queue is stale
      toast.error(reviewErrorMessage(error, 'Failed to approve swap'));
    },
  });
}

export function useRejectScheduleSwap(): UseMutationResult<{ swap: ScheduleSwap }, Error, { swapId: string; reason?: string }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ swapId, reason }) => scheduleSwapService.reject(swapId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: scheduleSwapKeys.all });
      toast.success('Swap rejected — both employees were notified');
    },
    onError: (error) => {
      qc.invalidateQueries({ queryKey: scheduleSwapKeys.all });
      toast.error(reviewErrorMessage(error, 'Failed to reject swap'));
    },
  });
}

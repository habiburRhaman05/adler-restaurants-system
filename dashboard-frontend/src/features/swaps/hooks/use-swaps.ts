import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query';
import { toast } from 'sonner';
import { swapService, type Swap, type SwapFilters, type SwapListResponse } from '../api/swap.service';

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const swapKeys = {
  all: ['swaps'] as const,
  lists: () => [...swapKeys.all, 'list'] as const,
  list: (filters: SwapFilters) => [...swapKeys.lists(), filters] as const,
};

// ─── Queries ────────────────────────────────────────────────────────────────

export function useSwaps(filters: SwapFilters = {}): UseQueryResult<SwapListResponse> {
  return useQuery({
    queryKey: swapKeys.list(filters),
    queryFn: () => swapService.getAll(filters),
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export function useApproveSwap(): UseMutationResult<{ data: { swap: Swap } }, Error, { swapId: string; note?: string }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ swapId, note }) => swapService.approve(swapId, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: swapKeys.lists() });
      toast.success('Swap approved successfully');
    },
    onError: () => {
      toast.error('Failed to approve swap');
    },
  });
}

export function useRejectSwap(): UseMutationResult<{ data: { swap: Swap } }, Error, { swapId: string; note?: string }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ swapId, note }) => swapService.reject(swapId, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: swapKeys.lists() });
      toast.success('Swap rejected');
    },
    onError: () => {
      toast.error('Failed to reject swap');
    },
  });
}

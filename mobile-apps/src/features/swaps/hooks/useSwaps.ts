import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { scheduleKeys } from '../../schedule/hooks/useMyShifts';
import { cancelSwap, createSwap, fetchSwaps, respondToSwap, searchSwapTargets } from '../api/swaps.api';
import type { CreateSwapPayload, RespondSwapAction } from '../schema';

export const swapKeys = {
  all: ['swaps'] as const,
  targets: (date: string) => ['swaps', 'targets', date] as const,
};

export function useSwaps() {
  return useQuery({
    queryKey: swapKeys.all,
    queryFn: fetchSwaps,
  });
}

/** Colleagues' swappable shifts on a given day (only fetched when a day is chosen). */
export function useSwapTargets(date: string | null) {
  return useQuery({
    queryKey: swapKeys.targets(date ?? ''),
    queryFn: () => searchSwapTargets(date!),
    enabled: date !== null,
  });
}

export function useCreateSwap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSwapPayload) => createSwap(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: swapKeys.all });
    },
  });
}

export function useRespondToSwap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ swapId, action }: { swapId: string; action: RespondSwapAction }) =>
      respondToSwap(swapId, action),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: swapKeys.all });
    },
  });
}

export function useCancelSwap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: cancelSwap,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: swapKeys.all });
      // An approved/cancelled swap can change my roster, so refresh it too.
      qc.invalidateQueries({ queryKey: scheduleKeys.all });
    },
  });
}

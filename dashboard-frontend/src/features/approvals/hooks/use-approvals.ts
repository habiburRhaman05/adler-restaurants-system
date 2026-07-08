import { useSwaps } from '@/features/swaps/hooks/use-swaps';
import { useShiftApprovalsFeed } from '@/features/shifts/hooks/use-shifts';
import { usePendingScheduleSwapCount } from '@/features/schedule-swaps/hooks/use-schedule-swaps';

interface ApprovalsFilters {
  status?: 'pending';
}

interface ApprovalsSummary {
  total: number;
  swapsPending: number;
  scheduleSwapsPending: number;
  shiftsPending: number;
}

/**
 * Combines pending roster swap requests (/admin/schedule-swaps), pending offer swaps (§8)
 * and pending shift-offer approvals (§7) into a single count for the "Shift Approvals"
 * sidebar badge. There's no single backend endpoint for this, so it reuses the same
 * lightweight queries the Approvals page itself makes.
 */
export function useApprovals({ status }: ApprovalsFilters = {}) {
  const swapsQuery = useSwaps(status === 'pending' ? { status: 'PENDING' } : {});
  const shiftsQuery = useShiftApprovalsFeed(status === 'pending' ? { pendingOnly: true, limit: 100 } : {});
  const scheduleSwaps = usePendingScheduleSwapCount();

  const swapsPending = swapsQuery.data?.meta?.pagination?.total ?? swapsQuery.data?.data?.swaps?.length ?? 0;
  const scheduleSwapsPending = scheduleSwaps.count;
  const shiftsPending = (shiftsQuery.data?.data?.shifts ?? []).reduce(
    (sum, shift) => sum + (shift.pendingApprovalCount ?? 0),
    0
  );

  const data: ApprovalsSummary = {
    total: swapsPending + scheduleSwapsPending + shiftsPending,
    swapsPending,
    scheduleSwapsPending,
    shiftsPending,
  };

  return {
    data,
    isLoading: swapsQuery.isLoading || shiftsQuery.isLoading || scheduleSwaps.isLoading,
    isError: swapsQuery.isError || shiftsQuery.isError || scheduleSwaps.isError,
  };
}

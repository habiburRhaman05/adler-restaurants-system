import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchMyHours, fetchMySchedule, respondToShift } from '../api/schedule.api';
import type { RespondShiftPayload } from '../schema';

export const scheduleKeys = {
  all: ['schedule'] as const,
  month: (month: string) => ['schedule', month] as const,
  hours: (month: string) => ['schedule', 'hours', month] as const,
};

/** The logged-in staff member's published schedule for a YYYY-MM month. */
export function useMySchedule(month: string) {
  return useQuery({
    queryKey: scheduleKeys.month(month),
    queryFn: () => fetchMySchedule(month),
  });
}

/** Accept / reject an assigned shift; refreshes schedule + hours on success. */
export function useRespondToShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RespondShiftPayload) => respondToShift(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
    },
  });
}

/** Worked/planned hours for the Analysis tab. */
export function useMyHours(month: string) {
  return useQuery({
    queryKey: scheduleKeys.hours(month),
    queryFn: () => fetchMyHours(month),
  });
}

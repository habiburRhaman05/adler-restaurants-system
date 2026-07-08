import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  breakEnd,
  breakStart,
  clockIn,
  clockOut,
  fetchAttendanceHistory,
  fetchCurrentAttendance,
} from '../api/attendance.api';
import type { ClockInPayload, CurrentAttendance } from '../schema';

export const attendanceKeys = {
  current: ['attendance', 'current'] as const,
  history: (month: string) => ['attendance', 'history', month] as const,
};

export function useCurrentAttendance() {
  return useQuery({
    queryKey: attendanceKeys.current,
    queryFn: fetchCurrentAttendance,
    // Keep the live timer roughly in sync while the screen is open.
    refetchInterval: 60_000,
  });
}

export function useAttendanceHistory(month: string) {
  return useQuery({
    queryKey: attendanceKeys.history(month),
    queryFn: () => fetchAttendanceHistory(month),
  });
}

function useEntryMutation<TArgs, TResult>(mutationFn: (args: TArgs) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance'] });
    },
  });
}

export function useClockIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ClockInPayload = {}) => clockIn(payload),
    onSuccess: (entry) => {
      qc.setQueryData<CurrentAttendance>(attendanceKeys.current, { active: true, entry });
      qc.invalidateQueries({ queryKey: ['attendance'] });
    },
  });
}

export function useClockOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (note?: string) => clockOut(note),
    onSuccess: () => {
      qc.setQueryData<CurrentAttendance>(attendanceKeys.current, { active: false, entry: null });
      qc.invalidateQueries({ queryKey: ['attendance'] });
    },
  });
}

export function useBreakStart() {
  return useEntryMutation(() => breakStart());
}

export function useBreakEnd() {
  return useEntryMutation(() => breakEnd());
}

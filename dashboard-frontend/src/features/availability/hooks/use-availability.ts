import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from '@/lib/axios';
import { availabilityService } from '../api/availability.service';

export const availabilityKeys = {
  all: ['admin-availability'] as const,
  grid: (year: number, month: number) => [...availabilityKeys.all, 'grid', year, month] as const,
};

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiError && error.message ? error.message : fallback;

export function useAvailabilityGrid(year: number, month: number) {
  return useQuery({
    queryKey: availabilityKeys.grid(year, month),
    queryFn: () => availabilityService.getGrid(year, month),
  });
}

export function useOpenAvailabilityMonth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ year, month, cutoffAt }: { year: number; month: number; cutoffAt: string }) =>
      availabilityService.openMonth(year, month, cutoffAt),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: availabilityKeys.all });
      toast.success(`Availability opened for ${result.opened} employee(s)`, {
        description: 'Every active employee can now submit their availability for this month.',
      });
    },
    onError: (error) => {
      toast.error('Could not open the month', {
        description: errorMessage(error, 'Please try again.'),
      });
    },
  });
}

export function useNudgeEmployee() {
  return useMutation({
    mutationFn: ({ userId, year, month }: { userId: string; year: number; month: number }) =>
      availabilityService.nudge(userId, year, month),
    onSuccess: () => toast.success('Reminder sent to the employee'),
    onError: (error) => {
      toast.error('Could not send reminder', {
        description: errorMessage(error, 'Please try again.'),
      });
    },
  });
}

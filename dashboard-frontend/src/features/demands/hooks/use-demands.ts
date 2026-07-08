import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  demandService,
  type CreateWeekInput,
  type SaveWeekInput,
  type SaveCellInput,
} from '../api/demand.service';

export const demandKeys = {
  all: ['demands'] as const,
  grid: (scope?: string, date?: string) => [...demandKeys.all, 'grid', { scope, date }] as const,
  weeks: () => [...demandKeys.all, 'weeks'] as const,
  week: (id: string) => [...demandKeys.all, 'week', id] as const,
};

export function useDemandGrid(scope?: string, date?: string) {
  return useQuery({
    queryKey: demandKeys.grid(scope, date),
    queryFn: () => demandService.getGrid({ scope, date }),
    placeholderData: keepPreviousData,
  });
}

export function useDemandWeeks() {
  return useQuery({
    queryKey: demandKeys.weeks(),
    queryFn: () => demandService.getWeeks(),
  });
}

export function useCreateDemandWeek() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateWeekInput) => demandService.createWeek(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: demandKeys.all });
      toast.success('Demand week created successfully');
    },
    onError: (error: any) => {
      const msg = error?.message || 'Failed to create demand week.';
      toast.error(msg);
    },
  });
}

export function useSaveDemandWeek() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ weekId, data }: { weekId: string; data: SaveWeekInput }) =>
      demandService.saveWeek(weekId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: demandKeys.all });
      toast.success('Demand week saved successfully');
    },
    onError: (error: any) => {
      const msg = error?.message || 'Failed to save demand week.';
      toast.error(msg);
    },
  });
}

export function useUpdateDemandCell() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ weekId, data }: { weekId: string; data: SaveCellInput }) =>
      demandService.updateCell(weekId, data),
    onSuccess: () => {
      // Invalidate the grid to fetch the updated state, or we could optimistically update
      qc.invalidateQueries({ queryKey: demandKeys.all });
    },
    onError: (error: any) => {
      const msg = error?.message || 'Failed to update demand cell.';
      toast.error(msg);
    },
  });
}

export function usePublishDemandWeek() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (weekId: string) => demandService.publishWeek(weekId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: demandKeys.all });
      toast.success('Demand week published successfully');
    },
    onError: (error: any) => {
      const msg = error?.message || 'Failed to publish demand week.';
      toast.error(msg);
    },
  });
}

export function useDeleteDemandWeek() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (weekId: string) => demandService.deleteWeek(weekId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: demandKeys.all });
      toast.success('Demand week deleted successfully');
    },
    onError: (error: any) => {
      const msg = error?.message || 'Failed to delete demand week.';
      toast.error(msg);
    },
  });
}

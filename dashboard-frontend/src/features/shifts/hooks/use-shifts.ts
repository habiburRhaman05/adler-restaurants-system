import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  shiftService, 
  type Shift, 
  type ShiftInput, 
  type ShiftFilters, 
  type ShiftListResponse,
  type ShiftApprovalsFeedResponse,
  type ShiftResponsesResponse,
  type Volunteer
} from '../api/shift.service';

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const shiftKeys = {
  all: ['shifts'] as const,
  lists: () => [...shiftKeys.all, 'list'] as const,
  list: (filters: ShiftFilters) => [...shiftKeys.lists(), filters] as const,
  details: () => [...shiftKeys.all, 'detail'] as const,
  detail: (id: string) => [...shiftKeys.details(), id] as const,
  
  approvalsFeed: () => [...shiftKeys.all, 'approvalsFeed'] as const,
  approvalsFeedList: (filters: any) => [...shiftKeys.approvalsFeed(), filters] as const,
  
  responses: (shiftId: string) => [...shiftKeys.all, 'responses', shiftId] as const,
};

// ─── Queries ────────────────────────────────────────────────────────────────

export function useShifts(filters: ShiftFilters = {}): UseQueryResult<ShiftListResponse> {
  return useQuery({
    queryKey: shiftKeys.list(filters),
    queryFn: () => shiftService.getAll(filters),
  });
}

export function useShift(id: string): UseQueryResult<Shift> {
  return useQuery({
    queryKey: shiftKeys.detail(id),
    queryFn: () => shiftService.getById(id),
    enabled: !!id,
  });
}

export function useShiftApprovalsFeed(filters: { page?: number; limit?: number; pendingOnly?: boolean } = {}): UseQueryResult<ShiftApprovalsFeedResponse> {
  return useQuery({
    queryKey: shiftKeys.approvalsFeedList(filters),
    queryFn: () => shiftService.getApprovalsFeed(filters),
  });
}

export function useShiftResponses(shiftId: string): UseQueryResult<ShiftResponsesResponse> {
  return useQuery({
    queryKey: shiftKeys.responses(shiftId),
    queryFn: () => shiftService.getShiftResponses(shiftId),
    enabled: !!shiftId,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export function useCreateShift(): UseMutationResult<Shift, Error, ShiftInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ShiftInput) => shiftService.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shiftKeys.lists() });
      toast.success('Shift created successfully');
    },
    onError: () => {
      toast.error('Failed to create shift');
    },
  });
}

export function useUpdateShift(): UseMutationResult<Shift, Error, { id: string; data: Partial<ShiftInput> }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => shiftService.update(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: shiftKeys.lists() });
      qc.invalidateQueries({ queryKey: shiftKeys.detail(id) });
      toast.success('Shift updated successfully');
    },
    onError: () => {
      toast.error('Failed to update shift');
    },
  });
}

export function useDeleteShift(): UseMutationResult<void, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => shiftService.remove(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: shiftKeys.lists() });
      qc.removeQueries({ queryKey: shiftKeys.detail(id) });
      toast.success('Shift deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete shift');
    },
  });
}

export function useNotifyShift(): UseMutationResult<{ success: boolean; message: string; data: { shift: Shift; notifiedCount: number } }, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => shiftService.notify(id),
    onSuccess: (res, id) => {
      qc.invalidateQueries({ queryKey: shiftKeys.lists() });
      qc.invalidateQueries({ queryKey: shiftKeys.detail(id) });
      toast.success(res.message || 'Notification sent');
    },
    onError: () => {
      toast.error('Failed to notify employees');
    },
  });
}

export function useApproveResponse(): UseMutationResult<{ data: { response: Volunteer } }, Error, { shiftId: string; responseId: string }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ shiftId, responseId }) => shiftService.approveResponse(shiftId, responseId),
    onSuccess: (_, { shiftId }) => {
      qc.invalidateQueries({ queryKey: shiftKeys.responses(shiftId) });
      qc.invalidateQueries({ queryKey: shiftKeys.approvalsFeed() });
      toast.success('Response approved');
    },
    onError: () => {
      toast.error('Failed to approve response');
    },
  });
}

export function useRejectResponse(): UseMutationResult<{ data: { response: Volunteer } }, Error, { shiftId: string; responseId: string; note?: string }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ shiftId, responseId, note }) => shiftService.rejectResponse(shiftId, responseId, note),
    onSuccess: (_, { shiftId }) => {
      qc.invalidateQueries({ queryKey: shiftKeys.responses(shiftId) });
      qc.invalidateQueries({ queryKey: shiftKeys.approvalsFeed() });
      toast.success('Response rejected');
    },
    onError: () => {
      toast.error('Failed to reject response');
    },
  });
}

import { getApiErrorMessage } from '@/lib/apiError';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { cancelLeave, createLeave, fetchMyLeaves, type CreateLeavePayload } from '../api/leaves.api';

export const leavesKeys = {
  all: ['leaves'] as const,
};

export function useMyLeaves() {
  return useQuery({
    queryKey: leavesKeys.all,
    queryFn: fetchMyLeaves,
  });
}

export function useCreateLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateLeavePayload) => createLeave(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: leavesKeys.all }),
    onError: (e) => Alert.alert('Could not submit', getApiErrorMessage(e)),
  });
}

export function useCancelLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelLeave,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: leavesKeys.all }),
    onError: (e) => Alert.alert('Could not cancel', getApiErrorMessage(e)),
  });
}

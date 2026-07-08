import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAvailability, saveAvailability, submitAvailability } from '../api/availability.api';
import type { AvailabilityResponse, SaveAvailabilityPayload } from '../schema';

export const availabilityKeys = {
  all: ['availability'] as const,
  month: (month: string) => ['availability', month] as const,
};

export function useAvailability(month: string) {
  return useQuery({
    queryKey: availabilityKeys.month(month),
    queryFn: () => fetchAvailability(month),
  });
}

export function useSaveAvailability(month: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveAvailabilityPayload) => saveAvailability(payload),
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: availabilityKeys.month(month) });
      const previous = qc.getQueryData<AvailabilityResponse>(availabilityKeys.month(month));
      if (previous?.availability) {
        const updated: AvailabilityResponse = {
          availability: {
            ...previous.availability,
            days: payload.days,
            times: payload.times,
            note: payload.note,
          },
        };
        qc.setQueryData(availabilityKeys.month(month), updated);
      }
      return { previous };
    },
    onError: (_err, _payload, ctx) => {
      if (ctx?.previous) qc.setQueryData(availabilityKeys.month(month), ctx.previous);
    },
    onSuccess: (availability) => {
      qc.setQueryData<AvailabilityResponse>(availabilityKeys.month(month), { availability });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: availabilityKeys.month(month) });
    },
  });
}

export function useSubmitAvailability(month: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => submitAvailability(month),
    onSuccess: (availability) => {
      qc.setQueryData<AvailabilityResponse>(availabilityKeys.month(month), { availability });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: availabilityKeys.month(month) });
    },
  });
}

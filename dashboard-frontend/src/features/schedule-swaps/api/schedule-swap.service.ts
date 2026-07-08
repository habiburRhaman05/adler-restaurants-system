import { z } from 'zod';
import api from '@/lib/axios';
import { apiClient } from '@/lib/api-client';
import { buildQuery } from '@/types';

// Mirrors backend/src/modules/admin/schedule-swaps (SwapRequest + scheduleSwapSelect).
// This is the roster-shift swap system the mobile app creates requests on
// (POST /schedule-swaps) — distinct from the ShiftOffer-based /admin/swaps queue.

// ─── Schemas ────────────────────────────────────────────────────────────────

export const scheduleSwapStatusSchema = z.enum([
  'PENDING_RECIPIENT',
  'PENDING_ADMIN_APPROVAL',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'CANCELLED',
]);
export type ScheduleSwapStatus = z.infer<typeof scheduleSwapStatusSchema>;

const swapUserSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  firstName: z.string().nullish(),
  lastName: z.string().nullish(),
  email: z.string(),
});
export type ScheduleSwapUser = z.infer<typeof swapUserSchema>;

const swapShiftSchema = z.object({
  id: z.string(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  status: z.string(),
  category: z.object({ id: z.string(), name: z.string() }).nullish(),
});
export type ScheduleSwapShift = z.infer<typeof swapShiftSchema>;

// Advisory L-GAV rule check stored on the swap (JSON column — stay lenient).
const ruleCheckSchema = z
  .object({ passed: z.boolean(), violations: z.array(z.string()) })
  .nullish()
  .catch(null);

export const scheduleSwapSchema = z.object({
  id: z.string(),
  swapType: z.string(),
  initiatorUserId: z.string(),
  initiatorUser: swapUserSchema.nullish(),
  initiatorShiftId: z.string().nullish(),
  initiatorShift: swapShiftSchema.nullish(),
  recipientUserId: z.string().nullish(),
  recipientUser: swapUserSchema.nullish(),
  recipientShiftId: z.string().nullish(),
  recipientShift: swapShiftSchema.nullish(),
  status: scheduleSwapStatusSchema,
  recipientRespondedAt: z.string().nullish(),
  ruleCheckResult: ruleCheckSchema,
  ruleCheckPassed: z.boolean().nullish(),
  adminReason: z.string().nullish(),
  resolvedAt: z.string().nullish(),
  expiresAt: z.string().nullish(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ScheduleSwap = z.infer<typeof scheduleSwapSchema>;

const paginationSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
});
export type ScheduleSwapPagination = z.infer<typeof paginationSchema>;

// The list endpoint reports its total in the envelope's `meta.pagination`,
// which apiClient strips — so this one call parses the full envelope itself.
const listEnvelopeSchema = z.object({
  data: z.object({ swaps: z.array(scheduleSwapSchema) }),
  meta: z.object({ pagination: paginationSchema }).nullish(),
});

const reviewResponseSchema = z.object({ swap: scheduleSwapSchema });

export interface ScheduleSwapFilters {
  page?: number;
  limit?: number;
  status?: ScheduleSwapStatus;
}

export interface ScheduleSwapListResult {
  swaps: ScheduleSwap[];
  pagination: ScheduleSwapPagination | null;
}

// ─── Service ────────────────────────────────────────────────────────────────

export const scheduleSwapService = {
  getAll: async (filters: ScheduleSwapFilters = {}): Promise<ScheduleSwapListResult> => {
    const res = await api.get(`/admin/schedule-swaps${buildQuery(filters)}`);
    const parsed = listEnvelopeSchema.parse(res.data);
    return { swaps: parsed.data.swaps, pagination: parsed.meta?.pagination ?? null };
  },

  approve: (swapId: string, reason?: string): Promise<{ swap: ScheduleSwap }> =>
    apiClient.post(
      `/admin/schedule-swaps/${swapId}/approve`,
      reason ? { reason } : {},
      { schema: reviewResponseSchema }
    ),

  reject: (swapId: string, reason?: string): Promise<{ swap: ScheduleSwap }> =>
    apiClient.post(
      `/admin/schedule-swaps/${swapId}/reject`,
      reason ? { reason } : {},
      { schema: reviewResponseSchema }
    ),
};

/** "Anna M." style display name matching the backend's displayName helper. */
export function scheduleSwapUserName(u: ScheduleSwapUser | null | undefined): string {
  if (!u) return 'Employee';
  return u.name ?? ([u.firstName, u.lastName].filter(Boolean).join(' ') || u.email);
}

import { z } from 'zod';

// Mirrors backend/src/modules/user/schedule-swaps (SwapRequest + scheduleSwapSelect).

export const swapStatusSchema = z.enum([
  'PENDING_RECIPIENT',
  'PENDING_ADMIN_APPROVAL',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'CANCELLED',
]);
export type SwapStatus = z.infer<typeof swapStatusSchema>;

export const swapUserSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  firstName: z.string().nullish(),
  lastName: z.string().nullish(),
  email: z.string(),
});
export type SwapUser = z.infer<typeof swapUserSchema>;

export const swapShiftSchema = z.object({
  id: z.string(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  status: z.string(),
  category: z.object({ id: z.string(), name: z.string() }).nullish(),
});
export type SwapShift = z.infer<typeof swapShiftSchema>;

// Advisory L-GAV rule check stored on the swap (JSON column — stay lenient).
const ruleCheckSchema = z
  .object({ passed: z.boolean(), violations: z.array(z.string()) })
  .nullish()
  .catch(null);

export const swapRequestSchema = z.object({
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
  status: swapStatusSchema,
  recipientRespondedAt: z.string().nullish(),
  ruleCheckResult: ruleCheckSchema,
  ruleCheckPassed: z.boolean().nullish(),
  adminReason: z.string().nullish(),
  resolvedAt: z.string().nullish(),
  expiresAt: z.string().nullish(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SwapRequest = z.infer<typeof swapRequestSchema>;

export type SwapsResponse = {
  incoming: SwapRequest[];
  outgoing: SwapRequest[];
};

/** GET /schedule-swaps/search — a colleague's swappable shift on a day. */
export const swapTargetSchema = swapShiftSchema.extend({
  userId: z.string(),
  user: swapUserSchema,
});
export type SwapTarget = z.infer<typeof swapTargetSchema>;

export const searchTargetsResponseSchema = z.object({
  date: z.string(),
  shifts: z.array(swapTargetSchema),
});
export type SearchTargetsResponse = z.infer<typeof searchTargetsResponseSchema>;

/** POST /api/v1/schedule-swaps body (createScheduleSwapSchema). */
export type CreateSwapPayload = {
  initiatorShiftId: string;
  recipientUserId: string;
  recipientShiftId: string;
};

/** POST /schedule-swaps/:swapId/respond body. */
export type RespondSwapAction = 'ACCEPT' | 'DECLINE';

/** "Anna M." style display name matching the backend's displayName helper. */
export function swapUserName(u: SwapUser | null | undefined): string {
  if (!u) return 'Colleague';
  return u.name ?? ([u.firstName, u.lastName].filter(Boolean).join(' ') || u.email);
}

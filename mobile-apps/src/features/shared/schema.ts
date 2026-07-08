import { z } from 'zod';

/**
 * Every backend response uses the same envelope: { success, message, data }
 * (see backend/src/utils/apiResponse.ts). Feature api modules parse responses
 * through `apiEnvelope(schema)` so any contract drift fails loudly at the
 * boundary instead of corrupting the UI.
 */
export function apiEnvelope<T extends z.ZodType>(data: T) {
  return z.object({
    success: z.boolean(),
    message: z.string(),
    data,
  });
}

/** Structured rule-check result — reused by swaps now, planner later. */
export const ruleCheckResultSchema = z.object({
  ruleId: z.string(),
  pass: z.boolean(),
  message: z.string(),
});

export type RuleCheckResult = z.infer<typeof ruleCheckResultSchema>;

export const userLiteSchema = z.object({
  id: z.string(),
  email: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
});

export type UserLite = z.infer<typeof userLiteSchema>;

/** 'YYYY-MM' month key used by every scheduling endpoint. */
export const monthKeySchema = z.string().regex(/^\d{4}-\d{2}$/);
export type MonthKey = z.infer<typeof monthKeySchema>;

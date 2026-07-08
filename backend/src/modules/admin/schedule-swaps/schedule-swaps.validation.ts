import { z } from "zod";

export const listScheduleSwapsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum([
      "PENDING_RECIPIENT",
      "PENDING_ADMIN_APPROVAL",
      "APPROVED",
      "REJECTED",
      "EXPIRED",
      "CANCELLED",
    ])
    .optional(),
});

export const reviewScheduleSwapSchema = z.object({
  reason: z.string().trim().max(2000).optional(),
});

export type ListScheduleSwapsQuery = z.infer<typeof listScheduleSwapsQuerySchema>;
export type ReviewScheduleSwapInput = z.infer<typeof reviewScheduleSwapSchema>;

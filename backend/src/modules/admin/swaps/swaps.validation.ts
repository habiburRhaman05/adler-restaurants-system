import { z } from "zod";

export const listSwapsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]).optional(),
});

export const swapIdParamSchema = z.object({
  swapId: z.string({ required_error: "Swap ID is required" }).min(1),
});

export const reviewSwapSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

export type ListSwapsQuery = z.infer<typeof listSwapsQuerySchema>;
export type ReviewSwapInput = z.infer<typeof reviewSwapSchema>;

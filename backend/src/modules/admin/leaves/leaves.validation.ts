import { z } from "zod";

export const listLeavesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]).optional(),
  userId: z.string().min(1).optional(),
});

export const reviewLeaveSchema = z.object({
  adminNote: z.string().trim().max(2000).optional(),
});

export type ListLeavesQuery = z.infer<typeof listLeavesQuerySchema>;
export type ReviewLeaveInput = z.infer<typeof reviewLeaveSchema>;

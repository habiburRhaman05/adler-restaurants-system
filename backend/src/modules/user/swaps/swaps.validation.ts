import { z } from "zod";

export const createSwapSchema = z
  .object({
    // The caller's own confirmed shift they want to give away.
    initiatorShiftId: z.string({ required_error: "Your shift is required" }).min(1),
    // The colleague to swap with and the confirmed shift of theirs you want.
    recipientUserId: z.string({ required_error: "Recipient is required" }).min(1),
    recipientShiftId: z.string({ required_error: "Recipient shift is required" }).min(1),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((d) => d.initiatorShiftId !== d.recipientShiftId, {
    message: "You cannot swap a shift with itself.",
    path: ["recipientShiftId"],
  });

export const swapIdParamSchema = z.object({
  swapId: z.string({ required_error: "Swap ID is required" }).min(1),
});

export const listUserSwapsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]).optional(),
  role: z.enum(["initiated", "received"]).optional(),
});

export type CreateSwapInput = z.infer<typeof createSwapSchema>;
export type ListUserSwapsQuery = z.infer<typeof listUserSwapsQuerySchema>;

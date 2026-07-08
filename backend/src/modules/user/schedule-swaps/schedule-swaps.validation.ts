import { z } from "zod";

const dateString = (label: string) =>
  z
    .string({ required_error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .refine((s) => !Number.isNaN(Date.parse(s)), {
      message: `${label} must be a valid date`,
    });

export const searchSwapTargetsSchema = z.object({
  date: dateString("Date"),
  categoryId: z.string().min(1).optional(),
});

export const createScheduleSwapSchema = z.object({
  initiatorShiftId: z
    .string({ required_error: "initiatorShiftId is required" })
    .min(1, "initiatorShiftId is required"),
  recipientUserId: z
    .string({ required_error: "recipientUserId is required" })
    .min(1, "recipientUserId is required"),
  recipientShiftId: z
    .string({ required_error: "recipientShiftId is required" })
    .min(1, "recipientShiftId is required"),
});

export const listMySwapsQuerySchema = z.object({
  role: z.enum(["initiated", "received"]).optional(),
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
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const respondSwapSchema = z.object({
  action: z.enum(["ACCEPT", "DECLINE"], {
    errorMap: () => ({ message: "action must be ACCEPT or DECLINE" }),
  }),
});

export type SearchSwapTargetsQuery = z.infer<typeof searchSwapTargetsSchema>;
export type CreateScheduleSwapInput = z.infer<typeof createScheduleSwapSchema>;
export type ListMySwapsQuery = z.infer<typeof listMySwapsQuerySchema>;
export type RespondSwapInput = z.infer<typeof respondSwapSchema>;

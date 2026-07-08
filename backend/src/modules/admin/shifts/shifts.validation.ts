import { z } from "zod";

export const createShiftSchema = z
  .object({
    jobTitle: z
      .string({ required_error: "Job title is required" })
      .trim()
      .min(1, "Job title cannot be empty")
      .max(150, "Job title is too long"),
    categoryId: z.string({ required_error: "Category is required" }).min(1, "Category is required"),
    startTime: z.string({ required_error: "Shift start time is required" }).datetime({
      message: "startTime must be an ISO 8601 date-time string",
    }),
    endTime: z.string({ required_error: "Shift end time is required" }).datetime({
      message: "endTime must be an ISO 8601 date-time string",
    }),
    hourlyPrice: z
      .number({ required_error: "Hourly price is required" })
      .min(0, "Hourly price cannot be negative"),
    description: z.string().trim().max(2000).optional(),
  })
  .refine((data) => new Date(data.endTime) > new Date(data.startTime), {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });

export const updateShiftSchema = z
  .object({
    jobTitle: z.string().trim().min(1).max(150).optional(),
    categoryId: z.string().min(1).optional(),
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
    hourlyPrice: z.number().min(0).optional(),
    description: z.string().trim().max(2000).optional(),
  })
  .refine(
    (data) =>
      !(data.startTime && data.endTime) ||
      new Date(data.endTime) > new Date(data.startTime),
    { message: "endTime must be after startTime", path: ["endTime"] }
  );

export const shiftIdParamSchema = z.object({
  shiftId: z.string({ required_error: "Shift ID is required" }).min(1),
});

export const rejectResponseSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

export const listApprovalsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  pendingOnly: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),
});

export const listShiftsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  categoryId: z.string().min(1).optional(),
  notified: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),
  upcoming: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),
});

export type CreateShiftInput = z.infer<typeof createShiftSchema>;
export type UpdateShiftInput = z.infer<typeof updateShiftSchema>;
export type ListShiftsQuery = z.infer<typeof listShiftsQuerySchema>;
export type RejectResponseInput = z.infer<typeof rejectResponseSchema>;
export type ListApprovalsQuery = z.infer<typeof listApprovalsQuerySchema>;

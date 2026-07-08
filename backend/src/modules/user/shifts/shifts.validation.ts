import { z } from "zod";

export const respondToShiftSchema = z.object({
  status: z.enum(["ACCEPTED", "REJECTED"], {
    required_error: "Response status is required",
    invalid_type_error: "status must be either ACCEPTED or REJECTED",
  }),
});

export const shiftIdParamSchema = z.object({
  shiftId: z.string({ required_error: "Shift ID is required" }).min(1),
});

export const listUserShiftsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  categoryId: z.string().min(1).optional(),
  // Filter by this user's own response state.
  mine: z
    .enum(["accepted", "rejected", "pending"])
    .optional(),
  // Hide shifts that have already ended.
  upcoming: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),
});

export type RespondToShiftInput = z.infer<typeof respondToShiftSchema>;
export type ListUserShiftsQuery = z.infer<typeof listUserShiftsQuerySchema>;

import { z } from "zod";

// "YYYY-MM" month filter used by both my-shifts and my-hours.
const monthString = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "month must be in YYYY-MM format")
  .optional();

export const myShiftsQuerySchema = z.object({
  month: monthString,
});

const respondAction = z.enum(["ACCEPT", "REJECT"], {
  errorMap: () => ({ message: "action must be ACCEPT or REJECT" }),
});

export const respondShiftSchema = z.object({
  shiftId: z.string({ required_error: "shiftId is required" }).min(1, "shiftId is required"),
  action: respondAction,
  reason: z.string().trim().max(1000).optional(),
});

export const batchRespondSchema = z.object({
  responses: z
    .array(
      z.object({
        shiftId: z.string().min(1, "shiftId is required"),
        action: respondAction,
        reason: z.string().trim().max(1000).optional(),
      })
    )
    .min(1, "Provide at least one response")
    .max(100, "Too many responses in a single request"),
});

export const myHoursQuerySchema = z.object({
  month: monthString,
});

export type MyShiftsQuery = z.infer<typeof myShiftsQuerySchema>;
export type RespondShiftInput = z.infer<typeof respondShiftSchema>;
export type BatchRespondInput = z.infer<typeof batchRespondSchema>;
export type MyHoursQuery = z.infer<typeof myHoursQuerySchema>;

export const updateMyProfileSchema = z.object({
  firstName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
});

export type UpdateMyProfileInput = z.infer<typeof updateMyProfileSchema>;

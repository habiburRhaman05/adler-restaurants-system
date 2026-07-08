import { z } from "zod";

export const monthParamSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

const dayEntrySchema = z.object({
  date: z
    .string({ required_error: "date is required" })
    .refine((s) => !Number.isNaN(Date.parse(s)), "date must be a valid date"),
  status: z.enum(["AVAILABLE", "UNAVAILABLE", "WISH"], {
    required_error: "status is required",
    invalid_type_error: "status must be AVAILABLE, UNAVAILABLE or WISH",
  }),
  note: z.string().trim().max(500).optional(),
  preferredStartTime: z.string().datetime().optional(),
  preferredEndTime: z.string().datetime().optional(),
});

// year/month come from the route params; days from the body.
export const setDaysSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  days: z.array(dayEntrySchema).min(1, "Provide at least one day").max(31),
});

export type SetDaysInput = z.infer<typeof setDaysSchema>;
export type DayEntry = z.infer<typeof dayEntrySchema>;

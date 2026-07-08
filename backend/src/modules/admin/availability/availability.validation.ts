import { z } from "zod";

// Admin opens an availability window for a month (creates a slot per active staff).
export const openAvailabilitySchema = z.object({
  year: z.number({ required_error: "Year is required" }).int().min(2000).max(2100),
  month: z.number({ required_error: "Month is required" }).int().min(1).max(12),
  cutoffAt: z.string({ required_error: "Cut-off date is required" }).datetime({
    message: "cutoffAt must be an ISO 8601 date-time string",
  }),
});

// Reads year/month from the query string.
export const availabilityQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export const nudgeSchema = z.object({
  year: z.number({ required_error: "Year is required" }).int().min(2000).max(2100),
  month: z.number({ required_error: "Month is required" }).int().min(1).max(12),
});

export type OpenAvailabilityInput = z.infer<typeof openAvailabilitySchema>;
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
export type NudgeInput = z.infer<typeof nudgeSchema>;

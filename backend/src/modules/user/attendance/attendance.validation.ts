import { z } from "zod";

export const clockInSchema = z.object({
  shiftId: z.string().min(1).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  location: z.string().trim().max(500).optional(),
  note: z.string().trim().max(1000).optional(),
});

export const clockOutSchema = z.object({
  note: z.string().trim().max(1000).optional(),
});

export const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "month must be in YYYY-MM format")
    .optional(),
});

export type ClockInInput = z.infer<typeof clockInSchema>;
export type ClockOutInput = z.infer<typeof clockOutSchema>;
export type HistoryQuery = z.infer<typeof historyQuerySchema>;

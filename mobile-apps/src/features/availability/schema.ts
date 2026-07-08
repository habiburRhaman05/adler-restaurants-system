import { z } from 'zod';
import { monthKeySchema } from '../shared/schema';

// ── Backend API types (mirror user/availability module) ────────────

/** AvailabilityDay.status enum (DayAvailabilityStatus in prisma). */
export const backendDayStatusSchema = z.enum(['AVAILABLE', 'UNAVAILABLE', 'WISH']);
export type BackendDayStatus = z.infer<typeof backendDayStatusSchema>;

export const backendDayEntrySchema = z.object({
  id: z.string(),
  date: z.string(),
  status: backendDayStatusSchema,
  note: z.string().nullish(),
  preferredStartTime: z.string().nullish(),
  preferredEndTime: z.string().nullish(),
});
export type BackendDayEntry = z.infer<typeof backendDayEntrySchema>;

/** AvailabilityMonth.status enum. Only DRAFT (pre-cutoff) is editable. */
export const backendAvailabilityMonthStatusSchema = z.enum(['DRAFT', 'SUBMITTED', 'LOCKED']);
export type BackendAvailabilityMonthStatus = z.infer<typeof backendAvailabilityMonthStatusSchema>;

/** GET /api/v1/availability/:year/:month → data.availability */
export const backendAvailabilitySchema = z.object({
  id: z.string(),
  year: z.number(),
  month: z.number(),
  status: backendAvailabilityMonthStatusSchema,
  cutoffAt: z.string(),
  submittedAt: z.string().nullable(),
  days: z.array(backendDayEntrySchema),
});
export type BackendAvailability = z.infer<typeof backendAvailabilitySchema>;

/** Day entry sent in PUT /availability/:year/:month/days (setDaysSchema). */
export const saveDayEntrySchema = z.object({
  date: z.string(),
  status: backendDayStatusSchema,
  note: z.string().max(500).optional(),
  preferredStartTime: z.string().optional(),
  preferredEndTime: z.string().optional(),
});
export type SaveDayEntry = z.infer<typeof saveDayEntrySchema>;

// ── Frontend UI types ───────────────────────────────────────────────

/** Per-day state in the UI: av = AVAILABLE, no = UNAVAILABLE, wi = WISH */
export const dayStateSchema = z.enum(['av', 'no', 'wi']);
export type DayState = z.infer<typeof dayStateSchema>;

/** Time range in UI format (HH:mm) */
export const timeRangeSchema = z.object({
  start: z.string(),
  end: z.string(),
});
export type TimeRange = z.infer<typeof timeRangeSchema>;

/** Display-ready availability month. */
export const availabilitySchema = z.object({
  id: z.string(),
  month: monthKeySchema,
  /** day number ("1".."31") -> state */
  days: z.record(z.string(), dayStateSchema),
  /** day number -> preferred time range */
  times: z.record(z.string(), timeRangeSchema),
  note: z.string(),
  status: backendAvailabilityMonthStatusSchema,
  cutoffAt: z.string(),
  submittedAt: z.string().nullable(),
});
export type Availability = z.infer<typeof availabilitySchema>;

/**
 * `availability` is null when the admin has not opened the month yet
 * (backend responds 404) — in that state nothing can be created or edited.
 */
export type AvailabilityResponse = {
  availability: Availability | null;
};

/** Frontend mutation payload */
export type SaveAvailabilityPayload = {
  month: string;
  days: Record<string, DayState>;
  times: Record<string, TimeRange>;
  note: string;
};

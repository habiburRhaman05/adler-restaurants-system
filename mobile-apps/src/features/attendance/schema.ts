import { z } from 'zod';

// Mirrors backend/src/modules/user/attendance (TimeEntry + entrySelect).

export const timeEntryStatusSchema = z.enum(['ACTIVE', 'ON_BREAK', 'COMPLETED']);
export type TimeEntryStatus = z.infer<typeof timeEntryStatusSchema>;

export const timeEntrySchema = z.object({
  id: z.string(),
  shiftId: z.string().nullish(),
  shift: z
    .object({
      id: z.string(),
      date: z.string(),
      startTime: z.string(),
      endTime: z.string(),
      category: z.object({ id: z.string(), name: z.string() }).nullish(),
    })
    .nullish(),
  clockInAt: z.string(),
  clockOutAt: z.string().nullish(),
  breakStartedAt: z.string().nullish(),
  breakMinutes: z.number(),
  location: z.string().nullish(),
  status: timeEntryStatusSchema,
  workedMinutes: z.number().nullish(),
  lateMinutes: z.number().nullish(),
  overtimeMinutes: z.number().nullish(),
  note: z.string().nullish(),
  createdAt: z.string(),
  // Live counters, present on current/clock-in/break responses.
  elapsedSeconds: z.number().optional(),
  breakSeconds: z.number().optional(),
  workedSeconds: z.number().optional(),
});
export type TimeEntry = z.infer<typeof timeEntrySchema>;

/** GET /api/v1/attendance/current → { active, entry } */
export const currentAttendanceSchema = z.object({
  active: z.boolean(),
  entry: timeEntrySchema.nullable(),
});
export type CurrentAttendance = z.infer<typeof currentAttendanceSchema>;

/** POST /api/v1/attendance/clock-out → { entry, summary } */
export const clockOutSummarySchema = z.object({
  workedHours: z.number(),
  workedMinutes: z.number(),
  breakMinutes: z.number(),
  lateMinutes: z.number(),
  overtimeMinutes: z.number(),
});
export type ClockOutSummary = z.infer<typeof clockOutSummarySchema>;

export const clockOutResponseSchema = z.object({
  entry: timeEntrySchema,
  summary: clockOutSummarySchema,
});
export type ClockOutResponse = z.infer<typeof clockOutResponseSchema>;

/** POST /api/v1/attendance/clock-in body (clockInSchema on the backend). */
export type ClockInPayload = {
  shiftId?: string;
  latitude?: number;
  longitude?: number;
  location?: string;
  note?: string;
};

/** GET /api/v1/attendance/history → { entries, totals } */
export const historyTotalsSchema = z.object({
  workedMinutes: z.number(),
  breakMinutes: z.number(),
  lateCount: z.number(),
  workedHours: z.number(),
});
export type HistoryTotals = z.infer<typeof historyTotalsSchema>;

export const attendanceHistorySchema = z.object({
  entries: z.array(timeEntrySchema),
  totals: historyTotalsSchema,
});
export type AttendanceHistory = z.infer<typeof attendanceHistorySchema>;

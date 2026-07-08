import { z } from 'zod';
import { monthKeySchema } from '../shared/schema';

// ── Backend enums (mirror backend/src/generated/prisma/enums.ts) ────

/** WeeklyPlan.status — staff only ever receive PUBLISHED plans. */
export const planStatusSchema = z.enum(['DRAFT', 'SUBMITTED', 'PUBLISHED']);
export type PlanStatus = z.infer<typeof planStatusSchema>;

/** Shift.status — CANCELLED / SWAPPED_OUT are filtered out server-side. */
export const shiftStatusSchema = z.enum(['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'SWAPPED_OUT']);
export type ShiftStatus = z.infer<typeof shiftStatusSchema>;

// ── GET /api/v1/me/shifts response (me.service.ts → getMyShifts) ────

export const backendShiftSchema = z.object({
  id: z.string(),
  weeklyPlanId: z.string(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  status: shiftStatusSchema,
  rejectionReason: z.string().nullish(),
  actualStartTime: z.string().nullish(),
  actualEndTime: z.string().nullish(),
  actualBreakMinutes: z.number().nullish(),
  category: z.object({ id: z.string(), name: z.string() }),
  weeklyPlan: z.object({
    status: planStatusSchema,
    weekStartDate: z.string(),
    weekEndDate: z.string(),
  }),
});
export type BackendShift = z.infer<typeof backendShiftSchema>;

export const myShiftsResponseSchema = z.object({
  month: monthKeySchema,
  status: z.literal('published'),
  // True when a plan overlapping the month exists but is not published yet —
  // lets the UI distinguish "still being planned" from "no shifts at all".
  hasUnpublishedPlan: z.boolean(),
  shifts: z.array(backendShiftSchema),
});
export type MyShiftsResponse = z.infer<typeof myShiftsResponseSchema>;

// ── POST /api/v1/me/shifts/respond body (me.validation.ts) ─────────

export const respondActionSchema = z.enum(['ACCEPT', 'REJECT']);
export type RespondAction = z.infer<typeof respondActionSchema>;

export const respondShiftPayloadSchema = z.object({
  shiftId: z.string().min(1),
  action: respondActionSchema,
  reason: z.string().trim().max(1000).optional(),
});
export type RespondShiftPayload = z.infer<typeof respondShiftPayloadSchema>;

// ── GET /api/v1/me/hours response (me.service.ts → getMyHours) ─────

export const myHoursEntrySchema = z.object({
  shiftId: z.string(),
  date: z.string(),
  category: z.object({ id: z.string(), name: z.string() }),
  status: shiftStatusSchema,
  plannedStart: z.string(),
  plannedEnd: z.string(),
  actualStart: z.string().nullish(),
  actualEnd: z.string().nullish(),
  breakMinutes: z.number().nullish(),
  hours: z.number(),
});
export type MyHoursEntry = z.infer<typeof myHoursEntrySchema>;

export const myHoursResponseSchema = z.object({
  month: monthKeySchema,
  totalHours: z.number(),
  targetHours: z.number().nullable(),
  hourlyRate: z.number().nullable(),
  entries: z.array(myHoursEntrySchema),
});
export type MyHoursResponse = z.infer<typeof myHoursResponseSchema>;

// ── UI models (derived from the backend shift, display-ready) ───────

export type Shift = {
  id: string;
  weeklyPlanId: string;
  /** YYYY-MM-DD (UTC calendar date of the shift) */
  date: string;
  /** HH:mm */
  start: string;
  /** HH:mm */
  end: string;
  /** Display name for the shift, e.g. "Kitchen · 09:00–17:00" title part. */
  label: string;
  categoryId: string;
  categoryName: string;
  status: ShiftStatus;
  rejectionReason: string | null;
  planStatus: PlanStatus;
  /** YYYY-MM-DD */
  weekStart: string;
  /** YYYY-MM-DD */
  weekEnd: string;
  /** True once the shift's end time is in the past (backend rejects responses then). */
  ended: boolean;
};

export type ScheduleWeek = {
  key: string;
  /** YYYY-MM-DD */
  weekStart: string;
  weekEnd: string;
  shifts: Shift[];
};

export type MySchedule = {
  month: string;
  hasUnpublishedPlan: boolean;
  shifts: Shift[];
  weeks: ScheduleWeek[];
};

import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { apiEnvelope } from '../../shared/schema';
import { pad } from '@/lib/date';
import { z } from 'zod';
import {
  myShiftsResponseSchema,
  myHoursResponseSchema,
  backendShiftSchema,
  type BackendShift,
  type MyHoursResponse,
  type MySchedule,
  type RespondShiftPayload,
  type ScheduleWeek,
  type Shift,
} from '../schema';

// Shift datetimes are UTC-encoded wall-clock times (same convention as
// availability preferred times), so all display formatting reads UTC fields.
const isoDateOnly = (iso: string) => iso.slice(0, 10);
const isoTimeHHMM = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

function toUiShift(s: BackendShift): Shift {
  const start = isoTimeHHMM(s.startTime);
  const end = isoTimeHHMM(s.endTime);
  return {
    id: s.id,
    weeklyPlanId: s.weeklyPlanId,
    date: isoDateOnly(s.date),
    start,
    end,
    label: `${s.category.name} shift`,
    categoryId: s.category.id,
    categoryName: s.category.name,
    status: s.status,
    rejectionReason: s.rejectionReason ?? null,
    planStatus: s.weeklyPlan.status,
    weekStart: isoDateOnly(s.weeklyPlan.weekStartDate),
    weekEnd: isoDateOnly(s.weeklyPlan.weekEndDate),
    ended: new Date(s.endTime).getTime() < Date.now(),
  };
}

/** Group shifts into their weekly-plan weeks, both sorted chronologically. */
function groupByWeek(shifts: Shift[]): ScheduleWeek[] {
  const weeks = new Map<string, ScheduleWeek>();
  for (const shift of shifts) {
    const key = `${shift.weekStart}_${shift.weekEnd}`;
    let week = weeks.get(key);
    if (!week) {
      week = { key, weekStart: shift.weekStart, weekEnd: shift.weekEnd, shifts: [] };
      weeks.set(key, week);
    }
    week.shifts.push(shift);
  }
  const sorted = [...weeks.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  for (const week of sorted) {
    week.shifts.sort((a, b) => (a.date === b.date ? a.start.localeCompare(b.start) : a.date.localeCompare(b.date)));
  }
  return sorted;
}

/**
 * GET /api/v1/me/shifts?month=YYYY-MM
 * The backend returns only the logged-in user's shifts from PUBLISHED weekly
 * plans (drafts and unpublished plans are never exposed to staff).
 */
export async function fetchMySchedule(monthKey: string): Promise<MySchedule> {
  const { data } = await apiClient.get(ENDPOINTS.me.shifts, { params: { month: monthKey } });
  const parsed = apiEnvelope(myShiftsResponseSchema).parse(data);

  const shifts = parsed.data.shifts.map(toUiShift);
  return {
    month: parsed.data.month,
    hasUnpublishedPlan: parsed.data.hasUnpublishedPlan,
    shifts,
    weeks: groupByWeek(shifts),
  };
}

/**
 * POST /api/v1/me/shifts/respond — accept or reject an assigned shift.
 * Backend rules: shift must be mine, its plan PUBLISHED, status PENDING,
 * and it must not have ended yet.
 */
export async function respondToShift(payload: RespondShiftPayload): Promise<Shift> {
  const body: RespondShiftPayload = {
    shiftId: payload.shiftId,
    action: payload.action,
    ...(payload.reason ? { reason: payload.reason } : {}),
  };
  const { data } = await apiClient.post(ENDPOINTS.me.shiftRespond, body);
  const parsed = apiEnvelope(z.object({ shift: backendShiftSchema })).parse(data);
  return toUiShift(parsed.data.shift);
}

/** GET /api/v1/me/hours?month=YYYY-MM — planned vs actual hours + hourly rate. */
export async function fetchMyHours(monthKey: string): Promise<MyHoursResponse> {
  const { data } = await apiClient.get(ENDPOINTS.me.hours, { params: { month: monthKey } });
  return apiEnvelope(myHoursResponseSchema).parse(data).data;
}

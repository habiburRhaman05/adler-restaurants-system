import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { z } from 'zod';
import { apiEnvelope } from '../../shared/schema';
import {
  attendanceHistorySchema,
  clockOutResponseSchema,
  currentAttendanceSchema,
  timeEntrySchema,
  type AttendanceHistory,
  type ClockInPayload,
  type ClockOutResponse,
  type CurrentAttendance,
  type TimeEntry,
} from '../schema';

const entryEnvelope = apiEnvelope(z.object({ entry: timeEntrySchema }));

/** GET /api/v1/attendance/current — the open time entry, if any. */
export async function fetchCurrentAttendance(): Promise<CurrentAttendance> {
  const { data } = await apiClient.get(ENDPOINTS.attendance.current);
  return apiEnvelope(currentAttendanceSchema).parse(data).data;
}

/** POST /api/v1/attendance/clock-in — optionally tied to a roster shift. */
export async function clockIn(payload: ClockInPayload = {}): Promise<TimeEntry> {
  const { data } = await apiClient.post(ENDPOINTS.attendance.clockIn, payload);
  return entryEnvelope.parse(data).data.entry;
}

/** POST /api/v1/attendance/clock-out — returns the entry plus a worked summary. */
export async function clockOut(note?: string): Promise<ClockOutResponse> {
  const { data } = await apiClient.post(ENDPOINTS.attendance.clockOut, note ? { note } : {});
  return apiEnvelope(clockOutResponseSchema).parse(data).data;
}

export async function breakStart(): Promise<TimeEntry> {
  const { data } = await apiClient.post(ENDPOINTS.attendance.breakStart);
  return entryEnvelope.parse(data).data.entry;
}

export async function breakEnd(): Promise<TimeEntry> {
  const { data } = await apiClient.post(ENDPOINTS.attendance.breakEnd);
  return entryEnvelope.parse(data).data.entry;
}

/** GET /api/v1/attendance/history?month=YYYY-MM — completed entries + totals. */
export async function fetchAttendanceHistory(month?: string): Promise<AttendanceHistory> {
  const { data } = await apiClient.get(ENDPOINTS.attendance.history, {
    params: { limit: 100, ...(month ? { month } : {}) },
  });
  return apiEnvelope(attendanceHistorySchema).parse(data).data;
}

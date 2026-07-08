import { apiClient } from "@/lib/api-client";
import { buildQuery } from "@/types";

// ── Backend response shapes ─────────────────────────────────────────
// apiClient.get<T>() unwraps the { success, message, data } envelope,
// so T is the payload inside `data`.

export interface AttendanceUser {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  hourlyRate: string | number | null;
}

export interface AttendanceEntry {
  id: string;
  userId: string;
  user: AttendanceUser;
  shiftId: string | null;
  shift: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    category: { id: string; name: string } | null;
  } | null;
  clockInAt: string;
  clockOutAt: string | null;
  breakMinutes: number;
  status: "ACTIVE" | "ON_BREAK" | "COMPLETED";
  workedMinutes: number | null;
  lateMinutes: number | null;
  overtimeMinutes: number | null;
  location: string | null;
  note: string | null;
}

export interface ListAttendanceResponse {
  entries: AttendanceEntry[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface ReportEmployee {
  userId: string;
  user: AttendanceUser;
  workedHours: number;
  breakMinutes: number;
  lateCount: number;
  overtimeMinutes: number;
  entryCount: number;
  absenceCount: number;
  estimatedWage: number | null;
}

export interface ReportAbsence {
  shiftId: string;
  userId: string;
  userName: string;
  date: string;
  startTime: string;
  endTime: string;
  category: { id: string; name: string } | null;
}

export interface AttendanceReport {
  range: { start: string; end: string };
  employees: ReportEmployee[];
  absences: ReportAbsence[];
  totals: {
    workedHours: number;
    estimatedWage: number;
    absenceCount: number;
  };
}

// ── Params ──────────────────────────────────────────────────────────

export interface ListAttendanceParams {
  page?: number;
  limit?: number;
  userId?: string;
  date?: string;
  status?: "ACTIVE" | "ON_BREAK" | "COMPLETED";
}

export interface ReportParams {
  month?: string;
  from?: string;
  to?: string;
  userId?: string;
}

// ── Service ─────────────────────────────────────────────────────────

export const attendanceService = {
  listAttendance: async (params: ListAttendanceParams = {}) => {
    return apiClient.get<ListAttendanceResponse>(
      `/admin/attendance${buildQuery(params)}`,
    );
  },

  getReport: async (params: ReportParams = {}) => {
    return apiClient.get<AttendanceReport>(
      `/admin/attendance/report${buildQuery(params)}`,
    );
  },
};

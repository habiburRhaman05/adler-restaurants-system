import { useQuery } from "@tanstack/react-query";
import {
  attendanceService,
  type ListAttendanceParams,
  type ReportParams,
} from "../api/attendance.service";

export const attendanceKeys = {
  all: ["attendance"] as const,
  list: (params: ListAttendanceParams) => ["attendance", "list", params] as const,
  report: (params: ReportParams) => ["attendance", "report", params] as const,
};

export function useAttendanceList(params: ListAttendanceParams = {}) {
  return useQuery({
    queryKey: attendanceKeys.list(params),
    queryFn: () => attendanceService.listAttendance(params),
  });
}

export function useAttendanceReport(params: ReportParams = {}) {
  return useQuery({
    queryKey: attendanceKeys.report(params),
    queryFn: () => attendanceService.getReport(params),
  });
}

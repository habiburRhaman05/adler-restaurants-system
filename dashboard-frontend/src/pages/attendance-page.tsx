import { useState } from "react";
import {
  Clock,
  Users,
  TrendingUp,
  Wallet,
  AlertTriangle,
  Calendar,
} from "lucide-react";
import { format, parseISO, startOfWeek, endOfWeek } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useAttendanceList,
  useAttendanceReport,
} from "@/features/attendance/hooks/use-attendance";
import type { AttendanceEntry, ReportEmployee } from "@/features/attendance/api/attendance.service";

// ── Helpers ─────────────────────────────────────────────────────────

const todayStr = () => format(new Date(), "yyyy-MM-dd");
const currentMonth = () => format(new Date(), "yyyy-MM");
const weekRange = () => {
  const start = startOfWeek(new Date(), { weekStartsOn: 1 });
  const end = endOfWeek(new Date(), { weekStartsOn: 1 });
  return {
    from: format(start, "yyyy-MM-dd"),
    to: format(end, "yyyy-MM-dd"),
  };
};

const fm = (iso: string | null | undefined, fmt: string) => {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), fmt);
  } catch {
    return iso;
  }
};

const workedDisplay = (entry: AttendanceEntry) => {
  if (entry.workedMinutes == null) return "—";
  const h = Math.floor(entry.workedMinutes / 60);
  const m = entry.workedMinutes % 60;
  return `${h}h ${m}m`;
};

// ── Stat card ───────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  colorClass,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  colorClass: string;
  loading?: boolean;
}) {
  return (
    <Card className="rounded-2xl shadow-md shadow-slate-100/50 bg-white/90 backdrop-blur-sm border border-slate-200/80 transition-all duration-200 hover:shadow-lg hover:shadow-slate-200/60 hover:-translate-y-0.5">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
          <span
            className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${colorClass}`}
          >
            <span className="h-4 w-4">{icon}</span>
          </span>
          {label}
        </div>
        {loading ? (
          <Skeleton className="mt-4 h-9 w-24 rounded-lg" />
        ) : (
          <p className="mt-4 text-3xl font-bold text-slate-900 tracking-tight">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Loading skeleton ────────────────────────────────────────────────

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-slate-50">
          <td className="py-4 px-6"><Skeleton className="h-4 w-32 rounded-lg" /></td>
          <td className="py-4 px-4"><Skeleton className="h-4 w-20 rounded-lg" /></td>
          <td className="py-4 px-4"><Skeleton className="h-4 w-16 rounded-lg" /></td>
          <td className="py-4 px-4"><Skeleton className="h-4 w-16 rounded-lg" /></td>
          <td className="py-4 px-4"><Skeleton className="h-4 w-12 ml-auto rounded-lg" /></td>
          <td className="py-4 px-6"><Skeleton className="h-6 w-20 mx-auto rounded-full" /></td>
        </tr>
      ))}
    </>
  );
}

// ── Daily view ──────────────────────────────────────────────────────

function DailyView() {
  const date = todayStr();
  const { data, isLoading, isError } = useAttendanceList({ date, limit: 50 });
  const entries = data?.entries ?? [];

  const present = entries.filter((e) => e.status !== "COMPLETED");
  const completed = entries.filter((e) => e.status === "COMPLETED");

  return (
    <div className="space-y-6">
      {/* Summary row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<Users className="text-blue-600" />}
          label="Active now"
          value={isLoading ? "…" : String(present.length)}
          colorClass="bg-blue-100"
          loading={isLoading}
        />
        <StatCard
          icon={<Clock className="text-green-600" />}
          label="Completed shifts"
          value={isLoading ? "…" : String(completed.length)}
          colorClass="bg-green-100"
          loading={isLoading}
        />
        <StatCard
          icon={<Calendar className="text-slate-600" />}
          label="Date"
          value={fm(date, "MMM d, yyyy")}
          colorClass="bg-slate-100"
        />
      </div>

      <Card className="rounded-2xl border-slate-200/80 shadow-lg shadow-slate-100/50 bg-white/90 backdrop-blur-sm overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-slate-50/80 to-blue-50/30 border-b border-slate-100 pb-4 pt-5 px-6">
          <CardTitle className="text-lg font-bold text-slate-900">Today's Attendance</CardTitle>
          <p className="text-sm font-medium text-slate-500 mt-1">
            {isLoading ? "Loading…" : `${entries.length} record${entries.length !== 1 ? "s" : ""}`}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-blue-50/30 text-xs uppercase tracking-wider text-slate-500 font-bold">
                  <th className="text-left py-4 px-6">Employee</th>
                  <th className="text-left py-4 px-4">Clock In</th>
                  <th className="text-left py-4 px-4">Clock Out</th>
                  <th className="text-right py-4 px-4">Worked</th>
                  <th className="text-right py-4 px-4">Late</th>
                  <th className="text-center py-4 px-6">Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <TableSkeleton />}
                {isError && (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-red-600 font-medium">
                      Failed to load attendance data.
                    </td>
                  </tr>
                )}
                {!isLoading && !isError && entries.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-400 font-medium">
                      No attendance records for today.
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  entries.map((e) => (
                    <tr
                      key={e.id}
                      className="border-b border-slate-50 hover:bg-blue-50/20 transition-all duration-200"
                    >
                      <td className="py-4 px-6 font-bold text-slate-900">
                        {e.user.name ?? e.user.email}
                      </td>
                      <td className="py-4 px-4 font-medium text-slate-600">
                        {fm(e.clockInAt, "h:mm a")}
                      </td>
                      <td className="py-4 px-4 font-medium text-slate-600">
                        {e.clockOutAt ? fm(e.clockOutAt, "h:mm a") : "—"}
                      </td>
                      <td className="py-4 px-4 text-right font-bold text-slate-900">
                        {workedDisplay(e)}
                      </td>
                      <td className="py-4 px-4 text-right font-medium text-slate-600">
                        {e.lateMinutes != null && e.lateMinutes > 0 ? (
                          <span className="text-red-600 font-semibold">{e.lateMinutes}m</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <Badge
                          variant="outline"
                          className={`capitalize ${
                            e.status === "COMPLETED"
                              ? "bg-green-50 text-green-700 border-green-200"
                              : e.status === "ACTIVE"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {e.status.toLowerCase().replace("_", " ")}
                        </Badge>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Report view (shared by weekly / monthly) ───────────────────────

function ReportView({
  params,
  title,
  description,
}: {
  params: { month?: string; from?: string; to?: string };
  title: string;
  description: string;
}) {
  const { data, isLoading, isError } = useAttendanceReport(params);
  const report = data;

  const employees: ReportEmployee[] = report?.employees ?? [];
  const absences = report?.absences ?? [];
  const totals = report?.totals ?? { workedHours: 0, estimatedWage: 0, absenceCount: 0 };

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<TrendingUp className="text-blue-600" />}
          label="Total hours worked"
          value={isLoading ? "…" : `${totals.workedHours.toFixed(1)} h`}
          colorClass="bg-blue-100"
          loading={isLoading}
        />
        <StatCard
          icon={<Wallet className="text-green-600" />}
          label="Estimated wage cost"
          value={
            isLoading
              ? "…"
              : `CHF ${totals.estimatedWage.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          }
          colorClass="bg-green-100"
          loading={isLoading}
        />
        <StatCard
          icon={<AlertTriangle className="text-amber-600" />}
          label="Absences"
          value={isLoading ? "…" : String(totals.absenceCount)}
          colorClass="bg-amber-100"
          loading={isLoading}
        />
        <StatCard
          icon={<Users className="text-slate-600" />}
          label="Employees"
          value={isLoading ? "…" : String(employees.length)}
          colorClass="bg-slate-100"
          loading={isLoading}
        />
      </div>

      {/* Per-employee table */}
      <Card className="rounded-2xl border-slate-200/80 shadow-lg shadow-slate-100/50 bg-white/90 backdrop-blur-sm overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-slate-50/80 to-blue-50/30 border-b border-slate-100 pb-4 pt-5 px-6">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-slate-900">{title}</CardTitle>
              <p className="text-sm font-medium text-slate-500 mt-1">{description}</p>
            </div>
            {report?.range && (
              <Badge variant="outline" className="text-xs font-semibold px-3 py-1 border-slate-200 bg-white/80">
                {report.range.start} – {report.range.end}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-blue-50/30 text-xs uppercase tracking-wider text-slate-500 font-bold">
                  <th className="text-left py-4 px-6">Employee</th>
                  <th className="text-right py-4 px-4">Hours</th>
                  <th className="text-right py-4 px-4">Breaks (m)</th>
                  <th className="text-right py-4 px-4">Late</th>
                  <th className="text-right py-4 px-4">Overtime (m)</th>
                  <th className="text-right py-4 px-4">Shifts</th>
                  <th className="text-right py-4 px-4">Absences</th>
                  <th className="text-right py-4 px-6">Est. Wage</th>
                </tr>
              </thead>
              <tbody>
                {isLoading &&
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-50">
                      <td className="py-4 px-6"><Skeleton className="h-4 w-32 rounded-lg" /></td>
                      <td className="py-4 px-4"><Skeleton className="h-4 w-14 ml-auto rounded-lg" /></td>
                      <td className="py-4 px-4"><Skeleton className="h-4 w-12 ml-auto rounded-lg" /></td>
                      <td className="py-4 px-4"><Skeleton className="h-4 w-10 ml-auto rounded-lg" /></td>
                      <td className="py-4 px-4"><Skeleton className="h-4 w-12 ml-auto rounded-lg" /></td>
                      <td className="py-4 px-4"><Skeleton className="h-4 w-10 ml-auto rounded-lg" /></td>
                      <td className="py-4 px-4"><Skeleton className="h-4 w-10 ml-auto rounded-lg" /></td>
                      <td className="py-4 px-6"><Skeleton className="h-4 w-20 ml-auto rounded-lg" /></td>
                    </tr>
                  ))}
                {isError && (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-red-600 font-medium">
                      Failed to load report data.
                    </td>
                  </tr>
                )}
                {!isLoading && !isError && employees.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-slate-400 font-medium">
                      No attendance data for this period.
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  employees.map((emp) => (
                    <tr
                      key={emp.userId}
                      className="border-b border-slate-50 hover:bg-blue-50/20 transition-all duration-200"
                    >
                      <td className="py-4 px-6 font-bold text-slate-900">
                        {emp.user.name ?? emp.user.email}
                      </td>
                      <td className="py-4 px-4 text-right font-bold text-slate-900">
                        {emp.workedHours.toFixed(1)}
                      </td>
                      <td className="py-4 px-4 text-right font-medium text-slate-600">
                        {emp.breakMinutes > 0 ? emp.breakMinutes : "—"}
                      </td>
                      <td className="py-4 px-4 text-right font-medium">
                        {emp.lateCount > 0 ? (
                          <span className="text-red-600 font-semibold">{emp.lateCount}x</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right font-medium text-slate-600">
                        {emp.overtimeMinutes > 0 ? emp.overtimeMinutes : "—"}
                      </td>
                      <td className="py-4 px-4 text-right font-bold text-slate-900">
                        {emp.entryCount}
                      </td>
                      <td className="py-4 px-4 text-right font-medium">
                        {emp.absenceCount > 0 ? (
                          <span className="text-red-600 font-semibold">{emp.absenceCount}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right font-bold text-slate-900">
                        {emp.estimatedWage != null
                          ? `CHF ${emp.estimatedWage.toFixed(2)}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Absences section */}
      {absences.length > 0 && (
        <Card className="rounded-2xl border-red-200/60 shadow-lg shadow-red-100/20 bg-white/90 backdrop-blur-sm overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-red-50/80 to-amber-50/30 border-b border-red-100 pb-4 pt-5 px-6">
            <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Unattended Shifts ({absences.length})
            </CardTitle>
            <p className="text-sm font-medium text-slate-500 mt-1">
              Published shifts that ended with no clock-in recorded.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-amber-50/30 text-xs uppercase tracking-wider text-slate-500 font-bold">
                    <th className="text-left py-4 px-6">Employee</th>
                    <th className="text-left py-4 px-4">Date</th>
                    <th className="text-left py-4 px-4">Scheduled</th>
                    <th className="text-left py-4 px-6">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {absences.map((a, i) => (
                    <tr
                      key={`${a.shiftId}-${i}`}
                      className="border-b border-slate-50 hover:bg-red-50/20 transition-all duration-200"
                    >
                      <td className="py-4 px-6 font-bold text-slate-900">{a.userName}</td>
                      <td className="py-4 px-4 font-medium text-slate-600">
                        {fm(a.date, "MMM d, yyyy")}
                      </td>
                      <td className="py-4 px-4 font-medium text-slate-600">
                        {fm(a.startTime, "h:mm a")} – {fm(a.endTime, "h:mm a")}
                      </td>
                      <td className="py-4 px-6">
                        <Badge
                          variant="outline"
                          className="bg-slate-50 text-slate-700 border-slate-200"
                        >
                          {a.category?.name ?? "—"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────

export function AttendancePage() {
  const [tab, setTab] = useState("daily");

  const { from: weekFrom, to: weekTo } = weekRange();
  const monthVal = currentMonth();

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1600px]">
      <header>
        <p className="text-xs uppercase tracking-widest text-blue-500 font-semibold">
          Monitoring
        </p>
        <h1 className="text-3xl md:text-4xl font-bold mt-1 text-slate-900 tracking-tight">
          Attendance
        </h1>
        <p className="text-slate-500 mt-1 font-medium">
          Real-time attendance tracking and hour summaries.
        </p>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="rounded-xl bg-slate-100/80 border border-slate-200/60 p-1">
          <TabsTrigger
            value="daily"
            className="rounded-lg font-semibold text-sm data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:shadow-slate-200/60 data-[state=active]:text-blue-600 transition-all"
          >
            <Clock className="h-4 w-4 mr-2" />
            Daily
          </TabsTrigger>
          <TabsTrigger
            value="weekly"
            className="rounded-lg font-semibold text-sm data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:shadow-slate-200/60 data-[state=active]:text-blue-600 transition-all"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Weekly
          </TabsTrigger>
          <TabsTrigger
            value="monthly"
            className="rounded-lg font-semibold text-sm data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:shadow-slate-200/60 data-[state=active]:text-blue-600 transition-all"
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            Monthly
          </TabsTrigger>
        </TabsList>

        <TabsContent value="daily">
          <DailyView />
        </TabsContent>

        <TabsContent value="weekly">
          <ReportView
            params={{ from: weekFrom, to: weekTo }}
            title="Weekly Summary"
            description="Hours, overtime, and absences per employee this week."
          />
        </TabsContent>

        <TabsContent value="monthly">
          <ReportView
            params={{ month: monthVal }}
            title="Monthly Summary"
            description="Hours, overtime, and absences per employee this month."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

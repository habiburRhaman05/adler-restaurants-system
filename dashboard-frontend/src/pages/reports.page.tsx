import { useMemo, useState } from "react";
import { Download, TrendingUp, Clock, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useCategoryTree } from "@/features/categories/hooks/use-categories";
import { useReports } from "@/features/reports/hooks/use-reports";
import { reportService } from "@/features/reports/api/report.service";
import { useAttendanceList } from "@/features/attendance/hooks/use-attendance";
import { initials } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { format, parseISO } from "date-fns";

export function ReportsPage() {
  const [categoryId, setCategoryId] = useState("all");
  const [nameFilter, setNameFilter] = useState("");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState<"summary" | "attendance">("summary");

  const { data: categoriesData } = useCategoryTree();
  const categories = categoriesData?.data?.categories ?? [];

  const queryParams = {
    year,
    month,
    ...(categoryId !== "all" ? { categoryId } : {}),
  };

  const { data: reportsData, isLoading, isError } = useReports(queryParams);
  
  const reportSummary = reportsData?.data?.summary ?? {
    totalWorked: 0,
    overtime: 0,
    hoursDue: 0,
    wageCost: 0,
    employeeCount: 0,
  };
  
  const employees = reportsData?.data?.employees ?? [];

  const filteredEmployees = useMemo(() => {
    if (!nameFilter) return employees;
    return employees.filter(e => e.name.toLowerCase().includes(nameFilter.toLowerCase()));
  }, [employees, nameFilter]);

  const doExport = () => {
    if (!employees.length) {
      toast.error("Nothing to export");
      return;
    }
        
    // Instead of raw export logic, redirect to backend CSV endpoint
    // We open it in a new window to trigger the download directly.
    const url = reportService.getExportUrl(queryParams);
    window.open(url, "_blank");
    toast.success("Downloading CSV report...");
  };

  const { data: attendanceData, isLoading: isLoadingAttendance } = useAttendanceList({
    limit: 50,
  });
  const attendanceEntries = attendanceData?.entries ?? [];

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(2000, i).toLocaleString('en', { month: 'long' })
  }));

  const years = [new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1];

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1600px]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-blue-500 font-semibold">Analysis</p>
          <h1 className="text-3xl md:text-4xl font-bold mt-1 text-slate-900 tracking-tight">Reports</h1>
          <p className="text-slate-500 mt-1 font-medium">Hours, overtime and wage cost per employee.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Filter by name…" value={nameFilter} onChange={(e) => setNameFilter(e.target.value)} className="w-[180px] rounded-xl h-10 border-slate-200 bg-white/60 shadow-sm focus-visible:ring-blue-500/20 focus-visible:border-blue-300 font-medium transition-all" />
          
          <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
            <SelectTrigger className="w-[140px] rounded-xl font-medium border-slate-200 bg-white/60 shadow-sm h-10"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-white border-slate-200 shadow-xl shadow-slate-200/50 rounded-xl">
              {months.map((m) => <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger className="w-[120px] rounded-xl font-medium border-slate-200 bg-white/60 shadow-sm h-10"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-white border-slate-200 shadow-xl shadow-slate-200/50 rounded-xl">
              {years.map((y) => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-[180px] rounded-xl font-medium border-slate-200 bg-white/60 shadow-sm h-10"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-white border-slate-200 shadow-xl shadow-slate-200/50 rounded-xl">
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button className="rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25 transition-all duration-200" onClick={doExport}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as "summary" | "attendance")} className="w-full">
        <TabsList className="bg-slate-100 p-1.5 rounded-xl h-auto">
          <TabsTrigger value="summary" className="rounded-lg font-semibold px-5 py-2 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-blue-700 data-[state=active]:border data-[state=active]:border-blue-200">
            Summary (Payroll)
          </TabsTrigger>
          <TabsTrigger value="attendance" className="rounded-lg font-semibold px-5 py-2 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-blue-700 data-[state=active]:border data-[state=active]:border-blue-200">
            Raw Attendance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-6 mt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SumCard icon={<Clock />} label="Total worked" value={`${reportSummary.totalWorked} h`} colorClass="bg-blue-50 text-blue-600 shadow-sm shadow-blue-100" loading={isLoading} />
            <SumCard icon={<TrendingUp />} label="Overtime" value={`${reportSummary.overtime} h`} accent colorClass="bg-amber-50 text-amber-600 shadow-sm shadow-amber-100" loading={isLoading} />
            <SumCard icon={<Clock />} label="Hours due" value={`${reportSummary.hoursDue} h`} colorClass="bg-red-50 text-red-600 shadow-sm shadow-red-100" loading={isLoading} />
            <SumCard icon={<Wallet />} label="Wage cost" value={`CHF ${reportSummary.wageCost.toLocaleString()}`} colorClass="bg-blue-50 text-blue-600 shadow-sm shadow-blue-100" loading={isLoading} />
          </div>

          <Card className="rounded-2xl border-slate-200/80 shadow-lg shadow-slate-100/50 bg-white/90 backdrop-blur-sm overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-slate-50/80 to-blue-50/30 border-b border-slate-100 pb-4 pt-5 px-6">
          <CardTitle className="text-lg font-bold text-slate-900">Per employee</CardTitle>
          <p className="text-sm font-medium text-slate-500 mt-1">{filteredEmployees.length} employees</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-blue-50/30 text-xs uppercase tracking-wider text-slate-500 font-bold">
                  <th className="text-left py-4 px-6">Employee</th>
                  <th className="text-left py-4 px-4">Contract</th>
                  <th className="text-right py-4 px-4">Scheduled</th>
                  <th className="text-right py-4 px-4">Worked</th>
                  <th className="text-right py-4 px-4">Overtime</th>
                  <th className="text-right py-4 px-4">Due</th>
                  <th className="text-right py-4 px-6">Wage</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="py-4 px-6"><div className="flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-full" /><Skeleton className="h-4 w-28 rounded-lg" /></div></td>
                    <td className="py-4 px-4"><Skeleton className="h-4 w-20 rounded-lg" /></td>
                    <td className="py-4 px-4"><Skeleton className="h-4 w-16 ml-auto rounded-lg" /></td>
                    <td className="py-4 px-4"><Skeleton className="h-4 w-12 ml-auto rounded-lg" /></td>
                    <td className="py-4 px-4"><Skeleton className="h-4 w-12 ml-auto rounded-lg" /></td>
                    <td className="py-4 px-4"><Skeleton className="h-4 w-12 ml-auto rounded-lg" /></td>
                    <td className="py-4 px-6"><Skeleton className="h-4 w-20 ml-auto rounded-lg" /></td>
                  </tr>
                ))}

                {!isLoading && filteredEmployees.map((e) => {
                  const pct = Math.min(100, Math.round((e.workedHours / Math.max(1, e.scheduledHours)) * 100));
                  return (
                    <tr key={e.userId} className="border-b border-slate-50 hover:bg-blue-50/20 transition-all duration-200 group">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200/60 text-blue-600 flex items-center justify-center text-xs font-bold overflow-hidden shadow-sm group-hover:shadow-md group-hover:scale-105 transition-all duration-200">
                            {initials(e.name)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">{e.name}</p>
                            <div className="flex gap-1 mt-1">
                              {e.categories.slice(0, 2).map((c) => (
                                <Badge key={c.id} variant="secondary" className="text-[10px] py-0 px-1.5 bg-blue-50 text-blue-700 border border-blue-200/60 rounded-md">
                                  {c.name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 capitalize text-slate-500 font-medium">{e.contractType.replace("_", " ").toLowerCase()} · {e.workloadPercent}%</td>
                      <td className="py-4 px-4 text-right">
                        <span className="font-semibold text-slate-700">{e.scheduledHours} h</span>
                        <div className="h-1.5 mt-2 rounded-full bg-slate-100 overflow-hidden w-20 ml-auto">
                          <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500" style={{ width: `${pct || 0}%` }} />
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right font-bold text-slate-900">{e.workedHours} h</td>
                      <td className="py-4 px-4 text-right">
                        {e.overtimeHours > 0 ? <span className="text-amber-700 font-bold bg-amber-50 border border-amber-200/60 px-2 py-1 rounded-lg shadow-sm shadow-amber-100">+{e.overtimeHours} h</span> : <span className="text-slate-400 font-medium">—</span>}
                      </td>
                      <td className="py-4 px-4 text-right">
                        {e.dueHours > 0 ? <span className="text-red-700 font-bold bg-red-50 border border-red-200/60 px-2 py-1 rounded-lg shadow-sm shadow-red-100">{e.dueHours} h</span> : <span className="text-slate-400 font-medium">—</span>}
                      </td>
                      <td className="py-4 px-6 text-right font-bold text-slate-900">CHF {e.wageCost.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {isError && <div className="py-16 text-center text-red-600 font-medium">Failed to load reports.</div>}
            {!isLoading && !isError && filteredEmployees.length === 0 && <div className="py-16 text-center text-slate-400 font-medium">No report data matches your filters.</div>}
          </div>
        </CardContent>
      </Card>
        </TabsContent>
        <TabsContent value="attendance" className="space-y-6 mt-6">
          <Card className="rounded-2xl border-slate-200/80 shadow-lg shadow-slate-100/50 bg-white/90 backdrop-blur-sm overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-slate-50/80 to-blue-50/30 border-b border-slate-100 pb-4 pt-5 px-6">
              <CardTitle className="text-lg font-bold text-slate-900">Recent Entries</CardTitle>
              <p className="text-sm font-medium text-slate-500 mt-1">Raw clock-ins and clock-outs</p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-blue-50/30 text-xs uppercase tracking-wider text-slate-500 font-bold">
                      <th className="text-left py-4 px-6">Employee</th>
                      <th className="text-left py-4 px-4">Date</th>
                      <th className="text-left py-4 px-4">Clock In</th>
                      <th className="text-left py-4 px-4">Clock Out</th>
                      <th className="text-right py-4 px-4">Worked (min)</th>
                      <th className="text-center py-4 px-6">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingAttendance && Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-slate-50">
                        <td className="py-4 px-6"><Skeleton className="h-4 w-28 rounded-lg" /></td>
                        <td className="py-4 px-4"><Skeleton className="h-4 w-20 rounded-lg" /></td>
                        <td className="py-4 px-4"><Skeleton className="h-4 w-16 rounded-lg" /></td>
                        <td className="py-4 px-4"><Skeleton className="h-4 w-16 rounded-lg" /></td>
                        <td className="py-4 px-4"><Skeleton className="h-4 w-12 ml-auto rounded-lg" /></td>
                        <td className="py-4 px-6"><Skeleton className="h-6 w-20 mx-auto rounded-full" /></td>
                      </tr>
                    ))}
                    {!isLoadingAttendance && (attendanceEntries as any[]).map((e: any) => (
                      <tr key={e.id} className="border-b border-slate-50 hover:bg-blue-50/20 transition-all duration-200">
                        <td className="py-4 px-6 font-bold text-slate-900">{e.user?.name ?? e.user?.email}</td>
                        <td className="py-4 px-4 font-medium text-slate-600">{e.clockInAt ? format(parseISO(e.clockInAt), "MMM d, yyyy") : "—"}</td>
                        <td className="py-4 px-4 font-medium text-slate-600">{e.clockInAt ? format(parseISO(e.clockInAt), "h:mm a") : "—"}</td>
                        <td className="py-4 px-4 font-medium text-slate-600">{e.clockOutAt ? format(parseISO(e.clockOutAt), "h:mm a") : "—"}</td>
                        <td className="py-4 px-4 text-right font-bold text-slate-900">{e.workedMinutes ?? "—"}</td>
                        <td className="py-4 px-6 text-center">
                          <Badge variant="outline" className={`capitalize ${
                            e.status === 'COMPLETED' ? "bg-green-50 text-green-700 border-green-200" :
                            e.status === 'ACTIVE' ? "bg-blue-50 text-blue-700 border-blue-200" :
                            e.status === 'ON_BREAK' ? "bg-amber-50 text-amber-700 border-amber-200" :
                            "bg-slate-100 text-slate-700 border-slate-200"
                          }`}>{e.status.toLowerCase().replace('_', ' ')}</Badge>
                        </td>
                      </tr>
                    ))}
                    {!isLoadingAttendance && attendanceEntries.length === 0 && (
                      <tr><td colSpan={6} className="py-16 text-center text-slate-400 font-medium">No attendance records found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SumCard({ icon, label, value, accent, colorClass, loading }: { icon: React.ReactNode; label: string; value: string; accent?: boolean; colorClass: string; loading?: boolean }) {
  return (
    <Card className={`rounded-2xl shadow-md shadow-slate-100/50 bg-white/90 backdrop-blur-sm border transition-all duration-200 hover:shadow-lg hover:shadow-slate-200/60 hover:-translate-y-0.5 ${accent ? "border-amber-200 shadow-amber-100/30" : "border-slate-200/80"}`}>
      <CardContent className="p-6">
        <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
          <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${colorClass}`}>
            <span className="h-4 w-4">{icon}</span>
          </span>
          {label}
        </div>
        {loading ? <Skeleton className="mt-4 h-9 w-24 rounded-lg" /> : <p className="mt-4 text-3xl font-bold text-slate-900 tracking-tight">{value}</p>}
      </CardContent>
    </Card>
  );
}

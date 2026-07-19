import { useMemo, useState } from "react";
import { CalendarPlus, Users, CheckCircle2, Clock, BellRing, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

import {
  useAvailabilityGrid, useOpenAvailabilityMonth, useNudgeEmployee,
} from "@/features/availability/hooks/use-availability";
import {
  availabilityUserName,
  type AvailabilityGridEmployee,
} from "@/features/availability/api/availability.service";
import { initials } from "@/lib/utils";

const STATUS_BADGE: Record<AvailabilityGridEmployee["status"], { label: string; className: string }> = {
  SUBMITTED: { label: "Submitted", className: "border-emerald-200 text-emerald-700 bg-emerald-50" },
  DRAFT: { label: "In progress", className: "border-amber-200 text-amber-700 bg-amber-50" },
  LOCKED: { label: "Locked", className: "border-slate-200 text-slate-500 bg-slate-50" },
  NOT_OPENED: { label: "Not opened", className: "border-slate-200 text-slate-400 bg-white" },
};

// Colour per day status in the heat strip.
const DAY_COLOR: Record<string, string> = {
  AVAILABLE: "bg-emerald-400",
  WISH: "bg-amber-400",
  UNAVAILABLE: "bg-red-300",
};

export function AvailabilityPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data, isLoading, isError } = useAvailabilityGrid(year, month);
  const openMut = useOpenAvailabilityMonth();
  const nudgeMut = useNudgeEmployee();

  const [openDialog, setOpenDialog] = useState(false);
  const [cutoff, setCutoff] = useState("");
  const [nudgingId, setNudgingId] = useState<string | null>(null);

  const employees = data?.employees ?? [];
  const summary = data?.summary ?? { total: 0, submitted: 0, notSubmitted: 0 };
  const daysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [year, month]);
  const monthIsOpen = employees.some((e) => e.status !== "NOT_OPENED");
  const cutoffAt = employees.find((e) => e.cutoffAt)?.cutoffAt ?? null;

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(2000, i).toLocaleString("en", { month: "long" }),
  }));
  const years = [now.getFullYear(), now.getFullYear() + 1];

  const handleOpenMonth = () => {
    if (!cutoff) {
      toast.error("Please choose a submission cut-off date and time.");
      return;
    }
    const cutoffDate = new Date(cutoff);
    if (Number.isNaN(cutoffDate.getTime())) {
      toast.error("The cut-off date is not valid.");
      return;
    }
    if (cutoffDate <= new Date()) {
      toast.error("The cut-off must be in the future.");
      return;
    }
    openMut.mutate(
      { year, month, cutoffAt: cutoffDate.toISOString() },
      { onSuccess: () => { setOpenDialog(false); setCutoff(""); } }
    );
  };

  const handleNudge = (e: AvailabilityGridEmployee) => {
    setNudgingId(e.userId);
    nudgeMut.mutate(
      { userId: e.userId, year, month },
      { onSettled: () => setNudgingId(null) }
    );
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-blue-500 font-semibold">Planning</p>
          <h1 className="text-3xl md:text-4xl font-bold mt-1 text-slate-900 tracking-tight">Availability</h1>
          <p className="text-slate-500 mt-1 font-medium">
            Open a month for submissions, track who has responded, and remind stragglers.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
            <SelectTrigger className="w-[140px] rounded-xl font-medium border-slate-200 bg-white/60 shadow-sm h-10"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-white border-slate-200 shadow-xl shadow-slate-200/50 rounded-xl">
              {months.map((m) => <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger className="w-[110px] rounded-xl font-medium border-slate-200 bg-white/60 shadow-sm h-10"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-white border-slate-200 shadow-xl shadow-slate-200/50 rounded-xl">
              {years.map((y) => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            onClick={() => setOpenDialog(true)}
            className="rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25 transition-all duration-200"
          >
            <CalendarPlus className="h-4 w-4 mr-2" /> {monthIsOpen ? "Update cut-off" : "Open month"}
          </Button>
        </div>
      </header>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard icon={<Users />} label="Active employees" value={summary.total} colorClass="bg-blue-50 text-blue-600" loading={isLoading} />
        <SummaryCard icon={<CheckCircle2 />} label="Submitted" value={summary.submitted} colorClass="bg-emerald-50 text-emerald-600" loading={isLoading} />
        <SummaryCard icon={<Clock />} label="Waiting on" value={summary.notSubmitted} colorClass="bg-amber-50 text-amber-600" loading={isLoading} />
      </div>

      {!isLoading && monthIsOpen && cutoffAt && (
        <p className="text-sm font-medium text-slate-500">
          Submission cut-off: <span className="font-bold text-slate-700">{format(parseISO(cutoffAt), "EEE, MMM d yyyy · h:mm a")}</span>
        </p>
      )}
      {!isLoading && !monthIsOpen && (
        <Card className="rounded-2xl border-dashed border-blue-200 bg-blue-50/40">
          <CardContent className="py-6 px-6 text-sm font-medium text-blue-800 flex items-center gap-3">
            <CalendarPlus className="h-5 w-5 shrink-0" />
            This month hasn&apos;t been opened for availability yet — employees can&apos;t submit until you open it.
          </CardContent>
        </Card>
      )}

      {/* Grid */}
      <Card className="rounded-2xl border-slate-200/80 shadow-lg shadow-slate-100/50 bg-white/90 backdrop-blur-sm overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-slate-50/80 to-blue-50/30 border-b border-slate-100 pb-4 pt-5 px-6 flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold text-slate-900">Submissions</CardTitle>
            <p className="text-sm font-medium text-slate-500 mt-1">{employees.length} employees</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" /> Available</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> Wish</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-200" /> No entry</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-blue-50/30 text-xs uppercase tracking-wider text-slate-500 font-bold">
                  <th className="text-left py-4 px-6">Employee</th>
                  <th className="text-left py-4 px-4">Status</th>
                  <th className="text-left py-4 px-4">Days ({daysInMonth})</th>
                  <th className="text-right py-4 px-6">Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="py-4 px-6"><div className="flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-full" /><Skeleton className="h-4 w-28 rounded-lg" /></div></td>
                    <td className="py-4 px-4"><Skeleton className="h-6 w-24 rounded-lg" /></td>
                    <td className="py-4 px-4"><Skeleton className="h-4 w-64 rounded-lg" /></td>
                    <td className="py-4 px-6"><Skeleton className="h-8 w-20 ml-auto rounded-lg" /></td>
                  </tr>
                ))}

                {!isLoading && employees.map((e) => {
                  const badge = STATUS_BADGE[e.status];
                  const dayByNum = new Map(e.days.map((d) => [new Date(d.date).getUTCDate(), d]));
                  return (
                    <tr key={e.userId} className="border-b border-slate-50 hover:bg-blue-50/20 transition-all duration-200">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200/60 text-blue-600 flex items-center justify-center text-xs font-bold shadow-sm">
                            {initials(availabilityUserName(e))}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{availabilityUserName(e)}</p>
                            <p className="text-xs text-slate-400 font-medium">{e.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <Badge variant="outline" className={`px-2.5 py-1 rounded-lg font-semibold ${badge.className}`}>{badge.label}</Badge>
                        {e.submittedAt && (
                          <p className="text-[11px] text-slate-400 font-medium mt-1">{format(parseISO(e.submittedAt), "MMM d, h:mm a")}</p>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex flex-wrap gap-[3px] max-w-[440px]">
                          {Array.from({ length: daysInMonth }, (_, i) => {
                            const day = dayByNum.get(i + 1);
                            const color = day ? (DAY_COLOR[day.status] ?? "bg-slate-300") : "bg-slate-200";
                            const label = day
                              ? `${i + 1}: ${day.status.toLowerCase()}${day.preferredStartTime ? ` ${day.preferredStartTime}–${day.preferredEndTime ?? ""}` : ""}`
                              : `${i + 1}: no entry`;
                            return <span key={i} title={label} className={`h-3.5 w-3.5 rounded-[3px] ${color}`} />;
                          })}
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium mt-1.5">{e.days.length} day{e.days.length !== 1 ? "s" : ""} filled</p>
                      </td>
                      <td className="py-4 px-6 text-right">
                        {e.status === "DRAFT" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={nudgingId !== null}
                            onClick={() => handleNudge(e)}
                            className="rounded-lg font-semibold border-slate-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 transition-all"
                          >
                            {nudgingId === e.userId ? (
                              <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Sending…</>
                            ) : (
                              <><BellRing className="h-3.5 w-3.5 mr-1.5" /> Nudge</>
                            )}
                          </Button>
                        ) : (
                          <span className="text-slate-300 font-medium text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {isError && <div className="py-16 text-center text-red-600 font-medium">Failed to load availability.</div>}
            {!isLoading && !isError && employees.length === 0 && (
              <div className="py-16 text-center text-slate-400 font-medium">No active employees found.</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Open month dialog */}
      <Dialog open={openDialog} onOpenChange={(o) => !openMut.isPending && setOpenDialog(o)}>
        <DialogContent className="rounded-2xl sm:max-w-md bg-white/95 backdrop-blur-xl border border-slate-200/80 shadow-2xl shadow-slate-900/10">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">
              {monthIsOpen ? "Update submission cut-off" : "Open month for availability"}
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              {months[month - 1]?.label} {year} — every active employee gets a slot and can submit
              from the mobile app until the cut-off.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-slate-700 font-semibold text-sm">Submission cut-off</Label>
            <Input
              type="datetime-local"
              value={cutoff}
              onChange={(e) => setCutoff(e.target.value)}
              className="rounded-xl border-slate-200 bg-slate-50/50 h-11 focus-visible:ring-blue-500/20 focus-visible:border-blue-300 font-medium transition-all"
            />
            <p className="text-xs text-slate-400 font-medium">After this moment employees can no longer submit or change their availability.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)} disabled={openMut.isPending} className="rounded-xl font-semibold border-slate-200">
              Cancel
            </Button>
            <Button onClick={handleOpenMonth} disabled={openMut.isPending} className="rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25">
              {openMut.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Opening…</>
              ) : (
                <><CalendarPlus className="h-4 w-4 mr-2" /> {monthIsOpen ? "Update cut-off" : "Open month"}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ icon, label, value, colorClass, loading }: {
  icon: React.ReactNode; label: string; value: number; colorClass: string; loading?: boolean;
}) {
  return (
    <Card className="rounded-2xl shadow-md shadow-slate-100/50 bg-white/90 backdrop-blur-sm border border-slate-200/80 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
          <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${colorClass}`}>
            <span className="h-4 w-4">{icon}</span>
          </span>
          {label}
        </div>
        {loading ? <Skeleton className="mt-4 h-9 w-16 rounded-lg" /> : <p className="mt-4 text-3xl font-bold text-slate-900 tracking-tight">{value}</p>}
      </CardContent>
    </Card>
  );
}

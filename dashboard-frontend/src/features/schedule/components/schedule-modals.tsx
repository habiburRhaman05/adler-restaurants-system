import { useState, useMemo, useEffect } from "react";
import { format, eachWeekOfInterval, endOfWeek, isBefore, startOfDay } from "date-fns";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import type { Violation, Staff, Shift, DailyDemand } from "../api/schedule-api";
import { FN_LABELS, STAFF } from "../api/schedule-api";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function GenerateScheduleModal({ open, onOpenChange, onGenerate }: { open: boolean, onOpenChange: (open: boolean) => void, onGenerate: (month: number, week: number) => Promise<void> }) {
  const today = new Date();
  const currentMonthIdx = today.getMonth();
  const currentYear = today.getFullYear();

  const [month, setMonth] = useState(currentMonthIdx);
  const [week, setWeek] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);

  const availableMonths = useMemo(() => {
    return MONTHS.map((name, index) => ({ name, index })).filter(m => m.index >= currentMonthIdx);
  }, [currentMonthIdx]);

  const weeks = useMemo(() => {
    const year = month < currentMonthIdx ? currentYear + 1 : currentYear;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const weeksInMonth = eachWeekOfInterval({ start: firstDay, end: lastDay }, { weekStartsOn: 1 });
    
    return weeksInMonth.map((weekStart, idx) => {
      const end = endOfWeek(weekStart, { weekStartsOn: 1 });
      const isDisabled = isBefore(end, startOfDay(new Date()));
      return {
        value: idx + 1,
        label: `${format(weekStart, "d MMM")} – ${format(end, "d MMM")}`,
        isDisabled
      };
    });
  }, [month, currentMonthIdx, currentYear]);

  useEffect(() => {
    if (weeks.length > 0) {
      setWeek(prev => {
        const selectedWeek = weeks.find(w => w.value === prev);
        if (!selectedWeek || selectedWeek.isDisabled) {
          const firstAvailable = weeks.find(w => !w.isDisabled);
          return firstAvailable ? firstAvailable.value : weeks[0].value;
        }
        return prev;
      });
    }
  }, [weeks]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await onGenerate(month, week);
      onOpenChange(false);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Schedule Proposal</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <p className="text-sm text-slate-500">
            Select the month and week to generate a schedule for. The system will match employee availability with your demand and apply L-GAV rules.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Month</label>
              <Select value={String(month)} onValueChange={v => setMonth(Number(v))} disabled={isGenerating}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.map((m) => (
                    <SelectItem key={m.index} value={String(m.index)}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Week Date Range</label>
              <Select value={String(week)} onValueChange={v => setWeek(Number(v))} disabled={isGenerating}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {weeks.map(w => (
                    <SelectItem key={w.value} value={String(w.value)} disabled={w.isDisabled}>
                      {w.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isGenerating}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={isGenerating || (weeks.find(w => w.value === week)?.isDisabled)} className="bg-blue-600 hover:bg-blue-700 text-white min-w-[140px]">
            {isGenerating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</> : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Month-only generation: the backend generates every demand-backed week of the
// month in one go (weeks without demand are skipped and reported).
export function GenerateMonthModal({
  open,
  onOpenChange,
  onGenerate,
  scheduledMonthKeys,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (year: number, month: number) => Promise<void>; // month 1-12
  scheduledMonthKeys: string[]; // ["2026-07", ...] months that already have a schedule
}) {
  const today = new Date();
  const currentMonthIdx = today.getMonth();
  const currentYear = today.getFullYear();
  const [isGenerating, setIsGenerating] = useState(false);

  // Current month + the next 5, wrapping into next year.
  const options = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const idx = currentMonthIdx + i;
      const year = currentYear + Math.floor(idx / 12);
      const month = (idx % 12) + 1;
      const key = `${year}-${String(month).padStart(2, "0")}`;
      return {
        key,
        year,
        month,
        label: `${MONTHS[month - 1]} ${year}`,
        alreadyScheduled: scheduledMonthKeys.includes(key),
      };
    });
  }, [currentMonthIdx, currentYear, scheduledMonthKeys]);

  const firstAvailable = options.find((o) => !o.alreadyScheduled);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected =
    options.find((o) => o.key === selectedKey && !o.alreadyScheduled) ?? firstAvailable;

  const handleGenerate = async () => {
    if (!selected) return;
    setIsGenerating(true);
    try {
      await onGenerate(selected.year, selected.month);
      onOpenChange(false);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Monthly Schedule</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <p className="text-sm text-slate-500">
            Every week of the month that has demand will be scheduled from the submitted
            availabilities, applying the L-GAV working-time rules. Weeks without demand are
            skipped — set them on the Demand page first.
          </p>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">Month</label>
            <Select
              value={selected?.key}
              onValueChange={(v) => setSelectedKey(v)}
              disabled={isGenerating}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a month" />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.key} value={o.key} disabled={o.alreadyScheduled}>
                    {o.label}
                    {o.alreadyScheduled ? " — already scheduled" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isGenerating}>
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !selected}
            className="bg-blue-600 hover:bg-blue-700 text-white min-w-[140px]"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...
              </>
            ) : (
              "Generate"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ViolationsPanel({ violations, onApplyFix, onAssignSlot }: { violations: Violation[], onApplyFix: (id: string) => void, onAssignSlot: (id: string) => void }) {
  if (violations.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
        Rule check & Issues
        <span className="text-xs font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{violations.length} total</span>
      </h2>
      <div className="space-y-3">
        {violations.map(v => (
          <div key={v.id} className={`p-4 rounded-xl border flex flex-col gap-2 transition-colors ${v.fixed ? "bg-slate-50 border-slate-200/60 opacity-70" : "bg-white border-slate-200 border-l-4 " + (v.kind === "unfilled" ? "border-l-orange-500" : "border-l-red-500")}`}>
            <div className="flex items-center gap-2 flex-wrap">
              {v.fixed ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <AlertCircle className={`h-4 w-4 ${v.kind === "unfilled" ? "text-orange-500" : "text-red-500"}`} />
              )}
              <span className="font-bold text-slate-800 text-sm">{v.h}</span>
              {v.fixed ? (
                <span className="text-[10px] uppercase tracking-wider font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">Resolved</span>
              ) : (
                <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded ${v.kind === "unfilled" ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"}`}>
                  {v.kind === "unfilled" ? "Unfilled" : "L-GAV Violation"}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-600">{v.why}</p>
            {!v.fixed && (
              <div className="flex flex-wrap gap-2 mt-2">
                {v.fix && (
                  <Button size="sm" onClick={() => onApplyFix(v.id)} className="bg-slate-900 text-white hover:bg-slate-800 h-8">
                    {v.fix}
                  </Button>
                )}
                {v.kind === "unfilled" && (
                  <Button size="sm" onClick={() => onAssignSlot(v.id)} className="bg-blue-600 text-white hover:bg-blue-700 h-8">
                    Assign someone
                  </Button>
                )}
                <Button size="sm" variant="outline" className="h-8" onClick={() => alert("Kept as exception — a written justification would be required and logged in production.")}>
                  Keep with justification
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AssignSlotSheet({ 
  open, 
  onOpenChange, 
  assignData, 
  onAssign 
}: { 
  open: boolean, 
  onOpenChange: (open: boolean) => void, 
  assignData: { violId: string | null, dayIdx: number, fnKey?: string, needLabel?: string } | null, 
  violations: Violation[], 
  onAssign: (violId: string | null, staffName: string, dayIdx: number, fnKey: string, tm: string, compOption?: "overtime" | "reduce-future") => void 
}) {
  const [compensationOption, setCompensationOption] = useState<"overtime" | "reduce-future">("overtime");

  if (!assignData) return null;

  const fnKey = assignData.fnKey || "service";

  // Qualified candidates: employees whose categories include this slot's
  // category. The backend runs the full L-GAV rule check on assignment and
  // rejects overlaps / flags violations.
  const cands = STAFF.filter(s => s.fn.includes(fnKey)).map(s => ({
    n: s.name,
    ok: true,
    r: `${s.type}${s.pct ? ` · ${s.pct}%` : ""} — rules are checked on assign`,
  }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto bg-white border-l border-slate-200 shadow-2xl z-50">
        <SheetHeader className="mb-6 pb-4 border-b border-slate-100">
          <SheetTitle className="text-xl font-bold text-slate-900">Assign Staff to Shift</SheetTitle>
          <SheetDescription className="text-sm text-slate-500">
            {assignData.needLabel ? `Fill: ${assignData.needLabel}` : `Add a new ${FN_LABELS[fnKey]} shift for Day ${assignData.dayIdx + 1}`}
          </SheetDescription>
        </SheetHeader>
        
        <div className="space-y-8">
          
          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <h4 className="text-sm font-bold text-slate-800">How to balance this extra shift?</h4>
            <p className="text-xs text-slate-500 mb-2">
              "Reduce next week" lowers the same weekday's demand for this role next week by one
              and marks this day as used in the employee's availability.
            </p>
            <Select value={compensationOption} onValueChange={(v: any) => setCompensationOption(v)}>
              <SelectTrigger className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overtime">Keep as extra (overtime)</SelectItem>
                <SelectItem value="reduce-future">Reduce next week's demand</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-bold text-slate-800 flex items-center justify-between">
                Candidates ({FN_LABELS[fnKey]})
                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{cands.length} available</span>
              </h4>
              <p className="text-xs text-slate-500 mt-1 mb-4">Only qualified staff are shown. The rule check runs before you assign.</p>
            </div>
            
            <div className="space-y-3">
              {cands.map(c => (
                <div key={c.n} className={`p-4 rounded-xl border transition-all hover:shadow-md flex flex-col gap-3 ${c.ok ? "bg-white border-slate-200 hover:border-slate-300" : "bg-orange-50/30 border-orange-200 hover:border-orange-300 border-l-4 border-l-orange-400"}`}>
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${c.ok ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>
                      {c.n.split(" ").map(n => n[0]).join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate text-slate-900">{c.n}</div>
                      <div className={`text-xs font-medium mt-0.5 ${c.ok ? "text-emerald-600" : "text-orange-600"}`}>{c.r}</div>
                    </div>
                    <Button size="sm" onClick={() => { 
                      onAssign(assignData.violId, c.n, assignData.dayIdx, fnKey, "17:00–23:30", compensationOption); 
                      onOpenChange(false); 
                    }} className={`shrink-0 shadow-sm ${c.ok ? "bg-slate-900 hover:bg-slate-800 text-white" : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"}`}>
                      {c.ok ? "Assign" : "Force Assign"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function ShiftInfoModal({ 
  open, 
  onOpenChange, 
  shiftInfo,
  violations,
  onRemove,
  onEditTime,
  onApplyFix
}: { 
  open: boolean, 
  onOpenChange: (open: boolean) => void, 
  shiftInfo: { staff: Staff, dayIdx: number, shift: Shift } | null,
  violations: Violation[],
  onRemove: (staffId: string, dayIdx: number, shiftId: string) => void,
  onEditTime: (staffId: string, dayIdx: number, shiftId: string, newTm: string) => void,
  onApplyFix: (violId: string) => void
}) {
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [newTime, setNewTime] = useState("");

  if (!shiftInfo) return null;
  const { staff, shift, dayIdx } = shiftInfo;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if(!v) setIsEditingTime(false); }}>
      <DialogContent className="sm:max-w-sm">
        <div className="flex justify-between items-start pt-2">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{staff.name}</h3>
            <p className="text-sm text-slate-500">{shift.label}</p>
          </div>
        </div>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Time</div>
              {!isEditingTime ? (
                <div className="font-mono text-sm font-medium flex items-center gap-2">
                  {shift.tm}
                  <button onClick={() => { setIsEditingTime(true); setNewTime(shift.tm); }} className="text-blue-600 text-xs hover:underline">Edit</button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <Input value={newTime} onChange={e => setNewTime(e.target.value)} className="h-7 text-xs font-mono px-2" />
                  <Button size="sm" className="h-7 px-2" onClick={() => {
                    onEditTime(staff.id, dayIdx, shift.id, newTime);
                    setIsEditingTime(false);
                  }}>Save</Button>
                </div>
              )}
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Role</div>
              <div className="text-sm font-medium">{FN_LABELS[shift.fn] || shift.fn}</div>
            </div>
          </div>
          
          {shift.wish && (
            <div className="flex items-start gap-2 bg-amber-50 text-amber-800 p-3 rounded-lg border border-amber-200">
              <span className="shrink-0">★</span>
              <p className="text-sm font-medium">This shift matches a preference submitted by {staff.name}.</p>
            </div>
          )}
          
          {shift.viol && (() => {
            // Match by shift id first (exact); fall back to owner name.
            const activeViol =
              violations.find(x => !x.fixed && x.shiftIds?.includes(shift.id)) ??
              violations.find(x => !x.fixed && x.kind === shift.viol && x.who === staff.name);
            return (
              <div className="flex items-start gap-2 bg-red-50 text-red-800 p-3 rounded-lg border border-red-200 flex-col">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">This shift causes a rule violation. Edit the time or remove the shift to resolve.</p>
                </div>
                {activeViol && activeViol.fix && (
                  <div className="mt-2 w-full flex justify-end">
                    <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white h-7 text-xs" onClick={() => {
                      onApplyFix(activeViol.id);
                      onOpenChange(false);
                    }}>
                      Apply Fix: {activeViol.fix}
                    </Button>
                  </div>
                )}
              </div>
            );
          })()}

          {shift.status && (
            <div className="flex items-start gap-2 bg-blue-50 text-blue-800 p-3 rounded-lg border border-blue-200">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <p className="text-sm font-medium">
                Status: <span className="uppercase font-bold">{shift.status}</span>
              </p>
            </div>
          )}
        </div>
        <DialogFooter className="sm:justify-start gap-2">
          <Button variant="destructive" onClick={() => { onRemove(staff.id, dayIdx, shift.id); onOpenChange(false); }} className="w-full sm:w-auto">
            Remove Shift
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ViewDemandModal({ 
  open, 
  onOpenChange, 
  demands, 
  days 
}: { 
  open: boolean, 
  onOpenChange: (open: boolean) => void, 
  demands: DailyDemand[],
  days: Date[]
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Week Demand Plan</DialogTitle>
        </DialogHeader>
        <div className="py-4 overflow-auto flex-1">
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold bg-slate-50 border-r border-slate-200">Role</th>
                  {days.map((day, i) => (
                    <th key={i} className="px-3 py-3 font-semibold text-center border-r border-slate-200 last:border-0">
                      {format(day, "EEE, MMM d")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {Object.entries(FN_LABELS).map(([fnKey, label]) => (
                  <tr key={fnKey} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-semibold text-slate-900 border-r border-slate-200">{label}</td>
                    {demands.map((demand, di) => {
                      const count = demand[fnKey as keyof DailyDemand] || 0;
                      return (
                        <td key={di} className="px-3 py-3 text-center font-mono font-medium border-r border-slate-200 last:border-0">
                          {count > 0 ? count : <span className="text-slate-300">-</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="bg-slate-900 text-white hover:bg-slate-800">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

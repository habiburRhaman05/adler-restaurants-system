import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScheduleGrid } from "@/features/schedule/components/schedule-grid";
import { AssignSlotSheet, ShiftInfoModal, ViewDemandModal, ViolationsPanel } from "@/features/schedule/components/schedule-modals";
import {
  FN_LABELS,
  STAFF,
  useSchedulePlannerById,
  useScheduleMonths,
  useDemandWeeks,
  type Shift,
  type Staff,
} from "@/features/schedule/hooks/use-schedule";
import { addDays, format } from "date-fns";
import { Activity, AlertTriangle, CalendarDays, ChevronLeft, DollarSign, Settings2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

export function ScheduleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    state,
    approveSchedule,
    assignSlot,
    removeShift,
    editShiftTime,
    applyFix,
    generateSchedule,
    isGenerating,
  } = useSchedulePlannerById(id || "");

  const { data: months } = useScheduleMonths();
  const { data: demandWeeks } = useDemandWeeks();

  const baseDate = state ? new Date(state.weekStart) : new Date();
  const days = Array.from({ length: 7 }).map((_, i) => addDays(baseDate, i));

  // Modals state
  const [showDemandModal, setShowDemandModal] = useState(false);
  const [assignData, setAssignData] = useState<{ violId: string | null, dayIdx: number, fnKey?: string, needLabel?: string } | null>(null);
  const [selectedShift, setSelectedShift] = useState<{ staff: Staff, dayIdx: number, shift: Shift } | null>(null);

  // ─── Week selector: every week of this plan's month ─────────────
  // Generated weeks come from the months list; demand weeks that have no plan
  // yet are offered too — opening one auto-creates its plan on the backend.
  const currentMonth = useMemo(() => {
    if (!months || !id) return null;
    return months.find((m) => m.weeks.some((w) => w.id === id)) ?? null;
  }, [months, id]);

  const weekOptions = useMemo(() => {
    if (!currentMonth) return [];
    const options = currentMonth.weeks.map((w) => ({
      id: w.id,
      weekNumber: w.weekNumber,
      label: `Week ${w.weekNumber} · ${format(new Date(w.weekStartDate), "d MMM")} – ${format(
        new Date(w.weekEndDate),
        "d MMM"
      )}`,
      status: w.status as string,
      weekStartDate: w.weekStartDate,
    }));

    // Demand weeks of the same month with no generated plan yet.
    const covered = new Set(options.map((o) => o.weekStartDate.slice(0, 10)));
    for (const dw of demandWeeks ?? []) {
      const start = dw.weekStartDate.slice(0, 10);
      const [y, m] = start.split("-").map(Number);
      if (y === currentMonth.year && m === currentMonth.month && !covered.has(start) && dw.demandCount > 0) {
        options.push({
          id: dw.id,
          weekNumber: Math.floor((Number(start.slice(8, 10)) - 1) / 7) + 1,
          label: `Week of ${format(new Date(dw.weekStartDate), "d MMM")} · not generated yet`,
          status: "NO_PLAN",
          weekStartDate: dw.weekStartDate,
        });
      }
    }
    return options.sort((a, b) => a.weekStartDate.localeCompare(b.weekStartDate));
  }, [currentMonth, demandWeeks]);

  // ─── Rule violations block publish; unfilled slots only warn ────
  const ruleViolationsCount =
    state?.violations?.filter((v) => !v.fixed && v.kind !== "unfilled").length || 0;
  const unfilledCount =
    state?.violations?.filter((v) => !v.fixed && v.kind === "unfilled").length || 0;

  const handleApprove = async () => {
    try {
      await approveSchedule();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // Compute Cost
  const totalCost = useMemo(() => {
    if (!state?.grid) return 0;
    let cost = 0;
    STAFF.forEach(st => {
      for(let d=0; d<7; d++) {
        const shifts = state.grid[`${st.id}-${d}`] || [];
        shifts.forEach(s => {
          cost += s.durationHours * st.hrSalary;
        });
      }
    });
    return cost;
  }, [state?.grid]);

  if (!id) return null;

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans pb-24">
      <div className="w-full mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <CalendarDays className="h-6 w-6 text-slate-400" />
              Schedule Planner
              {currentMonth && (
                <span className="text-base font-semibold text-slate-400">
                  · {format(new Date(currentMonth.year, currentMonth.month - 1, 1), "MMMM yyyy")}
                </span>
              )}
            </h1>
            <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/schedule')} className="mr-2 text-slate-400 hover:text-slate-700 h-6 px-2">
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <span className="font-medium text-slate-700">{format(baseDate, "d MMM")} – {format(addDays(baseDate, 6), "d MMM yyyy")}</span>
              <span className="mx-1">·</span>
              {state?.published ? <span className="font-semibold text-emerald-600">Published — visible to staff</span> : "Draft — invisible to staff until approved"}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Week selector — switch between the month's weeks */}
            {weekOptions.length > 0 && (
              <Select value={id} onValueChange={(v) => v !== id && navigate(`/dashboard/schedule/${v}`)}>
                <SelectTrigger className="w-[230px] bg-white">
                  <SelectValue placeholder="Select week" />
                </SelectTrigger>
                <SelectContent>
                  {weekOptions.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.label}
                      {w.status === "PUBLISHED" ? " ✓" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {state?.generated && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg border border-slate-200">
                  <DollarSign className="h-4 w-4 text-slate-500" />
                  <span className="font-mono text-sm font-semibold text-slate-700">{totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>

                <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1.5 rounded-md border ${ruleViolationsCount > 0 ? "bg-red-50 text-red-700 border-red-200" : unfilledCount > 0 ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                  {ruleViolationsCount > 0
                    ? `${ruleViolationsCount} rule violation${ruleViolationsCount > 1 ? "s" : ""}`
                    : unfilledCount > 0
                      ? `${unfilledCount} unfilled slot${unfilledCount > 1 ? "s" : ""}`
                      : "All rules pass ✓"}
                </span>

                <Button
                  onClick={handleApprove}
                  disabled={state.published || ruleViolationsCount > 0}
                  title={ruleViolationsCount > 0 ? "Fix the L-GAV rule violations before publishing." : undefined}
                  className={`gap-2 ${state.published ? "" : "bg-emerald-600 hover:bg-emerald-700 text-white"}`}
                  variant={state.published ? "outline" : "default"}
                >
                  {state.published ? "Published ✓" : "Approve & Publish"}
                </Button>
              </div>
            )}

            <Button  onClick={() => generateSchedule()} disabled={isGenerating} variant={state?.generated ? "outline" : "default"} className={!state?.generated ? "bg-blue-600 text-white hover:bg-blue-700" : ""}>
              {isGenerating ? "Generating..." : state?.generated ? <><Settings2 className="h-4 w-4 mr-2" /> Regenerate</> : "Generate Schedule"}
            </Button>
          </div>
        </div>

        {/* No-demand warning for this week */}
        {state && !state.hasDemand && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-800">No demand set for this week</p>
              <p className="text-sm text-amber-700 mt-0.5">
                This week has no staffing demand yet, so nothing can be scheduled for it. Set the
                week's demand on the{" "}
                <button
                  className="underline font-semibold hover:text-amber-900"
                  onClick={() => navigate("/dashboard/demands")}
                >
                  Demand page
                </button>{" "}
                first, then come back and generate.
              </p>
            </div>
          </div>
        )}

        {/* Main Content */}
        {!state ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center mt-8">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Loading Schedule...</h3>
          </div>
        ) : !state.generated ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center mt-8">
            <div className="mx-auto w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-4">
              <CalendarDays className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">No proposal yet</h3>
            <p className="text-slate-500 max-w-md mx-auto mb-6 text-sm">
              The system combines your demand with the submitted availabilities, applies the L-GAV rules and fairness, and drafts the month. You always keep the last word.
            </p>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-500">

            {/* Diff UI Summary */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-6 shadow-sm overflow-x-auto">
              <div className="flex items-center gap-2 text-slate-500 shrink-0">
                <Activity className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Demand Fill Rate</span>
              </div>
              <div className="flex gap-4 flex-1">
                {Object.keys(FN_LABELS).map(fn => {
                  let totalRequired = 0;
                  let totalAssigned = 0;

                  for(let d=0; d<7; d++) {
                    totalRequired += state.demands?.[d]?.[fn as keyof typeof state.demands[0]] || 0;
                    STAFF.forEach(st => {
                      const shifts = state.grid[`${st.id}-${d}`] || [];
                      totalAssigned += shifts.filter(s => s.fn === fn).length;
                    });
                  }

                  if (totalRequired === 0) return null;
                  const isUnder = totalAssigned < totalRequired;

                  return (
                    <div key={fn} className="flex flex-col gap-1 min-w-[120px]">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-700">{FN_LABELS[fn]}</span>
                        <span className={`font-mono font-bold ${isUnder ? "text-orange-600" : "text-emerald-600"}`}>
                          {totalAssigned}/{totalRequired}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${isUnder ? "bg-orange-500" : "bg-emerald-500"}`}
                          style={{ width: `${Math.min(100, (totalAssigned/totalRequired)*100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* View Demand Button */}
              <div className="shrink-0 ml-auto pl-4 border-l border-slate-200 h-10 flex items-center">
                <Button variant="outline" size="sm" onClick={() => setShowDemandModal(true)} className="text-xs font-semibold h-8 bg-white hover:bg-slate-50 text-slate-700">
                  View Demand
                </Button>
              </div>
            </div>

            <ScheduleGrid
              days={days}
              staffList={STAFF}
              grid={state.grid}
              violations={state.violations}
              onShiftClick={(staff, dayIdx, shift) => setSelectedShift({ staff, dayIdx, shift })}
              onRemoveShift={(staffId, dayIdx, shiftId) => removeShift({staffId, dayIdx, shiftId})}
              onSlotClick={(violId, dayIdx, fnKey, needLabel) => setAssignData({ violId, dayIdx, fnKey, needLabel })}
            />

            <p className="text-xs text-slate-500 font-medium px-1 flex items-center justify-between">
              <span>★ = matches a staff wish · ⚠ = rule issue · Click any shift for details, click empty cells or red slots to assign.</span>
            </p>

            <ViolationsPanel
              violations={state.violations}
              onApplyFix={applyFix}
              onAssignSlot={(id) => {
                const v = state.violations.find(x => x.id === id);
                if (v && v.day !== undefined) {
                  setAssignData({ violId: v.id, dayIdx: v.day, fnKey: v.fnKey, needLabel: v.need });
                }
              }}
            />
          </div>
        )}

      </div>

      {/* Modals */}

      <AssignSlotSheet
        open={!!assignData}
        onOpenChange={(open) => !open && setAssignData(null)}
        assignData={assignData}
        violations={state?.violations || []}
        onAssign={(violId, staffName, dayIdx, fnKey, tm, compOption) => assignSlot({ violId, staffName, dayIdx, fnKey, tm, compOption })}
      />

      <ShiftInfoModal
        open={!!selectedShift}
        onOpenChange={(open) => !open && setSelectedShift(null)}
        shiftInfo={selectedShift}
        violations={state?.violations || []}
        onRemove={(staffId, dayIdx, shiftId) => removeShift({ staffId, dayIdx, shiftId })}
        onEditTime={(staffId, dayIdx, shiftId, newTm) => editShiftTime({ staffId, dayIdx, shiftId, newTm })}
        onApplyFix={applyFix}
      />

      {state?.demands && (
        <ViewDemandModal
          open={showDemandModal}
          onOpenChange={setShowDemandModal}
          demands={state.demands}
          days={days}
        />
      )}
    </div>
  );
}

import { format } from "date-fns";
import { AlertTriangle, Plus, CheckCircle2, Clock, X } from "lucide-react";
import type { Shift, Staff, Violation } from "../hooks/use-schedule";
import { FN_LABELS } from "../hooks/use-schedule";

interface ShiftChipProps {
  shift: Shift;
  isViolOpen: boolean;
  onClick: () => void;
  onRemove: () => void;
}

export function ShiftChip({ shift, isViolOpen, onClick, onRemove }: ShiftChipProps) {
  const isWish = shift.wish;
  const isPending = shift.status === "pending";
  const isAccepted = shift.status === "accepted";
  
  let baseClass = "group relative flex flex-col gap-0.5 rounded-lg p-2 text-xs font-semibold border cursor-pointer hover:shadow-sm transition-all";
  
  if (isViolOpen) {
    baseClass += " bg-red-50 text-red-700 border-red-200 hover:bg-red-100";
  } else if (isWish) {
    baseClass += " bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100";
  } else if (isPending) {
    baseClass += " bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 border-dashed";
  } else if (isAccepted) {
    baseClass += " bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100";
  } else {
    baseClass += " bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100";
  }

  return (
    <div className={baseClass} onClick={onClick}>
      {/* Admin Quick Remove Button (Visible on Hover) */}
      <button 
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute -top-2 -right-2 bg-white border shadow-sm rounded-full p-0.5 text-slate-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity z-10 hidden md:block"
        title="Remove Shift"
      >
        <X className="h-3 w-3" />
      </button>

      <div className="flex items-start justify-between gap-1 pr-2">
        <span>{shift.label}</span>
        {isViolOpen && <AlertTriangle className="h-3 w-3 shrink-0 text-red-500" />}
      </div>
      <span className="font-mono text-[10.5px] opacity-80">{shift.tm}</span>
      
      {isPending && (
        <div className="absolute top-0 right-0 -mt-1.5 -mr-1.5 bg-blue-100 p-0.5 rounded-full border border-blue-200 shadow-sm" title="Pending Acceptance">
          <Clock className="h-3 w-3 text-blue-600" />
        </div>
      )}
      
      {isAccepted && (
        <div className="absolute top-0 right-0 -mt-1.5 -mr-1.5 bg-emerald-100 p-0.5 rounded-full border border-emerald-200 shadow-sm" title="Accepted">
          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
        </div>
      )}
    </div>
  );
}

interface ScheduleGridProps {
  days: Date[];
  staffList: Staff[];
  grid: Record<string, Shift[]>;
  violations: Violation[];
  onShiftClick: (staff: Staff, dayIdx: number, shift: Shift) => void;
  onRemoveShift: (staffId: string, dayIdx: number, shiftId: string) => void;
  onSlotClick: (violId: string | null, dayIdx: number, fnKey?: string, needLabel?: string) => void;
}

export function ScheduleGrid({ days, staffList, grid, violations, onShiftClick, onRemoveShift, onSlotClick }: ScheduleGridProps) {
  
  const unfilledDemands = violations.filter(v => v.kind === "unfilled" && !v.fixed);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto shadow-sm">
      <table className="w-full text-sm text-left border-collapse min-w-[900px]">
        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
          <tr>
            <th className="px-4 py-3 font-semibold bg-slate-50 sticky left-0 z-20 w-56 shadow-[1px_0_0_0_#e2e8f0]">Staff Member</th>
            {days.map((day, i) => (
              <th key={i} className="px-3 py-3 font-semibold border-l border-slate-200 min-w-[140px]">
                {format(day, "EEE, MMM d")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {staffList.map(st => (
            <tr key={st.id} className="hover:bg-slate-50/50 transition-colors">
              <td className="px-4 py-3 bg-white sticky left-0 z-10 shadow-[1px_0_0_0_#e2e8f0]">
                <div className="font-semibold text-slate-900 flex justify-between items-start">
                  {st.name}
                  <span className="text-[10px] text-slate-400 font-mono">${st.hrSalary}/h</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {st.fn.map(f => FN_LABELS[f] || f).join(" · ")}
                </div>
                <div className="flex gap-1.5 mt-1.5">
                  <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                    {st.type}
                  </span>
                  {st.pct ? (
                    <span className="inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                      {st.pct}%
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                      Casual
                    </span>
                  )}
                </div>
              </td>
              {days.map((_, di) => {
                const shifts = grid[`${st.id}-${di}`] || [];
                return (
                  <td key={di} className="px-2 py-2 border-l border-slate-100 align-top group/cell relative">
                    {/* Add Shift Button for Admin directly on empty cells */}
                    <button 
                      onClick={() => onSlotClick(null, di)}
                      className="absolute inset-0 w-full h-full flex items-center justify-center bg-slate-50 opacity-0 group-hover/cell:opacity-100 transition-opacity z-0"
                    >
                      <Plus className="h-5 w-5 text-slate-400" />
                    </button>
                    
                    <div className="flex flex-col gap-2 relative z-10">
                      {shifts.map((s) => {
                        // A shift renders red when it carries a rule violation
                        // (flagged by the backend) or an open violation entry
                        // references it directly.
                        const isViolOpen =
                          !!s.viol ||
                          violations.some(
                            (x) => !x.fixed && x.shiftIds?.includes(s.id)
                          );

                        return (
                          <ShiftChip
                            key={s.id}
                            shift={s}
                            isViolOpen={isViolOpen}
                            onClick={() => onShiftClick(st, di, s)}
                            onRemove={() => onRemoveShift(st.id, di, s.id)}
                          />
                        );
                      })}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
          
          {/* Unfilled Demands Row */}
          {unfilledDemands.length > 0 && (
            <tr className="bg-red-50/30">
              <td className="px-4 py-3 bg-red-50/50 sticky left-0 z-10 shadow-[1px_0_0_0_#fecaca]">
                <div className="font-semibold text-red-700 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" />
                  Unfilled Demand
                </div>
                <div className="text-xs text-red-600/80 mt-0.5">Click slots to assign</div>
              </td>
              {days.map((_, di) => {
                const missingForDay = unfilledDemands.filter(x => x.day === di);
                return (
                  <td key={di} className="px-2 py-2 border-l border-red-100 align-top">
                    <div className="flex flex-col gap-2">
                      {missingForDay.map(m => (
                        <button
                          key={m.id}
                          onClick={() => onSlotClick(m.id, di, m.fnKey, m.need)}
                          className="flex flex-col items-start text-left gap-0.5 rounded-lg border-2 border-dashed border-red-300 bg-red-50/80 p-2 text-xs font-bold text-red-700 hover:bg-red-100 hover:border-red-400 transition-colors"
                        >
                          <div className="flex items-center gap-1">
                            <Plus className="h-3 w-3" /> {FN_LABELS[m.fnKey || ""] || m.fnKey}
                          </div>
                          <span className="font-medium text-[10.5px] opacity-80">Assign Staff</span>
                        </button>
                      ))}
                    </div>
                  </td>
                );
              })}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

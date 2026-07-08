import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  CalendarDays,
  Plus,
  Clock,
  CheckCircle2,
  ChevronRight,
  Activity,
  DollarSign,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { type MonthGroup } from "@/features/schedule/api/schedule-api";
import { GenerateMonthModal } from "@/features/schedule/components/schedule-modals";
import { useScheduleMonths, useGenerateMonth } from "@/features/schedule/hooks/use-schedule";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function MonthStatusBadge({ status }: { status: MonthGroup["status"] }) {
  if (status === "PUBLISHED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
        <CheckCircle2 className="h-3 w-3" /> Published
      </span>
    );
  }
  if (status === "PARTIAL") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
        <Activity className="h-3 w-3" /> Partially published
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
      <Clock className="h-3 w-3" /> Draft
    </span>
  );
}

export function ScheduleListPage() {
  const navigate = useNavigate();
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  const { data: months, isLoading } = useScheduleMonths();
  const generateMonth = useGenerateMonth();

  const scheduledMonthKeys = (months ?? []).map((m) => m.key);
  const currentKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const currentMonthScheduled = scheduledMonthKeys.includes(currentKey);

  const handleGenerate = async (year: number, month: number) => {
    const result = await generateMonth.mutateAsync({ year, month });
    const firstGenerated = result.weeks.find((w) => w.result === "generated");
    if (firstGenerated) {
      navigate(`/dashboard/schedule/${firstGenerated.weekPlanId}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans pb-24">
      <div className="w-full mx-auto space-y-6 ">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <CalendarDays className="h-6 w-6 text-slate-400" />
              Schedules
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Generate a monthly schedule from week demand, review it week by week, and publish.
            </p>
          </div>
          <Button
            onClick={() => setShowGenerateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
            disabled={generateMonth.isPending}
            title={
              currentMonthScheduled
                ? "The current month already has a schedule — you can still generate a future month."
                : undefined
            }
          >
            <Plus className="h-4 w-4" />
            {generateMonth.isPending ? "Generating..." : "Generate Schedule"}
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center p-12 text-slate-500">Loading schedules...</div>
        ) : !months || months.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center mt-8">
            <div className="mx-auto w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-4">
              <CalendarDays className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">No schedules found</h3>
            <p className="text-slate-500 max-w-md mx-auto mb-6 text-sm">
              Set week demand on the Demand page, then generate your first monthly schedule to
              start planning shifts for your team.
            </p>
            <Button
              onClick={() => setShowGenerateModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Generate Schedule
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {months.map((m) => (
              <div
                key={m.key}
                className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
              >
                <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-indigo-50 text-indigo-600 flex flex-col items-center justify-center font-bold shrink-0">
                      <span className="text-[10px] leading-none uppercase text-indigo-400">
                        {m.year}
                      </span>
                      <span className="text-sm leading-none mt-1">
                        {MONTH_NAMES[m.month - 1]?.slice(0, 3)}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Schedule — {MONTH_NAMES[m.month - 1]} {m.year}
                      </h3>
                      <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>Created {format(new Date(m.createdAt), "d MMM yyyy")}</span>
                        <span>&bull;</span>
                        <span className="inline-flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          Cost{" "}
                          {m.estimatedCost.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                        <span>&bull;</span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {m.totalDemand} total demand
                        </span>
                        <span>&bull;</span>
                        <span>
                          {m.weekCount} week{m.weekCount !== 1 ? "s" : ""} · {m.totalShifts} shifts
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <MonthStatusBadge status={m.status} />
                    <Button
                      onClick={() => m.weeks[0] && navigate(`/dashboard/schedule/${m.weeks[0].id}`)}
                      variant="outline"
                      className="gap-1"
                      disabled={m.weeks.length === 0}
                    >
                      View Schedule <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Week strip */}
                <div className="border-t border-slate-100 px-5 py-3 flex flex-wrap gap-2 bg-slate-50/50">
                  {m.weeks.map((w) => (
                    <button
                      key={w.id}
                      onClick={() => navigate(`/dashboard/schedule/${w.id}`)}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-colors"
                    >
                      <span className="text-indigo-600">Wk {w.weekNumber}</span>
                      <span className="text-slate-400 font-normal">
                        {format(new Date(w.weekStartDate), "d MMM")} –{" "}
                        {format(new Date(w.weekEndDate), "d MMM")}
                      </span>
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          w.status === "PUBLISHED" ? "bg-emerald-500" : "bg-amber-400"
                        }`}
                        title={w.status === "PUBLISHED" ? "Published" : "Draft"}
                      />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <GenerateMonthModal
        open={showGenerateModal}
        onOpenChange={setShowGenerateModal}
        onGenerate={handleGenerate}
        scheduledMonthKeys={scheduledMonthKeys}
      />
    </div>
  );
}

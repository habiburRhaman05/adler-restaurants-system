import { useState, useMemo, useEffect } from "react";
import { Plus, Minus, X, CalendarDays, CheckCircle2 } from "lucide-react";
import { useCategoryTree } from "@/features/categories/hooks/use-categories";
import {
  useDemandGrid,
  useDemandWeeks,
  useCreateDemandWeek,
  useSaveDemandWeek,
  usePublishDemandWeek,
} from "@/features/demands/hooks/use-demands";
import type { DemandWeek, CategoryDemandRow } from "@/features/demands/api/demand.service";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* =========================================================================
   Helper functions
   ========================================================================= */

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MS_DAY = 86400000;

function startOfWeek(d: Date) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - date.getDay());
  return date;
}

function formatRangeStr(startStr: string) {
  const start = new Date(startStr);
  const end = new Date(start.getTime() + 6 * MS_DAY);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const year = end.getFullYear();
  return `${start.toLocaleDateString("en-US", opts)} \u2013 ${end.toLocaleDateString("en-US", opts)}, ${year}`;
}

function formatRange(start: Date) {
  return formatRangeStr(start.toISOString());
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// Convert API week to local draft structure
function cloneValues(categories: CategoryDemandRow[]) {
  const copy: Record<string, Record<string, number>> = {};
  categories.forEach((cat) => {
    copy[cat.category.id] = {};
    cat.cells.forEach((cell) => {
      copy[cat.category.id][cell.date] = cell.requiredCount;
    });
  });
  return copy;
}

/* =========================================================================
   Shared table body
   ========================================================================= */

function DemandTable({ days, categories, draft, onStep }: any) {
  return (
    <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
      <thead>
        <tr>
          <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-2 w-32">Category</th>
          {days.map((day: any) => (
            <th key={day.key} className="pb-2 px-1">
              <div className="text-xs font-semibold text-gray-900">{day.label}</div>
              <div className="text-[11px] text-gray-400">{day.dateLabel}</div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {categories.map((cat: any, i: number) => (
          <tr key={cat.id || cat.category?.id} className={i !== 0 ? "border-t border-gray-100" : ""}>
            <td className="py-2.5 pr-2 text-sm font-medium text-gray-800">{cat.name || cat.category?.name}</td>
            {days.map((day: any) => {
              const catId = cat.id || cat.category?.id;
              const value = draft[catId]?.[day.key] || 0;
              return (
                <td key={day.key} className="py-2.5 px-1">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      aria-label={`Decrease ${cat.name || cat.category?.name} on ${day.label}`}
                      onClick={() => onStep(catId, day.key, -1)}
                      className="w-6 h-6 flex items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-6 text-center text-sm font-medium text-gray-900 tabular-nums">
                      {value}
                    </span>
                    <button
                      aria-label={`Increase ${cat.name || cat.category?.name} on ${day.label}`}
                      onClick={() => onStep(catId, day.key, 1)}
                      className="w-6 h-6 flex items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* =========================================================================
   WeekCardView
   ========================================================================= */

function WeekCardView({ week, categories, tone = "default" }: { week: DemandWeek, categories: any[], tone: string }) {
  const [draft, setDraft] = useState(() => cloneValues(week.categories));
  const [dirty, setDirty] = useState(false);
  
  const saveMutation = useSaveDemandWeek();
  const publishMutation = usePublishDemandWeek();

  // Reset draft if week updates from server
  useEffect(() => {
    if (!dirty) {
      setDraft(cloneValues(week.categories));
    }
  }, [week, dirty]);

  const handleStep = (catId: string, dayKey: string, delta: number) => {
    setDraft((prev: any) => {
      const next: Record<string, Record<string, number>> = {};
      Object.keys(prev).forEach(k => {
        next[k] = { ...prev[k] };
      });
      if (!next[catId]) next[catId] = {};
      next[catId][dayKey] = Math.max(0, (next[catId][dayKey] || 0) + delta);
      return next;
    });
    setDirty(true);
  };

  const handleSave = () => {
    const demands = [];
    
    // Create map of original values to compute diff
    const original: Record<string, Record<string, number>> = {};
    week.categories.forEach((cat) => {
      original[cat.category.id] = {};
      cat.cells.forEach((cell) => {
        original[cat.category.id][cell.date] = cell.requiredCount;
      });
    });

    for (const catId of Object.keys(draft)) {
      for (const date of Object.keys(draft[catId])) {
        const newValue = draft[catId][date];
        const oldValue = original[catId]?.[date] || 0;
        
        // Only include cells that have actually changed
        if (newValue !== oldValue) {
          demands.push({
            categoryId: catId,
            date: date,
            requiredCount: newValue,
          });
        }
      }
    }

    if (demands.length > 0) {
      saveMutation.mutate(
        { weekId: week.id, data: { demands } },
        {
          onSuccess: () => setDirty(false),
        }
      );
    } else {
      setDirty(false);
    }
  };

  const handlePublish = () => {
    publishMutation.mutate(week.id);
  };

  const days = week.days.map((dStr) => {
    const d = new Date(dStr);
    return {
      key: dStr,
      label: DAY_LABELS[d.getDay()],
      dateLabel: d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    };
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 flex flex-col gap-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays size={15} className="text-gray-400" />
            <span className="text-sm font-medium text-gray-900">{formatRangeStr(week.weekStartDate)}</span>
          </div>
          {tone === "upcoming" && (
            <span className="inline-block mt-1.5 mr-2 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
              Upcoming plan
            </span>
          )}
          {tone === "current" && (
            <span className="inline-block mt-1.5 mr-2 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
              Current week
            </span>
          )}
          {week.status === 'PUBLISHED' && (
            <span className="inline-block mt-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              Published
            </span>
          )}
          {week.status === 'DRAFT' && (
            <span className="inline-block mt-1.5 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
              Draft
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {week.status === 'DRAFT' && (
            <button
              onClick={handlePublish}
              disabled={publishMutation.isPending || dirty}
              className={`shrink-0 flex items-center gap-1.5 text-sm font-bold rounded-lg px-4 py-2 border transition-colors ${
                publishMutation.isPending || dirty
                  ? "border-gray-200 text-gray-400 cursor-not-allowed"
                  : "border-emerald-600 text-emerald-600 hover:bg-emerald-50"
              }`}
            >
              <CheckCircle2 size={15} /> Publish
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!dirty || saveMutation.isPending}
            className={`shrink-0 text-sm font-bold rounded-lg px-5 py-2 text-white transition-colors ${
              dirty && !saveMutation.isPending ? "bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20" : "bg-blue-300 cursor-not-allowed"
            }`}
          >
            {saveMutation.isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto mt-2">
        <DemandTable days={days} categories={categories} draft={draft} onStep={handleStep} />
      </div>
    </div>
  );
}

/* =========================================================================
   WeekPlanModal
   ========================================================================= */

function WeekPlanModal({ nextTargetStart, onClose }: any) {
  const targetStart = nextTargetStart;
  const targetLabel = formatRange(targetStart);

  const { data: lwData, isLoading } = useDemandWeeks();
  const createMutation = useCreateDemandWeek();

  const [usePrev, setUsePrev] = useState(true);
  const mostRecentWeek = (lwData?.weeks || [])[0];

  const handleSave = () => {
    // Format targetStart locally to avoid UTC offset shifting the date
    const yyyy = targetStart.getFullYear();
    const mm = String(targetStart.getMonth() + 1).padStart(2, "0");
    const dd = String(targetStart.getDate()).padStart(2, "0");
    const localDateStr = `${yyyy}-${mm}-${dd}`;

    createMutation.mutate(
      {
        weekStartDate: localDateStr,
        copyFromWeekId: usePrev && mostRecentWeek ? mostRecentWeek.id : undefined,
      },
      {
        onSuccess: () => onClose(),
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Create week plan</h2>
            <p className="text-sm font-medium text-gray-500 mt-0.5">{targetLabel}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 p-1.5 rounded-full transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-6 space-y-4">
          <p className="text-sm text-gray-600">
            This will create a new draft demand plan for the week of <strong>{targetLabel}</strong>.
          </p>
          {isLoading ? (
             <p className="text-sm text-gray-500">Checking previous weeks...</p>
          ) : mostRecentWeek ? (
             <label className="flex items-center gap-3 text-sm font-medium text-gray-800 cursor-pointer p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={usePrev}
                onChange={(e) => setUsePrev(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
              Start by copying requirements from <strong>{formatRangeStr(mostRecentWeek.weekStartDate)}</strong>
            </label>
          ) : (
            <p className="text-sm text-gray-500 italic">No previous weeks found to copy from.</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={onClose}
            className="text-sm font-bold text-gray-700 border border-gray-200 rounded-xl px-5 py-2.5 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={createMutation.isPending}
            className="text-sm font-bold rounded-xl px-6 py-2.5 text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 disabled:opacity-50 transition-colors"
          >
            {createMutation.isPending ? "Creating..." : "Create Plan"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   DemandPage
   ========================================================================= */

const FILTER_OPTIONS = [
  { value: "upcoming", label: "Upcoming & Current" },
  { value: "month", label: "Specific month" },
];

export default function DemandPage() {
  const [filter, setFilter] = useState("upcoming"); // 'upcoming' | 'month'
  const [selectedMonth, setSelectedMonth] = useState(() => monthKey(new Date()));
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Fetch category tree
  const { data: categoryData, isLoading: isLoadingCategories, isError: isErrorCategories } = useCategoryTree();
  const categories = categoryData?.data?.categories ?? [];

  // Construct query params
  const scope = filter;
  // If month, provide the first day of that month as reference date
  const date = filter === "month" ? `${selectedMonth}-01` : undefined;

  // Fetch demand grid
  const { data: gridRes, isLoading: isLoadingGrid, isError: isErrorGrid } = useDemandGrid(scope, date);
  const gridData = (gridRes as any)?.data || gridRes; // Handle unwrapped data or envelope just in case
  const weeks = gridData?.weeks || [];
  const currentWeekMeta = gridData?.currentWeek;

  // Derive target start for creation modal
  const nextTargetStart = useMemo(() => {
    if (weeks.length === 0) {
      return startOfWeek(new Date());
    } else {
      const lastWeekStr = weeks[weeks.length - 1].weekStartDate;
      return new Date(new Date(lastWeekStr).getTime() + 7 * MS_DAY);
    }
  }, [weeks]);

  // Derived available months for the month selector. 
  // Generate current month and next 11 months, preventing selection of past months
  const availableMonths = useMemo(() => {
    const list = [];
    const d = new Date();
    // Start from current month (do not subtract 6 months)
    for (let i = 0; i < 12; i++) {
      list.push({
        value: monthKey(d),
        label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      });
      d.setMonth(d.getMonth() + 1);
    }
    return list;
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-8">
      <div className="w-full mx-auto flex flex-col gap-6">
  
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Weekly Demand</h1>
            <p className="text-sm font-medium text-gray-500 mt-1">
              Plan and update how much of each category your team needs, week by week.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-[200px] h-10 rounded-xl bg-white border-gray-200/80 shadow-sm hover:border-gray-300 hover:bg-gray-50 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200 font-semibold text-gray-800">
                  <SelectValue placeholder="Select filter" />
                </SelectTrigger>
                <SelectContent className="rounded-xl shadow-lg border-gray-100">
                  {FILTER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="font-medium cursor-pointer py-2 focus:bg-blue-50">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {filter === "month" && (
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-[200px] h-10 rounded-xl bg-white border-gray-200/80 shadow-sm hover:border-gray-300 hover:bg-gray-50 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all duration-200 font-semibold text-gray-800">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl shadow-lg border-gray-100 max-h-[300px]">
                    {availableMonths.map((m) => (
                      <SelectItem key={m.value} value={m.value} className="font-medium cursor-pointer py-2 focus:bg-blue-50">
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 text-sm font-bold text-white rounded-xl px-5 py-2.5 bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-all"
            >
              <Plus size={16} />
              Create week plan
            </button>
          </div>
        </div>

        {isLoadingCategories || isLoadingGrid ? (
          <div className="py-20 flex justify-center">
             <div className="flex flex-col items-center gap-4">
               <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
               <p className="text-gray-500 font-bold animate-pulse tracking-wide">Loading demands...</p>
             </div>
          </div>
        ) : isErrorCategories || categories.length === 0 ? (
          <div className="py-16 flex justify-center">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center max-w-md shadow-sm">
              <p className="text-base font-bold text-rose-900">Failed to load categories or no categories exist.</p>
              <p className="text-sm font-medium text-rose-700 mt-2">Please ensure categories are configured before planning demand.</p>
            </div>
          </div>
        ) : isErrorGrid ? (
          <div className="py-16 flex justify-center">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center max-w-md shadow-sm">
              <p className="text-base font-bold text-rose-900">Failed to load demand plans.</p>
              <p className="text-sm font-medium text-rose-700 mt-2">There was an error communicating with the server.</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* If there's no plan for the current week, show a prompt for it */}
            {currentWeekMeta && !weeks.some((w: DemandWeek) => w.weekStartDate === currentWeekMeta.weekStartDate) && filter === 'upcoming' && (
              <div className="rounded-xl border border-dashed border-blue-300 bg-blue-50/50 p-6 flex items-center justify-between shadow-sm">
                <div>
                  <h3 className="text-base font-bold text-blue-900">Current Week: {formatRangeStr(currentWeekMeta.weekStartDate)}</h3>
                  <p className="text-sm font-medium text-blue-700 mt-1">No demand plan exists for the current week yet.</p>
                </div>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-5 py-2.5 shadow-md shadow-blue-600/20 transition-all"
                >
                  <Plus size={16} />
                  Create for Current Week
                </button>
              </div>
            )}

            {weeks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center shadow-sm mt-4">
                  <p className="text-lg font-bold text-gray-900">No plans found</p>
                  <p className="text-sm font-medium text-gray-500 mt-1">Start by creating a weekly demand plan.</p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl px-6 py-3 shadow-md shadow-blue-600/20 transition-all"
                  >
                    <Plus size={16} />
                    Create plan
                  </button>
                </div>
            ) : (
              weeks.map((w: DemandWeek) => (
                <WeekCardView
                  key={w.id}
                  week={w}
                  categories={categories}
                  tone={w.relative}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Modal — creation only */}
      {showCreateModal && (
        <WeekPlanModal
          nextTargetStart={nextTargetStart}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}
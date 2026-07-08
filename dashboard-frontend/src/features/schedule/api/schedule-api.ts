import { apiClient } from "@/lib/api-client";

// ─── Types (the contract the existing grid/modals already expect) ─
export interface Staff {
  id: string; // real user id
  name: string;
  fn: string[]; // category ids the employee belongs to
  pct: number;
  type: string;
  hrSalary: number;
}

export interface Shift {
  id: string;
  label: string;
  fn: string; // category id
  tm: string; // e.g. "17:00–23:30"
  durationHours: number;
  wish?: boolean;
  viol?: string | null;
  status?: "pending" | "accepted" | "rejected";
}

export interface Violation {
  id: string;
  kind: "rest" | "week" | "unfilled";
  fixed: boolean;
  who: string | null;
  h: string;
  why: string;
  fix: string | null;
  cells?: number[][];
  day?: number;
  need?: string;
  fnKey?: string;
  // Real-data extensions used by the adapter (not rendered directly):
  shiftIds?: string[];
  startTime?: string;
  endTime?: string;
}

export type DailyDemand = Record<string, number>; // categoryId -> required count

export interface ScheduleState {
  generated: boolean;
  published: boolean;
  grid: Record<string, Shift[]>; // `${userId}-${dayIdx}`
  violations: Violation[];
  month: number;
  weekRange: number;
  demands: DailyDemand[];
  weekPlanId: string | null;
  weekStart: string; // ISO date of the week's Monday
  hasDemand: boolean;
}

export interface WeeklyPlanBrief {
  id: string;
  year: number;
  month: number;
  weekNumber: number;
  weekStartDate: string;
  weekEndDate: string;
  status: "DRAFT" | "SUBMITTED" | "PUBLISHED";
  shiftCount: number;
  demandCount: number;
}

// ─── Month-grouped plans (schedule list page cards) ──────────────
export interface MonthWeekBrief {
  id: string;
  weekNumber: number;
  weekStartDate: string;
  weekEndDate: string;
  status: "DRAFT" | "SUBMITTED" | "PUBLISHED";
  shiftCount: number;
  demandCount: number;
  totalDemand: number;
  estimatedCost: number;
}

export interface MonthGroup {
  key: string; // "YYYY-MM"
  year: number;
  month: number; // 1-12
  createdAt: string;
  weekCount: number;
  publishedWeekCount: number;
  status: "DRAFT" | "PARTIAL" | "PUBLISHED";
  totalShifts: number;
  totalDemand: number;
  totalHours: number;
  estimatedCost: number;
  weeks: MonthWeekBrief[];
}

export interface GenerateMonthResult {
  year: number;
  month: number;
  generatedCount: number;
  skippedPublishedCount: number;
  weeks: {
    weekPlanId: string;
    weekNumber: number;
    weekStartDate: string;
    weekEndDate: string;
    status: string;
    result: "generated" | "skipped_published";
    createdCount: number;
    unfilledCount: number;
  }[];
  weeksWithoutDemand: { weekStartDate: string; weekEndDate: string }[];
}

// Demand-page weeks (used to offer "not generated yet" weeks in the selector).
export interface DemandWeekBrief {
  id: string;
  weekStartDate: string;
  weekEndDate: string;
  status: string;
  demandCount: number;
}

// Dynamic registries kept module-level so the existing components (which
// import STAFF / FN_LABELS statically) keep working — the adapter refreshes
// them from the real API on every schedule fetch, before state is returned.
export const STAFF: Staff[] = [];
export const FN_LABELS: Record<string, string> = {};

export function parseDuration(tm: string): number {
  try {
    const [start, end] = tm.split("–");
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    let duration = (eh + em / 60) - (sh + sm / 60);
    if (duration < 0) duration += 24;
    return duration;
  } catch {
    return 6;
  }
}

// ─── Date helpers (UTC, matching how the backend stores dates) ───
const pad = (n: number) => String(n).padStart(2, "0");

const dateOnlyUTC = (d: Date) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

const hhmmUTC = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

const tmOf = (startIso: string, endIso: string) => `${hhmmUTC(startIso)}–${hhmmUTC(endIso)}`;

const addDaysUTC = (d: Date, n: number) => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
};

// ISO 8601 week logic (week starts on Monday). 
// The first week of a month is the week containing the 1st of the month.
const weekStartFor = (year: number, month0: number, weekRange: number): Date | null => {
  const d = new Date(Date.UTC(year, month0, 1));
  // getUTCDay: 0=Sun, 1=Mon, ..., 6=Sat
  // distance to previous Monday:
  const diffToMonday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diffToMonday);
  d.setUTCDate(d.getUTCDate() + (weekRange - 1) * 7);
  return d;
};

const dayIdxOf = (dateIso: string, weekStart: Date) => {
  const d = new Date(dateIso);
  return Math.round(
    (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - weekStart.getTime()) /
      (24 * 3600 * 1000)
  );
};

// ─── Backend payload shapes (subset we consume) ──────────────────
type ApiUser = {
  id: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  isActive?: boolean;
  employeeType?: string | null;
  contractType?: string | null;
  workloadPercent?: string | number | null;
  hourlyRate?: string | number | null;
  categories?: { id: string; name: string }[];
};

type ApiShift = {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string;
    hourlyRate: string | number | null;
  };
  categoryId: string;
  category: { id: string; name: string };
  date: string;
  startTime: string;
  endTime: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED" | "SWAPPED_OUT";
  rulePassed: boolean;
  ruleViolations: string[] | null;
};

type ApiScheduleDetail = {
  plan: { id: string; status: "DRAFT" | "SUBMITTED" | "PUBLISHED"; weekStartDate: string };
  shifts: ApiShift[];
  unfilledDemands: {
    demandId: string;
    date: string;
    categoryId: string;
    categoryName: string;
    startTime: string;
    endTime: string;
    requiredCount: number;
    assignedCount: number;
    missingCount: number;
  }[];
  violations: {
    shiftId: string;
    userId: string;
    userName: string;
    date: string;
    startTime: string;
    endTime: string;
    violations: any;
  }[];
  demands: ApiDemand[];
};

type ApiWeek = { id: string; weekStartDate: string; status: string };

type ApiDemand = {
  id: string;
  date: string;
  categoryId: string;
  category: { id: string; name: string };
  requiredCount: number;
  startTime: string;
  endTime: string;
};

const displayName = (u: {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
}) => u.name ?? ([u.firstName, u.lastName].filter(Boolean).join(" ") || u.email);

// ─── Registry refresh ────────────────────────────────────────────
const refreshStaff = async () => {
  const data = await apiClient.get<{ users: ApiUser[] }>("/admin/users", {
    params: { limit: 100, isActive: true },
  });
  STAFF.length = 0;
  for (const u of data.users) {
    STAFF.push({
      id: u.id,
      name: displayName(u),
      fn: (u.categories ?? []).map((c) => c.id),
      pct: u.workloadPercent ? Number(u.workloadPercent) : u.contractType === "HOURLY" ? 50 : 100,
      type:
        u.contractType === "MONTHLY_SALARY"
          ? "Monthly"
          : u.contractType === "HOURLY"
            ? "Hourly"
            : u.contractType === "WORKLOAD_PERCENT"
              ? "Workload %"
              : "—",
      hrSalary: u.hourlyRate ? Number(u.hourlyRate) : 0,
    });
    for (const c of u.categories ?? []) FN_LABELS[c.id] = c.name;
  }
};

const findWeekPlan = async (weekStart: Date): Promise<ApiWeek | null> => {
  const res = await apiClient.get<ApiWeek[] | { weeks: ApiWeek[] }>("/admin/demands/weeks", {
    params: {
      year: weekStart.getUTCFullYear(),
      month: weekStart.getUTCMonth() + 1,
      limit: 100,
    },
  });
  
  const weeks = Array.isArray(res) ? res : (res.weeks ?? []);

  // The backend DemandWeek always starts on a Sunday.
  const sundayBefore = new Date(weekStart);
  sundayBefore.setUTCDate(sundayBefore.getUTCDate() - sundayBefore.getUTCDay());

  return (
    weeks.find((w) => dateOnlyUTC(new Date(w.weekStartDate)) === dateOnlyUTC(sundayBefore)) ??
    null
  );
};

// ─── Mapping real data → the grid's ScheduleState ────────────────
const classifyViolation = (messages: string[]): "rest" | "week" =>
  messages.some((m) => m.startsWith("REST_PERIOD")) ? "rest" : "week";

const buildState = (
  detail: ApiScheduleDetail,
  demands: ApiDemand[],
  month: number,
  weekRange: number,
  weekStart: Date
): ScheduleState => {
  const grid: Record<string, Shift[]> = {};

  const visibleShifts = detail.shifts.filter(
    (s) => s.status !== "CANCELLED" && s.status !== "SWAPPED_OUT"
  );
  for (const s of visibleShifts) {
    FN_LABELS[s.categoryId] = s.category.name;
    const dayIdx = dayIdxOf(s.date, weekStart);
    const key = `${s.userId}-${dayIdx}`;
    if (!grid[key]) grid[key] = [];
    grid[key].push({
      id: s.id,
      label: s.category.name,
      fn: s.categoryId,
      tm: tmOf(s.startTime, s.endTime),
      durationHours:
        (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 3600000,
      viol: s.rulePassed ? null : "week",
      status:
        s.status === "PENDING" ? "pending" : s.status === "ACCEPTED" ? "accepted" : "rejected",
    });
  }

  const violations: Violation[] = [];

  for (const v of detail.violations) {
    const kind = classifyViolation(v.violations);
    violations.push({
      id: `v-rule-${v.shiftId}`,
      kind,
      fixed: false,
      who: v.userName,
      h: `${kind === "rest" ? "Rest period too short" : "Working-time rule violated"} — ${v.userName}`,
      why: v.violations.join(" · "),
      fix: "Remove this shift",
      shiftIds: [v.shiftId],
      day: dayIdxOf(v.date, weekStart),
    });
  }

  for (const u of detail.unfilledDemands) {
    const dayIdx = dayIdxOf(u.date, weekStart);
    violations.push({
      id: `v-unf-${u.demandId}`,
      kind: "unfilled",
      fixed: false,
      who: null,
      h: `Unfilled demand — ${u.categoryName} (${dateOnlyUTC(new Date(u.date))})`,
      why: `Demand is ${u.requiredCount} staff for ${u.categoryName}; only ${u.assignedCount} assigned.`,
      fix: null,
      day: dayIdx,
      need: `Need · ${u.categoryName} · ${tmOf(u.startTime, u.endTime)}`,
      fnKey: u.categoryId,
      startTime: u.startTime,
      endTime: u.endTime,
    });
  }

  // Per-day demand totals for the fill-rate bar and the View Demand modal.
  const demandByDay: DailyDemand[] = Array.from({ length: 7 }, () => ({}));
  for (const d of demands) {
    FN_LABELS[d.categoryId] = d.category.name;
    const dayIdx = dayIdxOf(d.date, weekStart);
    if (dayIdx >= 0 && dayIdx < 7) {
      demandByDay[dayIdx][d.categoryId] =
        (demandByDay[dayIdx][d.categoryId] ?? 0) + d.requiredCount;
    }
  }

  return {
    generated: true,
    published: detail.plan.status === "PUBLISHED",
    grid,
    violations,
    month,
    weekRange,
    demands: demandByDay,
    weekPlanId: detail.plan.id,
    weekStart: dateOnlyUTC(weekStart),
    hasDemand: demands.length > 0,
  };
};

const fetchState = async (
  weekPlanId: string,
  month: number,
  weekRange: number,
  weekStart: Date
): Promise<ScheduleState> => {
  const detail = await apiClient.get<ApiScheduleDetail>(`/admin/scheduling/${weekPlanId}`);
  return buildState(detail, detail.demands, month, weekRange, weekStart);
};

// ─── Time construction for manual add/edit ───────────────────────
const isoAt = (weekStart: Date, dayIdx: number, hhmm: string) => {
  const day = addDaysUTC(weekStart, dayIdx);
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), h || 0, m || 0)
  ).toISOString();
};

const splitTm = (tm: string): [string, string] => {
  const [start, end] = tm.split("–");
  return [start?.trim() || "17:00", end?.trim() || "23:30"];
};

// ─── The real API (same method surface the hook consumed before) ─
export const ScheduleAPI = {
  async listPlans(): Promise<WeeklyPlanBrief[]> {
    const data = await apiClient.get<{ plans: WeeklyPlanBrief[] }>('/admin/scheduling');
    return data.plans;
  },

  async listMonths(): Promise<MonthGroup[]> {
    const data = await apiClient.get<{ months: MonthGroup[] }>('/admin/scheduling/months');
    return data.months;
  },

  async generateMonth(year: number, month: number): Promise<GenerateMonthResult> {
    return apiClient.post<GenerateMonthResult>('/admin/scheduling/generate-month', {
      year,
      month,
    });
  },

  // All demand weeks (the Demand page's list) — lets the week selector offer
  // weeks that have demand but no generated plan yet.
  async listDemandWeeks(): Promise<DemandWeekBrief[]> {
    const res = await apiClient.get<DemandWeekBrief[] | { weeks: DemandWeekBrief[] }>(
      '/admin/demands/weeks'
    );
    return Array.isArray(res) ? res : (res.weeks ?? []);
  },

  async getScheduleById(weekPlanId: string): Promise<ScheduleState> {
    await refreshStaff();
    const detail = await apiClient.get<ApiScheduleDetail>(`/admin/scheduling/${weekPlanId}`);
    
    // Determine the week start date safely. 
    // It might be a full ISO string from the backend DateTime field, or a YYYY-MM-DD string.
    const rawDate = detail.plan.weekStartDate;
    const dateStr = rawDate.includes("T") ? rawDate : `${rawDate}T00:00:00.000Z`;
    const weekStart = new Date(dateStr);
    
    // Pass dummy month/weekRange since we're loading by ID
    return buildState(detail, detail.demands, weekStart.getUTCMonth(), 1, weekStart);
  },

  async getSchedule(
    year: number,
    month: number,
    weekRange: number
  ): Promise<ScheduleState | null> {
    await refreshStaff();
    const weekStart = weekStartFor(year, month, weekRange);
    if (!weekStart) return null;

    const week = await findWeekPlan(weekStart);
    if (!week) return null;

    return fetchState(week.id, month, weekRange, weekStart);
  },

  async generateSchedule(year: number, month: number, weekRange: number): Promise<any> {
    const weekStart = weekStartFor(year, month, weekRange);
    if (!weekStart) throw new Error("That month has no such week.");

    const week = await findWeekPlan(weekStart);
    if (!week) {
      throw new Error(
        "No staffing demand exists for this week yet. Add it in Workload before generating a schedule."
      );
    }
    await apiClient.post(`/admin/scheduling/generate`, { weekPlanId: week.id });
    return fetchState(week.id, month, weekRange, weekStart);
  },

  async generateScheduleById(weekPlanId: string, weekStart: Date): Promise<ScheduleState> {
    await apiClient.post(`/admin/scheduling/generate`, { weekPlanId });
    return fetchState(weekPlanId, weekStart.getUTCMonth(), 1, weekStart);
  },

  async approveSchedule(state: ScheduleState): Promise<ScheduleState> {
    if (!state.weekPlanId) throw new Error("No schedule to publish.");
    await apiClient.post(`/admin/scheduling/${state.weekPlanId}/publish`);
    return fetchState(
      state.weekPlanId,
      state.month,
      state.weekRange,
      new Date(`${state.weekStart}T00:00:00.000Z`)
    );
  },

  async removeShift(state: ScheduleState, shiftId: string): Promise<ScheduleState> {
    if (!state.weekPlanId) throw new Error("Schedule not found.");
    await apiClient.delete(`/admin/scheduling/${state.weekPlanId}/shifts/${shiftId}`);
    return fetchState(
      state.weekPlanId,
      state.month,
      state.weekRange,
      new Date(`${state.weekStart}T00:00:00.000Z`)
    );
  },

  async editShiftTime(
    state: ScheduleState,
    dayIdx: number,
    shiftId: string,
    newTm: string
  ): Promise<ScheduleState> {
    if (!state.weekPlanId) throw new Error("Schedule not found.");
    const weekStart = new Date(`${state.weekStart}T00:00:00.000Z`);
    const [startHm, endHm] = splitTm(newTm);
    await apiClient.patch(`/admin/scheduling/${state.weekPlanId}/shifts/${shiftId}`, {
      startTime: isoAt(weekStart, dayIdx, startHm),
      endTime: isoAt(weekStart, dayIdx, endHm),
    });
    return fetchState(state.weekPlanId, state.month, state.weekRange, weekStart);
  },

  async assignSlot(
    state: ScheduleState,
    violId: string | null,
    staffName: string,
    dayIdx: number,
    fnKey: string,
    tm: string,
    compOption?: "overtime" | "reduce-future"
  ): Promise<ScheduleState> {
    if (!state.weekPlanId) throw new Error("Schedule not found.");
    const staff = STAFF.find((s) => s.name === staffName || s.id === staffName);
    if (!staff) throw new Error("Staff member not found.");

    const weekStart = new Date(`${state.weekStart}T00:00:00.000Z`);

    // Prefer the unfilled demand's real slot times over the UI default.
    const viol = violId ? state.violations.find((v) => v.id === violId) : undefined;
    const startTime =
      viol?.startTime ?? isoAt(weekStart, dayIdx, splitTm(tm)[0]);
    const endTime = viol?.endTime ?? isoAt(weekStart, dayIdx, splitTm(tm)[1]);
    const date = dateOnlyUTC(addDaysUTC(weekStart, dayIdx));

    await apiClient.post(`/admin/scheduling/${state.weekPlanId}/shifts`, {
      userId: staff.id,
      categoryId: viol?.fnKey ?? fnKey,
      date,
      startTime,
      endTime,
      // Owner rule: manually filling a slot can reduce the same weekday's
      // demand next week and consume the employee's availability for the day.
      reduceNextWeekDemand: compOption === "reduce-future",
    });
    return fetchState(state.weekPlanId, state.month, state.weekRange, weekStart);
  },

  async applyFix(state: ScheduleState, violId: string): Promise<ScheduleState> {
    const viol = state.violations.find((v) => v.id === violId);
    const shiftId = viol?.shiftIds?.[0];
    if (!viol || !shiftId || !state.weekPlanId) {
      throw new Error("This issue has no automatic fix.");
    }
    await apiClient.delete(`/admin/scheduling/${state.weekPlanId}/shifts/${shiftId}`);
    return fetchState(
      state.weekPlanId,
      state.month,
      state.weekRange,
      new Date(`${state.weekStart}T00:00:00.000Z`)
    );
  },

}

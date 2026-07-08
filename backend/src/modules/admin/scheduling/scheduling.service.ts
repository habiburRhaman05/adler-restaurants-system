import { prisma } from "../../../config/db";
import { AppError } from "../../../utils/AppError";
import type {
  GenerateScheduleInput,
  GenerateMonthInput,
  ListPlansQuery,
  CreateShiftInput,
  UpdateShiftInput,
} from "./scheduling.validation";
import { Prisma } from "../../../generated/prisma/client";

// ─── Date/time helpers (all UTC — dates are stored at UTC midnight) ─
const HOURS_PER_MS = 1 / (1000 * 60 * 60);

const startOfUTCDay = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
};

const sameUTCDate = (a: Date, b: Date) =>
  a.getUTCFullYear() === b.getUTCFullYear() &&
  a.getUTCMonth() === b.getUTCMonth() &&
  a.getUTCDate() === b.getUTCDate();

const dateOnly = (d: Date) => d.toISOString().slice(0, 10);

const durationHours = (s: { startTime: Date; endTime: Date }) =>
  (s.endTime.getTime() - s.startTime.getTime()) * HOURS_PER_MS;

const overlaps = (
  a: { startTime: Date; endTime: Date },
  b: { startTime: Date; endTime: Date }
) => a.startTime < b.endTime && a.endTime > b.startTime;

const displayName = (u: {
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
}) => u.name ?? ([u.firstName, u.lastName].filter(Boolean).join(" ") || u.email);

// ─── Projections ─────────────────────────────────────────────────
const planSelect = {
  id: true,
  year: true,
  month: true,
  weekNumber: true,
  weekStartDate: true,
  weekEndDate: true,
  status: true,
  submittedAt: true,
  needsRenotify: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.WeeklyPlanSelect;

const shiftSelect = {
  id: true,
  weeklyPlanId: true,
  userId: true,
  user: {
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      hourlyRate: true,
    },
  },
  categoryId: true,
  category: { select: { id: true, name: true } },
  date: true,
  startTime: true,
  endTime: true,
  status: true,
  rejectionReason: true,
  rulePassed: true,
  ruleViolations: true,
  notifiedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ShiftSelect;

// ─── L-GAV rule engine (shared by generation and manual overrides) ─
type RuleSettings = {
  maxDailyHours: number;
  maxWeeklyHours: number;
  minRestHours: number;
};

const loadRuleSettings = async (): Promise<RuleSettings> => {
  const settings = await prisma.orgSettings.findUnique({
    where: { id: 1 },
    select: { maxDailyHours: true, maxWeeklyHours: true, minRestHoursBetweenShifts: true },
  });
  return {
    maxDailyHours: settings ? Number(settings.maxDailyHours) : Infinity,
    maxWeeklyHours: settings ? Number(settings.maxWeeklyHours) : Infinity,
    minRestHours: settings ? Number(settings.minRestHoursBetweenShifts) : 0,
  };
};

type SlotLike = { startTime: Date; endTime: Date };

// Evaluate whether adding `candidate` to `existing` (a user's other shifts,
// this week and the surrounding days) breaks any L-GAV rule. Returns the list
// of human-readable violations; empty means the assignment is clean.
const evaluateAssignment = (
  candidate: SlotLike,
  existing: SlotLike[],
  rules: RuleSettings,
  weekWindow: { start: Date; endExclusive: Date }
): string[] => {
  const violations: string[] = [];

  // Hard overlap / double-booking.
  if (existing.some((s) => overlaps(s, candidate))) {
    violations.push("OVERLAP: already assigned to an overlapping shift");
  }

  // Daily cap (same UTC calendar day).
  const dayHours =
    existing
      .filter((s) => sameUTCDate(s.startTime, candidate.startTime))
      .reduce((sum, s) => sum + durationHours(s), 0) + durationHours(candidate);
  if (dayHours > rules.maxDailyHours) {
    violations.push(
      `DAILY_HOURS: ${dayHours.toFixed(2)}h would exceed the ${rules.maxDailyHours}h daily maximum`
    );
  }

  // Weekly cap (within the plan's week window).
  const weekHours =
    existing
      .filter(
        (s) => s.startTime >= weekWindow.start && s.startTime < weekWindow.endExclusive
      )
      .reduce((sum, s) => sum + durationHours(s), 0) + durationHours(candidate);
  if (weekHours > rules.maxWeeklyHours) {
    violations.push(
      `WEEKLY_HOURS: ${weekHours.toFixed(2)}h would exceed the ${rules.maxWeeklyHours}h weekly maximum`
    );
  }

  // Minimum rest between shifts (check nearest neighbours on both sides).
  if (rules.minRestHours > 0) {
    for (const s of existing) {
      if (overlaps(s, candidate)) continue; // already reported as overlap
      const gapH =
        s.endTime <= candidate.startTime
          ? (candidate.startTime.getTime() - s.endTime.getTime()) * HOURS_PER_MS
          : (s.startTime.getTime() - candidate.endTime.getTime()) * HOURS_PER_MS;
      if (gapH < rules.minRestHours) {
        violations.push(
          `REST_PERIOD: only ${gapH.toFixed(2)}h rest to an adjacent shift (minimum ${rules.minRestHours}h)`
        );
        break;
      }
    }
  }

  return violations;
};

// A user's other assignments that matter for rule checks: every non-cancelled,
// non-rejected shift from the day before the week starts to the day after it
// ends (rest checks cross week boundaries).
const loadNearbyShifts = async (
  userIds: string[],
  week: { weekStartDate: Date; weekEndDate: Date },
  excludeShiftId?: string
) => {
  const rows = await prisma.shift.findMany({
    where: {
      userId: { in: userIds },
      date: {
        gte: addDays(startOfUTCDay(week.weekStartDate), -1),
        lte: addDays(startOfUTCDay(week.weekEndDate), 1),
      },
      status: { notIn: ["CANCELLED", "REJECTED", "SWAPPED_OUT"] },
      ...(excludeShiftId ? { id: { not: excludeShiftId } } : {}),
    },
    select: { id: true, userId: true, startTime: true, endTime: true },
  });

  const byUser = new Map<string, { id: string; startTime: Date; endTime: Date }[]>();
  for (const r of rows) {
    const list = byUser.get(r.userId) ?? [];
    list.push({ id: r.id, startTime: r.startTime, endTime: r.endTime });
    byUser.set(r.userId, list);
  }
  return byUser;
};

// ─── Demand bridge (DemandWeek/DayDemand → WeeklyPlan/StaffingDemand) ─
// The admin "Demand" page stores day-level headcounts (DemandWeek/DayDemand).
// The scheduler consumes slot-level StaffingDemand rows on a WeeklyPlan. This
// bridge mirrors the demand grid into the plan, matched BY WEEK DATES (never
// by id — the two tables have independent cuids).

// Which week of the month a week-start date falls in (1..5). Week starts are
// 7 days apart, so this is unique per (year, month).
const weekNumberInMonth = (weekStart: Date) =>
  Math.floor((weekStart.getUTCDate() - 1) / 7) + 1;

// Default shift window from org settings ("HH:mm"), used because DayDemand
// stores headcount only — no times.
const loadDefaultShiftWindow = async () => {
  const settings = await prisma.orgSettings.findUnique({
    where: { id: 1 },
    select: { defaultShiftStartTime: true, defaultShiftEndTime: true },
  });
  const parse = (value: string | undefined, fallback: [number, number]): [number, number] => {
    const m = /^(\d{2}):(\d{2})$/.exec(value ?? "");
    return m ? [Number(m[1]), Number(m[2])] : fallback;
  };
  return {
    start: parse(settings?.defaultShiftStartTime, [9, 0]),
    end: parse(settings?.defaultShiftEndTime, [17, 0]),
  };
};

type DemandWeekWithDemands = Prisma.DemandWeekGetPayload<{ include: { demands: true } }>;

// Find (by weekStartDate) or create the WeeklyPlan mirroring a DemandWeek and
// refresh its StaffingDemand rows from the day-level grid. Published plans are
// returned untouched — their demand snapshot is frozen.
const syncPlanFromDemandWeek = async (demandWeek: DemandWeekWithDemands) => {
  const weekStart = startOfUTCDay(demandWeek.weekStartDate);

  let plan = await prisma.weeklyPlan.findFirst({
    where: { weekStartDate: demandWeek.weekStartDate },
    select: planSelect,
  });

  if (!plan) {
    const base = {
      year: weekStart.getUTCFullYear(),
      month: weekStart.getUTCMonth() + 1,
      weekStartDate: demandWeek.weekStartDate,
      weekEndDate: demandWeek.weekEndDate,
      status: "DRAFT" as const,
    };
    try {
      plan = await prisma.weeklyPlan.create({
        data: { ...base, weekNumber: weekNumberInMonth(weekStart) },
        select: planSelect,
      });
    } catch (err) {
      // Unique [year, month, weekNumber] collision (legacy rows created with a
      // placeholder weekNumber). Fall back to the next free slot in the month.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const max = await prisma.weeklyPlan.aggregate({
          where: { year: base.year, month: base.month },
          _max: { weekNumber: true },
        });
        plan = await prisma.weeklyPlan.create({
          data: { ...base, weekNumber: (max._max.weekNumber ?? 0) + 1 },
          select: planSelect,
        });
      } else {
        throw err;
      }
    }
  }

  if (plan.status === "PUBLISHED") return plan;

  const window = await loadDefaultShiftWindow();
  const demandsToCreate = demandWeek.demands
    .filter((d) => d.requiredCount > 0)
    .map((d) => {
      const day = startOfUTCDay(d.date);
      return {
        weeklyPlanId: plan!.id,
        categoryId: d.categoryId,
        date: d.date,
        requiredCount: d.requiredCount,
        startTime: new Date(
          Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), ...window.start)
        ),
        endTime: new Date(
          Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), ...window.end)
        ),
      };
    });

  // Full refresh so edits on the Demand page (including reductions) are
  // reflected the next time the schedule is generated.
  await prisma.$transaction([
    prisma.staffingDemand.deleteMany({ where: { weeklyPlanId: plan.id } }),
    ...(demandsToCreate.length > 0
      ? [prisma.staffingDemand.createMany({ data: demandsToCreate, skipDuplicates: true })]
      : []),
  ]);

  return plan;
};

const getPlanOr404 = async (weekPlanId: string) => {
  const plan = await prisma.weeklyPlan.findUnique({
    where: { id: weekPlanId },
    select: planSelect,
  });

  if (plan) {
    if (plan.status === "PUBLISHED") return plan;
    // Draft plan: keep its demand mirror fresh from the demand grid (matched
    // by week dates) so Demand-page edits flow into regeneration.
    const demandWeek = await prisma.demandWeek.findFirst({
      where: { weekStartDate: plan.weekStartDate },
      include: { demands: true },
    });
    if (demandWeek) return syncPlanFromDemandWeek(demandWeek);
    return plan;
  }

  // The caller may hold a DemandWeek id (e.g. from the Demand page) — resolve
  // it to the mirrored plan by date, creating the plan if needed.
  const demandWeek = await prisma.demandWeek.findUnique({
    where: { id: weekPlanId },
    include: { demands: true },
  });
  if (demandWeek) return syncPlanFromDemandWeek(demandWeek);

  throw new AppError("Weekly plan not found.", 404);
};

// ─── Schedule detail (plan + shifts + violations + unfilled demand) ─
const buildScheduleDetail = async (weekPlanId: string) => {
  const plan = await getPlanOr404(weekPlanId);

  const [shifts, demands] = await Promise.all([
    prisma.shift.findMany({
      where: { weeklyPlanId: plan.id },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      select: shiftSelect,
    }),
    prisma.staffingDemand.findMany({
      where: { weeklyPlanId: plan.id },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      select: {
        id: true,
        date: true,
        categoryId: true,
        category: { select: { id: true, name: true } },
        requiredCount: true,
        startTime: true,
        endTime: true,
      },
    }),
  ]);

  // A shift counts toward a demand when it shares the category, falls on the
  // same day, overlaps the slot and is not cancelled/rejected.
  const activeShifts = shifts.filter(
    (s) => s.status !== "CANCELLED" && s.status !== "REJECTED" && s.status !== "SWAPPED_OUT"
  );
  const unfilledDemands = demands
    .map((d) => {
      const assigned = activeShifts.filter(
        (s) =>
          s.categoryId === d.categoryId &&
          sameUTCDate(s.date, d.date) &&
          overlaps(s, d)
      ).length;
      return {
        demandId: d.id,
        date: dateOnly(d.date),
        categoryId: d.categoryId,
        categoryName: d.category.name,
        startTime: d.startTime,
        endTime: d.endTime,
        requiredCount: d.requiredCount,
        assignedCount: assigned,
        missingCount: Math.max(0, d.requiredCount - assigned),
      };
    })
    .filter((d) => d.missingCount > 0);

  const violations = shifts
    .filter((s) => !s.rulePassed && s.ruleViolations)
    .map((s) => ({
      shiftId: s.id,
      userId: s.userId,
      userName: displayName(s.user),
      date: dateOnly(s.date),
      startTime: s.startTime,
      endTime: s.endTime,
      violations: s.ruleViolations,
    }));

  const totalHours = activeShifts.reduce((sum, s) => sum + durationHours(s), 0);
  const totalCost = activeShifts.reduce(
    (sum, s) => sum + durationHours(s) * Number(s.user.hourlyRate ?? 0),
    0
  );

  return {
    plan,
    shifts,
    unfilledDemands,
    violations,
    demands,
    summary: {
      shiftCount: activeShifts.length,
      totalHours: Number(totalHours.toFixed(2)),
      estimatedCost: Number(totalCost.toFixed(2)),
      unfilledCount: unfilledDemands.length,
      violationCount: violations.length,
    },
  };
};

// ─── List plans ──────────────────────────────────────────────────
const listPlans = async (query: ListPlansQuery) => {
  const { page, limit, year, month, status } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.WeeklyPlanWhereInput = {};
  if (year !== undefined) where.year = year;
  if (month !== undefined) where.month = month;
  if (status) where.status = status;

  const [plans, total] = await Promise.all([
    prisma.weeklyPlan.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ year: "desc" }, { month: "desc" }, { weekNumber: "desc" }],
      select: {
        ...planSelect,
        _count: { select: { shifts: true, demands: true } },
      },
    }),
    prisma.weeklyPlan.count({ where }),
  ]);

  return {
    plans: plans.map(({ _count, ...p }) => ({
      ...p,
      shiftCount: _count.shifts,
      demandCount: _count.demands,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// ─── Generate / regenerate the schedule for a week ───────────────
// Greedy constraint-based assignment: for each staffing demand slot (in date
// order), pick eligible employees — right category, available that day (WISH
// preferred), and passing every L-GAV rule — until the demand is filled or no
// candidate remains. Already-ACCEPTED shifts survive regeneration.
type PlanRow = Prisma.WeeklyPlanGetPayload<{ select: typeof planSelect }>;

const generateForPlan = async (plan: PlanRow) => {
  const demands = await prisma.staffingDemand.findMany({
    where: { weeklyPlanId: plan.id },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    select: {
      id: true,
      date: true,
      categoryId: true,
      category: { select: { name: true } },
      requiredCount: true,
      startTime: true,
      endTime: true,
    },
  });
  if (demands.length === 0) {
    throw new AppError(
      "This week has no staffing demand. Set this week's demand on the Demand page before generating a schedule.",
      409
    );
  }

  // Regeneration: wipe everything the employees haven't already accepted.
  await prisma.shift.deleteMany({
    where: { weeklyPlanId: plan.id, status: { not: "ACCEPTED" } },
  });

  const rules = await loadRuleSettings();
  const weekStart = startOfUTCDay(plan.weekStartDate);
  const weekEndExclusive = addDays(startOfUTCDay(plan.weekEndDate), 1);
  const weekWindow = { start: weekStart, endExclusive: weekEndExclusive };

  // Candidate pool: active employees belonging to any demanded category.
  const categoryIds = [...new Set(demands.map((d) => d.categoryId))];
  const users = await prisma.user.findMany({
    where: { isActive: true, categories: { some: { categoryId: { in: categoryIds } } } },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      categories: { select: { categoryId: true } },
    },
  });
  const userIds = users.map((u) => u.id);

  // Availability for the week's days. If a specific day has no explicit record,
  // the employee is treated as available (they didn't mark it unavailable).
  const availDays = await prisma.availabilityDay.findMany({
    where: {
      availabilityMonth: { userId: { in: userIds } },
      date: { gte: weekStart, lt: weekEndExclusive },
    },
    select: {
      date: true,
      status: true,
      availabilityMonth: { select: { userId: true, year: true, month: true } },
    },
  });
  const availByUserDay = new Map<string, "AVAILABLE" | "UNAVAILABLE" | "WISH">();
  for (const d of availDays) {
    availByUserDay.set(`${d.availabilityMonth.userId}|${dateOnly(d.date)}`, d.status);
  }

  // Existing assignments that count against the rules: kept ACCEPTED shifts in
  // this plan plus anything in surrounding plans/days.
  const assignedByUser = await loadNearbyShifts(userIds, plan);
  for (const id of userIds) if (!assignedByUser.has(id)) assignedByUser.set(id, []);

  const keptShifts = await prisma.shift.findMany({
    where: { weeklyPlanId: plan.id },
    select: { userId: true, categoryId: true, date: true, startTime: true, endTime: true },
  });

  const weekHoursOf = (uid: string) =>
    (assignedByUser.get(uid) ?? [])
      .filter((s) => s.startTime >= weekStart && s.startTime < weekEndExclusive)
      .reduce((sum, s) => sum + durationHours(s), 0);

  const newShifts: Prisma.ShiftCreateManyInput[] = [];
  const unfilled: {
    demandId: string;
    date: string;
    categoryName: string;
    startTime: Date;
    endTime: Date;
    requiredCount: number;
    assignedCount: number;
    missingCount: number;
    reasons: string[];
  }[] = [];

  for (const demand of demands) {
    const slot = { startTime: demand.startTime, endTime: demand.endTime };
    const dayKey = dateOnly(demand.date);

    // Kept (accepted) shifts already covering this exact demand slot.
    const alreadyAssigned = keptShifts.filter(
      (s) =>
        s.categoryId === demand.categoryId &&
        sameUTCDate(s.date, demand.date) &&
        overlaps(s, slot)
    );
    const assignedUserIds = new Set(alreadyAssigned.map((s) => s.userId));
    let filled = alreadyAssigned.length;
    const reasons: string[] = [];

    while (filled < demand.requiredCount) {
      // Build the eligible candidate list fresh each round (hour totals move).
      const candidates = users
        .filter((u) => !assignedUserIds.has(u.id))
        .filter((u) => u.categories.some((c) => c.categoryId === demand.categoryId))
        .map((u) => {
          const avail =
            availByUserDay.get(`${u.id}|${dayKey}`) ?? "AVAILABLE";
          return { user: u, avail };
        })
        .filter((c) => c.avail === "AVAILABLE" || c.avail === "WISH")
        .filter(
          (c) =>
            evaluateAssignment(slot, assignedByUser.get(c.user.id) ?? [], rules, weekWindow)
              .length === 0
        )
        .sort((a, b) => {
          if (a.avail !== b.avail) return a.avail === "WISH" ? -1 : 1; // WISH first
          const diff = weekHoursOf(a.user.id) - weekHoursOf(b.user.id); // fairness
          if (diff !== 0) return diff;
          return displayName(a.user).localeCompare(displayName(b.user));
        });

      const pick = candidates[0];
      if (!pick) {
        reasons.push(
          "No remaining employee in this category is available and within the working-time rules for this slot."
        );
        break;
      }

      newShifts.push({
        weeklyPlanId: plan.id,
        userId: pick.user.id,
        categoryId: demand.categoryId,
        date: demand.date,
        startTime: demand.startTime,
        endTime: demand.endTime,
        status: "PENDING",
        rulePassed: true,
      });
      assignedUserIds.add(pick.user.id);
      (assignedByUser.get(pick.user.id) as SlotLike[]).push({ ...slot });
      filled += 1;
    }

    if (filled < demand.requiredCount) {
      unfilled.push({
        demandId: demand.id,
        date: dayKey,
        categoryName: demand.category.name,
        startTime: demand.startTime,
        endTime: demand.endTime,
        requiredCount: demand.requiredCount,
        assignedCount: filled,
        missingCount: demand.requiredCount - filled,
        reasons,
      });
    }
  }

  if (newShifts.length > 0) {
    await prisma.shift.createMany({ data: newShifts });
  }

  const detail = await buildScheduleDetail(plan.id);
  return {
    ...detail,
    generation: {
      createdCount: newShifts.length,
      keptAcceptedCount: keptShifts.length,
      unfilled,
    },
  };
};

const generateSchedule = async (data: GenerateScheduleInput) => {
  const plan = await getPlanOr404(data.weekPlanId);
  if (plan.status === "PUBLISHED") {
    throw new AppError(
      "This week's schedule is already published. Unpublish it before regenerating.",
      409
    );
  }
  return generateForPlan(plan);
};

// ─── Generate a month: every demand-backed week in one go ────────
// Requires at least ONE week of demand in the month. Weeks without demand are
// skipped and reported so the UI can warn; published weeks are left untouched.
const generateMonthSchedule = async (data: GenerateMonthInput) => {
  const { year, month } = data;
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));

  const demandWeeks = await prisma.demandWeek.findMany({
    where: { weekStartDate: { gte: monthStart, lt: monthEnd } },
    include: { demands: true },
    orderBy: { weekStartDate: "asc" },
  });
  const withDemand = demandWeeks.filter((w) => w.demands.some((d) => d.requiredCount > 0));

  if (withDemand.length === 0) {
    throw new AppError(
      `No week demand exists for ${year}-${String(month).padStart(2, "0")}. Create at least one week's demand on the Demand page first.`,
      409
    );
  }

  const weeks: {
    weekPlanId: string;
    weekNumber: number;
    weekStartDate: string;
    weekEndDate: string;
    status: string;
    result: "generated" | "skipped_published";
    createdCount: number;
    unfilledCount: number;
  }[] = [];

  for (const demandWeek of withDemand) {
    const plan = await syncPlanFromDemandWeek(demandWeek);
    if (plan.status === "PUBLISHED") {
      weeks.push({
        weekPlanId: plan.id,
        weekNumber: plan.weekNumber,
        weekStartDate: dateOnly(plan.weekStartDate),
        weekEndDate: dateOnly(plan.weekEndDate),
        status: plan.status,
        result: "skipped_published",
        createdCount: 0,
        unfilledCount: 0,
      });
      continue;
    }
    const generated = await generateForPlan(plan);
    weeks.push({
      weekPlanId: plan.id,
      weekNumber: plan.weekNumber,
      weekStartDate: dateOnly(plan.weekStartDate),
      weekEndDate: dateOnly(plan.weekEndDate),
      status: generated.plan.status,
      result: "generated",
      createdCount: generated.generation.createdCount,
      unfilledCount: generated.generation.unfilled.length,
    });
  }

  // Weeks of the month that have no demand yet — surfaced as warnings.
  const covered = new Set(withDemand.map((w) => dateOnly(startOfUTCDay(w.weekStartDate))));
  const weeksWithoutDemand: { weekStartDate: string; weekEndDate: string }[] = [];
  // Walk every week-start (same weekday as the first demand week) inside the month.
  const anchorDow = startOfUTCDay(withDemand[0]!.weekStartDate).getUTCDay();
  let cursor = monthStart;
  while (cursor.getUTCDay() !== anchorDow) cursor = addDays(cursor, 1);
  for (; cursor < monthEnd; cursor = addDays(cursor, 7)) {
    if (!covered.has(dateOnly(cursor))) {
      weeksWithoutDemand.push({
        weekStartDate: dateOnly(cursor),
        weekEndDate: dateOnly(addDays(cursor, 6)),
      });
    }
  }

  return {
    year,
    month,
    generatedCount: weeks.filter((w) => w.result === "generated").length,
    skippedPublishedCount: weeks.filter((w) => w.result === "skipped_published").length,
    weeks,
    weeksWithoutDemand,
  };
};

// ─── Month-grouped plan list (schedule list page) ────────────────
const listMonths = async () => {
  const plans = await prisma.weeklyPlan.findMany({
    orderBy: [{ year: "desc" }, { month: "desc" }, { weekNumber: "asc" }],
    select: {
      ...planSelect,
      _count: { select: { shifts: true, demands: true } },
    },
  });
  if (plans.length === 0) return { months: [] };

  const planIds = plans.map((p) => p.id);
  const [shiftRows, demandRows] = await Promise.all([
    prisma.shift.findMany({
      where: {
        weeklyPlanId: { in: planIds },
        status: { notIn: ["CANCELLED", "REJECTED", "SWAPPED_OUT"] },
      },
      select: {
        weeklyPlanId: true,
        startTime: true,
        endTime: true,
        user: { select: { hourlyRate: true } },
      },
    }),
    prisma.staffingDemand.findMany({
      where: { weeklyPlanId: { in: planIds } },
      select: { weeklyPlanId: true, requiredCount: true },
    }),
  ]);

  const hoursByPlan = new Map<string, number>();
  const costByPlan = new Map<string, number>();
  for (const s of shiftRows) {
    const h = durationHours(s);
    hoursByPlan.set(s.weeklyPlanId, (hoursByPlan.get(s.weeklyPlanId) ?? 0) + h);
    costByPlan.set(
      s.weeklyPlanId,
      (costByPlan.get(s.weeklyPlanId) ?? 0) + h * Number(s.user.hourlyRate ?? 0)
    );
  }
  const demandByPlan = new Map<string, number>();
  for (const d of demandRows) {
    demandByPlan.set(d.weeklyPlanId, (demandByPlan.get(d.weeklyPlanId) ?? 0) + d.requiredCount);
  }

  const byMonth = new Map<string, typeof plans>();
  for (const p of plans) {
    const key = `${p.year}-${String(p.month).padStart(2, "0")}`;
    const list = byMonth.get(key) ?? [];
    list.push(p);
    byMonth.set(key, list);
  }

  const months = [...byMonth.entries()].map(([key, monthPlans]) => {
    const weeks = monthPlans
      .slice()
      .sort((a, b) => a.weekNumber - b.weekNumber)
      .map(({ _count, ...p }) => ({
        id: p.id,
        weekNumber: p.weekNumber,
        weekStartDate: dateOnly(p.weekStartDate),
        weekEndDate: dateOnly(p.weekEndDate),
        status: p.status,
        shiftCount: _count.shifts,
        demandCount: _count.demands,
        totalDemand: demandByPlan.get(p.id) ?? 0,
        estimatedCost: Number((costByPlan.get(p.id) ?? 0).toFixed(2)),
      }));

    const publishedCount = weeks.filter((w) => w.status === "PUBLISHED").length;
    return {
      key,
      year: monthPlans[0]!.year,
      month: monthPlans[0]!.month,
      createdAt: monthPlans.reduce(
        (min, p) => (p.createdAt < min ? p.createdAt : min),
        monthPlans[0]!.createdAt
      ),
      weekCount: weeks.length,
      publishedWeekCount: publishedCount,
      status:
        publishedCount === weeks.length
          ? ("PUBLISHED" as const)
          : publishedCount > 0
            ? ("PARTIAL" as const)
            : ("DRAFT" as const),
      totalShifts: weeks.reduce((sum, w) => sum + w.shiftCount, 0),
      totalDemand: weeks.reduce((sum, w) => sum + w.totalDemand, 0),
      totalHours: Number(
        monthPlans.reduce((sum, p) => sum + (hoursByPlan.get(p.id) ?? 0), 0).toFixed(2)
      ),
      estimatedCost: Number(
        monthPlans.reduce((sum, p) => sum + (costByPlan.get(p.id) ?? 0), 0).toFixed(2)
      ),
      weeks,
    };
  });

  return { months };
};

// ─── Publish / unpublish ─────────────────────────────────────────
const publishSchedule = async (weekPlanId: string, adminId: string) => {
  const plan = await getPlanOr404(weekPlanId);
  if (plan.status === "PUBLISHED" && !plan.needsRenotify) {
    throw new AppError("This week's schedule is already published.", 409);
  }

  const shifts = await prisma.shift.findMany({
    where: { weeklyPlanId: plan.id, status: { notIn: ["CANCELLED", "REJECTED"] } },
    select: { id: true, userId: true },
  });
  if (shifts.length === 0) {
    throw new AppError("Cannot publish an empty schedule. Generate shifts first.", 409);
  }

  // L-GAV compliance gate: a plan with open rule violations cannot be published.
  const violatingCount = await prisma.shift.count({
    where: {
      weeklyPlanId: plan.id,
      rulePassed: false,
      status: { notIn: ["CANCELLED", "REJECTED", "SWAPPED_OUT"] },
    },
  });
  if (violatingCount > 0) {
    throw new AppError(
      `Cannot publish: ${violatingCount} shift(s) break the working-time rules. Fix the violations first.`,
      409
    );
  }

  const now = new Date();
  const assignedUserIds = [...new Set(shifts.map((s) => s.userId))];
  const weekLabel = `${dateOnly(plan.weekStartDate)} – ${dateOnly(plan.weekEndDate)}`;

  await prisma.$transaction([
    prisma.weeklyPlan.update({
      where: { id: plan.id },
      data: {
        status: "PUBLISHED",
        submittedAt: now,
        submittedById: adminId,
        needsRenotify: false,
      },
    }),
    prisma.shift.updateMany({
      where: { weeklyPlanId: plan.id },
      data: { notifiedAt: now },
    }),
    prisma.notification.createMany({
      data: assignedUserIds.map((userId) => ({
        userId,
        type: "WEEKLY_SHIFTS_PUBLISHED" as const,
        channel: "IN_APP" as const,
        status: "SENT" as const,
        title: "New weekly schedule published",
        body: `Your shifts for the week ${weekLabel} have been published. Please review and respond.`,
        sentAt: now,
        payload: { weekPlanId: plan.id },
      })),
    }),
  ]);

  return buildScheduleDetail(plan.id);
};

const unpublishSchedule = async (weekPlanId: string) => {
  const plan = await getPlanOr404(weekPlanId);
  if (plan.status !== "PUBLISHED") {
    throw new AppError("Only a published schedule can be unpublished.", 409);
  }

  await prisma.weeklyPlan.update({
    where: { id: plan.id },
    data: { status: "DRAFT" },
  });

  return buildScheduleDetail(plan.id);
};

// ─── Manual overrides (add / edit / remove a single shift) ───────
// Overlap with the employee's other shifts is a hard block; other L-GAV rule
// violations are advisory — the shift is still created but flagged, matching
// the admin grid's Violations panel UX.
const addShift = async (weekPlanId: string, data: CreateShiftInput) => {
  const plan = await getPlanOr404(weekPlanId);

  const [user, category, membership] = await Promise.all([
    prisma.user.findUnique({
      where: { id: data.userId },
      select: { id: true, isActive: true },
    }),
    prisma.category.findUnique({
      where: { id: data.categoryId },
      select: { id: true, isActive: true },
    }),
    prisma.userCategory.findUnique({
      where: { userId_categoryId: { userId: data.userId, categoryId: data.categoryId } },
      select: { userId: true },
    }),
  ]);
  if (!user) throw new AppError("Employee not found.", 404);
  if (!user.isActive) throw new AppError("Employee is deactivated.", 409);
  if (!category) throw new AppError("Category not found.", 404);
  if (!category.isActive) throw new AppError("Category is inactive.", 409);
  if (!membership) {
    throw new AppError("This employee is not assigned to that category.", 409);
  }

  const date = startOfUTCDay(new Date(data.date));
  if (date < startOfUTCDay(plan.weekStartDate) || date > startOfUTCDay(plan.weekEndDate)) {
    throw new AppError("Shift date falls outside this plan's week.", 400);
  }

  const slot = { startTime: new Date(data.startTime), endTime: new Date(data.endTime) };
  const rules = await loadRuleSettings();
  const weekWindow = {
    start: startOfUTCDay(plan.weekStartDate),
    endExclusive: addDays(startOfUTCDay(plan.weekEndDate), 1),
  };

  const existing = (await loadNearbyShifts([data.userId], plan)).get(data.userId) ?? [];
  const violations = evaluateAssignment(slot, existing, rules, weekWindow);
  if (violations.some((v) => v.startsWith("OVERLAP"))) {
    throw new AppError("This employee already has an overlapping shift.", 409);
  }

  const shift = await prisma.shift.create({
    data: {
      weeklyPlanId: plan.id,
      userId: data.userId,
      categoryId: data.categoryId,
      date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      status: "PENDING",
      rulePassed: violations.length === 0,
      ...(violations.length > 0 ? { ruleViolations: violations } : {}),
    },
    select: shiftSelect,
  });

  // Owner rule for manually filling an open slot: optionally reduce the same
  // weekday/category demand of NEXT week by one, and remove the employee's
  // availability entry for this date (the day is now consumed by this shift).
  let nextWeekDemandReduced = false;
  let availabilityDayRemoved = false;
  if (data.reduceNextWeekDemand) {
    const nextWeekDate = addDays(date, 7);

    const nextDayDemand = await prisma.dayDemand.findFirst({
      where: { categoryId: data.categoryId, date: nextWeekDate, requiredCount: { gt: 0 } },
      select: { id: true, requiredCount: true, demandWeekId: true },
    });
    if (nextDayDemand) {
      await prisma.dayDemand.update({
        where: { id: nextDayDemand.id },
        data: { requiredCount: nextDayDemand.requiredCount - 1 },
      });
      // Keep an already-mirrored draft plan for next week in sync (best effort;
      // a future sync/regenerate would refresh it anyway).
      await prisma.staffingDemand.updateMany({
        where: {
          categoryId: data.categoryId,
          date: nextWeekDate,
          requiredCount: { gt: 0 },
          weeklyPlan: { status: { not: "PUBLISHED" } },
        },
        data: { requiredCount: { decrement: 1 } },
      });
      nextWeekDemandReduced = true;
    }

    const removed = await prisma.availabilityDay.deleteMany({
      where: { availabilityMonth: { userId: data.userId }, date },
    });
    availabilityDayRemoved = removed.count > 0;
  }

  if (plan.status === "PUBLISHED") {
    await prisma.$transaction([
      prisma.weeklyPlan.update({
        where: { id: plan.id },
        data: { needsRenotify: true },
      }),
      prisma.notification.create({
        data: {
          userId: data.userId,
          type: "SHIFT_CHANGED",
          channel: "IN_APP",
          status: "SENT",
          title: "Schedule updated",
          body: `A new shift on ${dateOnly(date)} was added to your published schedule. Please review it.`,
          sentAt: new Date(),
          payload: { weekPlanId: plan.id, shiftId: shift.id },
        },
      }),
    ]);
  }

  return {
    shift,
    ruleViolations: violations,
    rulePassed: violations.length === 0,
    nextWeekDemandReduced,
    availabilityDayRemoved,
  };
};

const getShiftInPlanOr404 = async (weekPlanId: string, shiftId: string) => {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    select: { id: true, weeklyPlanId: true, userId: true, date: true },
  });
  if (!shift || shift.weeklyPlanId !== weekPlanId) {
    throw new AppError("Shift not found in this weekly plan.", 404);
  }
  return shift;
};

const updateShift = async (weekPlanId: string, shiftId: string, data: UpdateShiftInput) => {
  const plan = await getPlanOr404(weekPlanId);
  const shift = await getShiftInPlanOr404(plan.id, shiftId);

  const slot = { startTime: new Date(data.startTime), endTime: new Date(data.endTime) };
  const rules = await loadRuleSettings();
  const weekWindow = {
    start: startOfUTCDay(plan.weekStartDate),
    endExclusive: addDays(startOfUTCDay(plan.weekEndDate), 1),
  };

  // Exclude the shift being edited from its own rule check.
  const existing = (await loadNearbyShifts([shift.userId], plan, shiftId)).get(shift.userId) ?? [];
  const violations = evaluateAssignment(slot, existing, rules, weekWindow);
  if (violations.some((v) => v.startsWith("OVERLAP"))) {
    throw new AppError("The new time overlaps another shift for this employee.", 409);
  }

  const updated = await prisma.shift.update({
    where: { id: shiftId },
    data: {
      startTime: slot.startTime,
      endTime: slot.endTime,
      date: startOfUTCDay(slot.startTime),
      rulePassed: violations.length === 0,
      ruleViolations: violations.length > 0 ? violations : Prisma.JsonNull,
    },
    select: shiftSelect,
  });

  if (plan.status === "PUBLISHED") {
    await prisma.$transaction([
      prisma.weeklyPlan.update({
        where: { id: plan.id },
        data: { needsRenotify: true },
      }),
      prisma.notification.create({
        data: {
          userId: shift.userId,
          type: "SHIFT_CHANGED",
          channel: "IN_APP",
          status: "SENT",
          title: "Schedule updated",
          body: `Your shift on ${dateOnly(shift.date)} was rescheduled. Please review the new time.`,
          sentAt: new Date(),
          payload: { weekPlanId: plan.id, shiftId },
        },
      }),
    ]);
  }

  return { shift: updated, ruleViolations: violations, rulePassed: violations.length === 0 };
};

const removeShift = async (weekPlanId: string, shiftId: string) => {
  const plan = await getPlanOr404(weekPlanId);
  const shift = await getShiftInPlanOr404(plan.id, shiftId);

  await prisma.shift.delete({ where: { id: shiftId } });

  if (plan.status === "PUBLISHED") {
    await prisma.$transaction([
      prisma.weeklyPlan.update({
        where: { id: plan.id },
        data: { needsRenotify: true },
      }),
      prisma.notification.create({
        data: {
          userId: shift.userId,
          type: "SHIFT_CHANGED",
          channel: "IN_APP",
          status: "SENT",
          title: "Schedule updated",
          body: `Your shift on ${dateOnly(shift.date)} was removed from the schedule.`,
          sentAt: new Date(),
          payload: { weekPlanId: plan.id },
        },
      }),
    ]);
  }
};

const getAvailabilityForPlan = async (weekPlanId: string) => {
  const plan = await getPlanOr404(weekPlanId);
  const weekStart = startOfUTCDay(plan.weekStartDate);
  const weekEndExclusive = addDays(startOfUTCDay(plan.weekEndDate), 1);

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      categories: { select: { category: { select: { name: true } } } },
      availabilityMonths: {
        where: {
          year: plan.year,
          month: plan.month,
        },
        select: {
          id: true,
          year: true,
          month: true,
          days: {
            where: {
              date: { gte: weekStart, lt: weekEndExclusive },
              status: { in: ["AVAILABLE", "WISH"] }
            }
          }
        }
      }
    }
  });

  const pad = (n: number) => String(n).padStart(2, "0");
  const hhmm = (d: Date) => `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;

  return users.filter(u => u.availabilityMonths.length > 0 && (u.availabilityMonths[0]?.days.length ?? 0) > 0).map(u => {
    const defaultCategory = u.categories[0]?.category?.name || "Unassigned";
    const monthRecord = u.availabilityMonths[0]!;
    const monthStr = `${monthRecord.year}-${pad(monthRecord.month)}`;
    
    return {
      user: {
        name: displayName(u),
        email: u.email
      },
      slots: {
        date: monthStr,
        avalibltyslots: monthRecord.days.map(d => ({
          date: dateOnly(d.date),
          "time-slot": (d.preferredStartTime && d.preferredEndTime) 
            ? `${hhmm(d.preferredStartTime)} to ${hhmm(d.preferredEndTime)}` 
            : "Any time",
          category: defaultCategory
        }))
      }
    };
  });
};

export const schedulingServices = {
  listPlans,
  listMonths,
  getSchedule: buildScheduleDetail,
  generateSchedule,
  generateMonthSchedule,
  publishSchedule,
  unpublishSchedule,
  addShift,
  updateShift,
  removeShift,
  getAvailabilityForPlan,
};

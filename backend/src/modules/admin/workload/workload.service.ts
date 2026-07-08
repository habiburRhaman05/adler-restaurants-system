import { prisma } from "../../../config/db";
import { AppError } from "../../../utils/AppError";
import type {
  CreateWeekInput,
  UpdateWeekInput,
  ListWeeksQuery,
  CreateDemandInput,
  BulkDemandsInput,
  UpdateDemandInput,
  WorkloadViewQuery,
} from "./workload.validation";
import type { Prisma } from "../../../generated/prisma/client";

// ─── Date helpers (all UTC — dates are stored at UTC midnight) ────
const startOfUTCDay = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
};

const dateOnly = (d: Date) => d.toISOString().slice(0, 10);

const sameUTCDate = (a: Date, b: Date) =>
  a.getUTCFullYear() === b.getUTCFullYear() &&
  a.getUTCMonth() === b.getUTCMonth() &&
  a.getUTCDate() === b.getUTCDate();

// ISO-8601 week number of the week that contains `date`.
const isoWeekNumber = (date: Date) => {
  const d = startOfUTCDay(date);
  const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // shift to the week's Thursday
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
};

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

const demandSelect = {
  id: true,
  weeklyPlanId: true,
  date: true,
  categoryId: true,
  requiredCount: true,
  startTime: true,
  endTime: true,
  note: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true } },
} satisfies Prisma.StaffingDemandSelect;

type DemandRow = Prisma.StaffingDemandGetPayload<{ select: typeof demandSelect }>;

// ─── Category guard (shared with the shifts module's rules) ──────
const ensureCategoryUsable = async (categoryId: string) => {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, isActive: true },
  });
  if (!category) throw new AppError("Selected category does not exist.", 404);
  if (!category.isActive) throw new AppError("Selected category is inactive.", 409);
};

const ensurePlanExists = async (planId: string) => {
  const plan = await prisma.weeklyPlan.findUnique({ where: { id: planId }, select: { id: true } });
  if (!plan) throw new AppError("Workload week not found.", 404);
};

// ─── Shift ⇄ workload connection ─────────────────────────────────
// Annotate each demand with the admin-created shifts (ShiftOffer) that fulfil
// it. A shift counts toward a demand when it shares the category, falls on the
// same calendar day and overlaps the demand's time slot. "Filled" headcount is
// the number of admin-APPROVED workers across those shifts.
const annotateDemands = async (
  demands: DemandRow[],
  windowStart: Date,
  windowEndExclusive: Date
) => {
  if (demands.length === 0) return [];

  const categoryIds = [...new Set(demands.map((d) => d.categoryId))];
  const offers = await prisma.shiftOffer.findMany({
    where: {
      categoryId: { in: categoryIds },
      startTime: { gte: windowStart, lt: windowEndExclusive },
    },
    select: {
      id: true,
      jobTitle: true,
      categoryId: true,
      startTime: true,
      endTime: true,
      notifiedAt: true,
      responses: { select: { status: true, approvalStatus: true } },
    },
  });

  const shifts = offers.map((o) => {
    const accepted = o.responses.filter((r) => r.status === "ACCEPTED");
    return {
      id: o.id,
      jobTitle: o.jobTitle,
      categoryId: o.categoryId,
      startTime: o.startTime,
      endTime: o.endTime,
      notified: o.notifiedAt !== null,
      approvedCount: accepted.filter((r) => r.approvalStatus === "APPROVED").length,
      pendingCount: accepted.filter((r) => r.approvalStatus === "PENDING").length,
    };
  });

  return demands.map((d) => {
    const matches = shifts.filter(
      (o) =>
        o.categoryId === d.categoryId &&
        sameUTCDate(o.startTime, d.date) &&
        o.startTime < d.endTime &&
        o.endTime > d.startTime
    );
    const filledCount = matches.reduce((sum, o) => sum + o.approvedCount, 0);
    const pendingCount = matches.reduce((sum, o) => sum + o.pendingCount, 0);

    return {
      ...d,
      fulfillment: {
        requiredCount: d.requiredCount,
        filledCount,
        pendingCount,
        openCount: Math.max(0, d.requiredCount - filledCount),
        status: filledCount >= d.requiredCount ? "MET" : filledCount > 0 ? "PARTIAL" : "OPEN",
      },
      // The shifts the admin created that feed this demand.
      connectedShifts: matches.map(({ categoryId: _c, ...rest }) => rest),
    };
  });
};

type AnnotatedDemand = Awaited<ReturnType<typeof annotateDemands>>[number];

const computeTotals = (demands: AnnotatedDemand[]) =>
  demands.reduce(
    (acc, d) => {
      acc.demandCount += 1;
      acc.totalRequired += d.fulfillment.requiredCount;
      acc.totalFilled += d.fulfillment.filledCount;
      acc.totalOpen += d.fulfillment.openCount;
      return acc;
    },
    { demandCount: 0, totalRequired: 0, totalFilled: 0, totalOpen: 0 }
  );

// Group demands under their category so the UI can render "per category, how
// many people are needed for each shift".
const groupByCategory = (demands: AnnotatedDemand[]) => {
  const groups = new Map<
    string,
    {
      category: { id: string; name: string };
      totalRequired: number;
      totalFilled: number;
      demands: AnnotatedDemand[];
    }
  >();

  for (const d of demands) {
    let group = groups.get(d.categoryId);
    if (!group) {
      group = { category: d.category, totalRequired: 0, totalFilled: 0, demands: [] };
      groups.set(d.categoryId, group);
    }
    group.demands.push(d);
    group.totalRequired += d.fulfillment.requiredCount;
    group.totalFilled += d.fulfillment.filledCount;
  }

  return [...groups.values()];
};

// ─── Weeks ───────────────────────────────────────────────────────
const createWorkloadWeek = async (data: CreateWeekInput) => {
  const start = startOfUTCDay(new Date(data.weekStartDate));
  const end = addDays(start, 6);
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth() + 1;
  const weekNumber = data.weekNumber ?? isoWeekNumber(start);

  const existing = await prisma.weeklyPlan.findUnique({
    where: { year_month_weekNumber: { year, month, weekNumber } },
    select: { id: true },
  });
  if (existing) {
    throw new AppError("A workload week already exists for this month and week number.", 409);
  }

  return prisma.weeklyPlan.create({
    data: { year, month, weekNumber, weekStartDate: start, weekEndDate: end },
    select: planSelect,
  });
};

const listWorkloadWeeks = async (query: ListWeeksQuery) => {
  const { page, limit, year, month, status } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.WeeklyPlanWhereInput = {};
  if (year !== undefined) where.year = year;
  if (month !== undefined) where.month = month;
  if (status) where.status = status;

  const [weeks, total] = await Promise.all([
    prisma.weeklyPlan.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ year: "desc" }, { month: "desc" }, { weekNumber: "desc" }],
      select: {
        ...planSelect,
        _count: { select: { demands: true } },
        demands: { select: { requiredCount: true } },
      },
    }),
    prisma.weeklyPlan.count({ where }),
  ]);

  const data = weeks.map(({ demands, _count, ...week }) => ({
    ...week,
    demandCount: _count.demands,
    totalRequired: demands.reduce((sum, d) => sum + d.requiredCount, 0),
  }));

  return {
    weeks: data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

const getWorkloadWeek = async (planId: string) => {
  const week = await prisma.weeklyPlan.findUnique({
    where: { id: planId },
    select: planSelect,
  });
  if (!week) throw new AppError("Workload week not found.", 404);

  const demands = await prisma.staffingDemand.findMany({
    where: { weeklyPlanId: planId },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    select: demandSelect,
  });

  const windowStart = startOfUTCDay(week.weekStartDate);
  const windowEndExclusive = addDays(startOfUTCDay(week.weekEndDate), 1);
  const annotated = await annotateDemands(demands, windowStart, windowEndExclusive);

  return {
    week,
    totals: computeTotals(annotated),
    categories: groupByCategory(annotated),
    demands: annotated,
  };
};

const updateWorkloadWeek = async (planId: string, data: UpdateWeekInput) => {
  await ensurePlanExists(planId);

  const updateData: Prisma.WeeklyPlanUpdateInput = {};
  if (data.status !== undefined) {
    updateData.status = data.status;
    if (data.status === "SUBMITTED") updateData.submittedAt = new Date();
  }
  if (data.needsRenotify !== undefined) updateData.needsRenotify = data.needsRenotify;

  return prisma.weeklyPlan.update({ where: { id: planId }, data: updateData, select: planSelect });
};

// "Upload" the workload — publish the week so staff-facing scheduling can use it.
const publishWorkloadWeek = async (planId: string) => {
  const week = await prisma.weeklyPlan.findUnique({
    where: { id: planId },
    select: { id: true, _count: { select: { demands: true } } },
  });
  if (!week) throw new AppError("Workload week not found.", 404);
  if (week._count.demands === 0) {
    throw new AppError(
      "Cannot upload an empty workload. Add at least one staffing demand first.",
      409
    );
  }

  return prisma.weeklyPlan.update({
    where: { id: planId },
    data: { status: "PUBLISHED" },
    select: planSelect,
  });
};

const deleteWorkloadWeek = async (planId: string) => {
  await ensurePlanExists(planId);
  // Staffing demands cascade-delete with the plan (onDelete: Cascade).
  await prisma.weeklyPlan.delete({ where: { id: planId } });
};

// ─── Demands ─────────────────────────────────────────────────────
const addDemand = async (planId: string, data: CreateDemandInput) => {
  await ensurePlanExists(planId);
  await ensureCategoryUsable(data.categoryId);

  const date = startOfUTCDay(new Date(data.date));
  const startTime = new Date(data.startTime);

  // Enforce the [weeklyPlanId, date, categoryId, startTime] uniqueness up-front
  // so the admin gets a clear message instead of a raw DB error.
  const duplicate = await prisma.staffingDemand.findFirst({
    where: { weeklyPlanId: planId, date, categoryId: data.categoryId, startTime },
    select: { id: true },
  });
  if (duplicate) {
    throw new AppError(
      "A demand for this category and start time already exists on that day.",
      409
    );
  }

  const createData: Prisma.StaffingDemandCreateInput = {
    weeklyPlan: { connect: { id: planId } },
    category: { connect: { id: data.categoryId } },
    date,
    startTime,
    endTime: new Date(data.endTime),
    requiredCount: data.requiredCount,
  };
  if (data.note !== undefined) createData.note = data.note;

  return prisma.staffingDemand.create({ data: createData, select: demandSelect });
};

// Bulk upload of demands (the "upload workload" action). Existing rows for the
// same [plan, date, category, startTime] are skipped rather than erroring.
const bulkAddDemands = async (planId: string, data: BulkDemandsInput) => {
  await ensurePlanExists(planId);

  const categoryIds = [...new Set(data.demands.map((d) => d.categoryId))];
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, isActive: true },
  });
  const usable = new Set(categories.filter((c) => c.isActive).map((c) => c.id));
  const invalid = categoryIds.find((id) => !usable.has(id));
  if (invalid) {
    throw new AppError(`Category ${invalid} does not exist or is inactive.`, 409);
  }

  const result = await prisma.staffingDemand.createMany({
    data: data.demands.map((d) => ({
      weeklyPlanId: planId,
      categoryId: d.categoryId,
      date: startOfUTCDay(new Date(d.date)),
      startTime: new Date(d.startTime),
      endTime: new Date(d.endTime),
      requiredCount: d.requiredCount,
      note: d.note ?? null,
    })),
    skipDuplicates: true,
  });

  return {
    createdCount: result.count,
    skippedCount: data.demands.length - result.count,
  };
};

const updateDemand = async (demandId: string, data: UpdateDemandInput) => {
  const existing = await prisma.staffingDemand.findUnique({ where: { id: demandId } });
  if (!existing) throw new AppError("Staffing demand not found.", 404);

  if (data.categoryId) await ensureCategoryUsable(data.categoryId);

  const nextStart = data.startTime ? new Date(data.startTime) : existing.startTime;
  const nextEnd = data.endTime ? new Date(data.endTime) : existing.endTime;
  if (nextEnd <= nextStart) {
    throw new AppError("endTime must be after startTime.", 400);
  }

  const updateData: Prisma.StaffingDemandUpdateInput = {};
  if (data.date !== undefined) updateData.date = startOfUTCDay(new Date(data.date));
  if (data.categoryId !== undefined) updateData.category = { connect: { id: data.categoryId } };
  if (data.requiredCount !== undefined) updateData.requiredCount = data.requiredCount;
  if (data.startTime !== undefined) updateData.startTime = new Date(data.startTime);
  if (data.endTime !== undefined) updateData.endTime = new Date(data.endTime);
  if (data.note !== undefined) updateData.note = data.note;

  return prisma.staffingDemand.update({
    where: { id: demandId },
    data: updateData,
    select: demandSelect,
  });
};

const deleteDemand = async (demandId: string) => {
  const existing = await prisma.staffingDemand.findUnique({
    where: { id: demandId },
    select: { id: true },
  });
  if (!existing) throw new AppError("Staffing demand not found.", 404);
  await prisma.staffingDemand.delete({ where: { id: demandId } });
};

// ─── Day / week / month view (cross-week sorting) ────────────────
const getWorkloadView = async (query: WorkloadViewQuery) => {
  const anchor = startOfUTCDay(new Date(query.date));

  let windowStart: Date;
  let windowEndExclusive: Date;
  if (query.view === "day") {
    windowStart = anchor;
    windowEndExclusive = addDays(anchor, 1);
  } else if (query.view === "week") {
    const dow = (anchor.getUTCDay() + 6) % 7; // days since Monday
    windowStart = addDays(anchor, -dow);
    windowEndExclusive = addDays(windowStart, 7);
  } else {
    windowStart = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
    windowEndExclusive = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1));
  }

  const where: Prisma.StaffingDemandWhereInput = {
    date: { gte: windowStart, lt: windowEndExclusive },
  };
  if (query.categoryId) where.categoryId = query.categoryId;

  const demands = await prisma.staffingDemand.findMany({
    where,
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    select: demandSelect,
  });

  const annotated = await annotateDemands(demands, windowStart, windowEndExclusive);

  return {
    view: query.view,
    range: { start: dateOnly(windowStart), end: dateOnly(addDays(windowEndExclusive, -1)) },
    totals: computeTotals(annotated),
    categories: groupByCategory(annotated),
    demands: annotated,
  };
};

export const workloadServices = {
  createWorkloadWeek,
  listWorkloadWeeks,
  getWorkloadWeek,
  updateWorkloadWeek,
  publishWorkloadWeek,
  deleteWorkloadWeek,
  addDemand,
  bulkAddDemands,
  updateDemand,
  deleteDemand,
  getWorkloadView,
};
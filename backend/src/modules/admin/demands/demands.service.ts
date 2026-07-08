import { prisma } from "../../../config/db";
import { AppError } from "../../../utils/AppError";
import type {
  ListDemandsQuery,
  CreateWeekInput,
  SaveGridInput,
  UpsertCellInput,
} from "./demands.validation";
import type { Prisma } from "../../../generated/prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Sunday-based week math (all UTC; dates stored at UTC midnight) ───
const startOfUTCDay = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
};

// The Sunday that opens the week containing `d` (getUTCDay: Sun=0 … Sat=6).
const weekStartSunday = (d: Date) => {
  const day = startOfUTCDay(d);
  return addDays(day, -day.getUTCDay());
};

const dateOnly = (d: Date) => d.toISOString().slice(0, 10);

const sevenDays = (weekStart: Date) => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

const relativeLabel = (weekStart: Date, currentStart: Date): "past" | "current" | "upcoming" => {
  const w = weekStart.getTime();
  const c = currentStart.getTime();
  return w < c ? "past" : w > c ? "upcoming" : "current";
};

// ─── Projections ─────────────────────────────────────────────────
const demandSelect = {
  id: true,
  categoryId: true,
  date: true,
  requiredCount: true,
} satisfies Prisma.DayDemandSelect;

const weekSelect = {
  id: true,
  weekStartDate: true,
  weekEndDate: true,
  status: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  demands: { select: demandSelect },
} satisfies Prisma.DemandWeekSelect;

type WeekRow = Prisma.DemandWeekGetPayload<{ select: typeof weekSelect }>;

const getActiveCategories = () =>
  prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ createdAt: "asc" }],
    select: { id: true, name: true },
  });

type CategoryRow = { id: string; name: string };

// Build the category × day grid for one week. Every active category gets a row,
// and every one of the 7 days a cell (0 when no demand row exists yet).
const buildWeek = (week: WeekRow, categories: CategoryRow[], currentStart: Date) => {
  const start = startOfUTCDay(week.weekStartDate);
  const days = sevenDays(start).map(dateOnly);

  const byKey = new Map<string, (typeof week.demands)[number]>();
  for (const d of week.demands) byKey.set(`${d.categoryId}|${dateOnly(d.date)}`, d);

  const categoryGrid = categories.map((cat) => ({
    category: cat,
    cells: days.map((day) => {
      const hit = byKey.get(`${cat.id}|${day}`);
      return {
        date: day,
        requiredCount: hit ? hit.requiredCount : 0,
        demandId: hit ? hit.id : null,
      };
    }),
  }));

  return {
    id: week.id,
    weekStartDate: dateOnly(week.weekStartDate),
    weekEndDate: dateOnly(week.weekEndDate),
    status: week.status,
    publishedAt: week.publishedAt,
    relative: relativeLabel(start, currentStart),
    days,
    categories: categoryGrid,
  };
};

const loadWeekOr404 = async (weekId: string) => {
  const week = await prisma.demandWeek.findUnique({ where: { id: weekId }, select: weekSelect });
  if (!week) throw new AppError("Demand week plan not found.", 404);
  return week;
};

// ─── List demands by scope (weekly / monthly / upcoming) ─────────
const getDemands = async (query: ListDemandsQuery) => {
  const now = new Date();
  const currentStart = weekStartSunday(now);
  const anchor = query.date ? new Date(query.date) : now;

  let where: Prisma.DemandWeekWhereInput;
  if (query.scope === "week") {
    where = { weekStartDate: weekStartSunday(anchor) };
  } else if (query.scope === "month") {
    const monthStart = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1));
    where = { weekStartDate: { gte: monthStart, lt: monthEnd } };
  } else {
    // upcoming: the current week first, then every future week.
    where = { weekStartDate: { gte: currentStart } };
  }

  const [weeks, categories] = await Promise.all([
    prisma.demandWeek.findMany({ where, orderBy: [{ weekStartDate: "asc" }], select: weekSelect }),
    getActiveCategories(),
  ]);

  return {
    scope: query.scope,
    today: dateOnly(startOfUTCDay(now)),
    currentWeek: {
      weekStartDate: dateOnly(currentStart),
      weekEndDate: dateOnly(addDays(currentStart, 6)),
    },
    weeks: weeks.map((w) => buildWeek(w, categories, currentStart)),
  };
};

// Lightweight list (no grid) — powers the "Start from week's data" dropdown.
const listWeeks = async () => {
  const currentStart = weekStartSunday(new Date());
  const weeks = await prisma.demandWeek.findMany({
    orderBy: [{ weekStartDate: "desc" }],
    select: {
      id: true,
      weekStartDate: true,
      weekEndDate: true,
      status: true,
      publishedAt: true,
      _count: { select: { demands: true } },
    },
  });

  return weeks.map((w) => ({
    id: w.id,
    weekStartDate: dateOnly(w.weekStartDate),
    weekEndDate: dateOnly(w.weekEndDate),
    status: w.status,
    publishedAt: w.publishedAt,
    demandCount: w._count.demands,
    relative: relativeLabel(startOfUTCDay(w.weekStartDate), currentStart),
  }));
};

const getWeek = async (weekId: string) => {
  const week = await loadWeekOr404(weekId);
  const categories = await getActiveCategories();
  return buildWeek(week, categories, weekStartSunday(new Date()));
};

// ─── Create a week plan (optionally seeded from another week) ─────
const createWeek = async (data: CreateWeekInput) => {
  const start = weekStartSunday(new Date(data.weekStartDate));
  const end = addDays(start, 6);

  const existing = await prisma.demandWeek.findUnique({
    where: { weekStartDate: start },
    select: { id: true },
  });
  if (existing) {
    throw new AppError("A demand plan already exists for this week.", 409);
  }

  // Optional copy-from: remap each source demand to the same weekday in the new
  // week, so "Start from week's data" carries the numbers forward.
  let seed: Prisma.DayDemandCreateWithoutDemandWeekInput[] = [];
  if (data.copyFromWeekId) {
    const source = await prisma.demandWeek.findUnique({
      where: { id: data.copyFromWeekId },
      select: { weekStartDate: true, demands: { select: demandSelect } },
    });
    if (!source) throw new AppError("The week to copy from was not found.", 404);

    const sourceStart = startOfUTCDay(source.weekStartDate);
    seed = source.demands.map((d) => {
      const offset = Math.round((startOfUTCDay(d.date).getTime() - sourceStart.getTime()) / DAY_MS);
      return {
        category: { connect: { id: d.categoryId } },
        date: addDays(start, offset),
        requiredCount: d.requiredCount,
      };
    });
  }

  const week = await prisma.demandWeek.create({
    data: {
      weekStartDate: start,
      weekEndDate: end,
      ...(seed.length ? { demands: { create: seed } } : {}),
    },
    select: weekSelect,
  });

  const categories = await getActiveCategories();
  return buildWeek(week, categories, weekStartSunday(new Date()));
};

// Validate a batch of cells against the week's 7 days and existing categories.
const validateCells = async (
  week: { weekStartDate: Date },
  cells: { categoryId: string; date: string }[]
) => {
  const start = startOfUTCDay(week.weekStartDate);
  const validDays = new Set(sevenDays(start).map(dateOnly));

  for (const c of cells) {
    if (!validDays.has(dateOnly(new Date(c.date)))) {
      throw new AppError(`Date ${dateOnly(new Date(c.date))} is outside this week.`, 400);
    }
  }

  const categoryIds = [...new Set(cells.map((c) => c.categoryId))];
  const found = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true },
  });
  const known = new Set(found.map((c) => c.id));
  const missing = categoryIds.find((id) => !known.has(id));
  if (missing) throw new AppError(`Category ${missing} does not exist.`, 400);
};

const cellWhere = (weekId: string, categoryId: string, date: string) => ({
  demandWeekId_categoryId_date: {
    demandWeekId: weekId,
    categoryId,
    date: startOfUTCDay(new Date(date)),
  },
});

// ─── Save the whole grid (per-week "Save") ───────────────────────
const saveGrid = async (weekId: string, data: SaveGridInput) => {
  const week = await loadWeekOr404(weekId);
  await validateCells(week, data.demands);

  await prisma.$transaction(
    data.demands.map((c) =>
      prisma.dayDemand.upsert({
        where: cellWhere(weekId, c.categoryId, c.date),
        create: {
          demandWeek: { connect: { id: weekId } },
          category: { connect: { id: c.categoryId } },
          date: startOfUTCDay(new Date(c.date)),
          requiredCount: c.requiredCount,
        },
        update: { requiredCount: c.requiredCount },
      })
    )
  );

  return getWeek(weekId);
};

// ─── Update a single cell (stepper) ──────────────────────────────
const upsertCell = async (weekId: string, data: UpsertCellInput) => {
  const week = await loadWeekOr404(weekId);
  await validateCells(week, [data]);

  const demand = await prisma.dayDemand.upsert({
    where: cellWhere(weekId, data.categoryId, data.date),
    create: {
      demandWeek: { connect: { id: weekId } },
      category: { connect: { id: data.categoryId } },
      date: startOfUTCDay(new Date(data.date)),
      requiredCount: data.requiredCount,
    },
    update: { requiredCount: data.requiredCount },
    select: { ...demandSelect, date: true },
  });

  return { ...demand, date: dateOnly(demand.date) };
};

// ─── Publish a week plan ─────────────────────────────────────────
const publishWeek = async (weekId: string) => {
  await loadWeekOr404(weekId);
  const week = await prisma.demandWeek.update({
    where: { id: weekId },
    data: { status: "PUBLISHED", publishedAt: new Date() },
    select: weekSelect,
  });
  const categories = await getActiveCategories();
  return buildWeek(week, categories, weekStartSunday(new Date()));
};

// ─── Delete a week plan ──────────────────────────────────────────
const deleteWeek = async (weekId: string) => {
  await loadWeekOr404(weekId);
  await prisma.demandWeek.delete({ where: { id: weekId } });
};

export const demandServices = {
  getDemands,
  listWeeks,
  getWeek,
  createWeek,
  saveGrid,
  upsertCell,
  publishWeek,
  deleteWeek,
};

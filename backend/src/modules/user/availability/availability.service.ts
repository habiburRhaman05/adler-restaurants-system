import { prisma } from "../../../config/db";
import { AppError } from "../../../utils/AppError";
import type { DayEntry } from "./availability.validation";
import type { Prisma } from "../../../generated/prisma/client";

const monthSelect = {
  id: true,
  year: true,
  month: true,
  status: true,
  cutoffAt: true,
  submittedAt: true,
  days: {
    orderBy: { date: "asc" },
    select: {
      id: true,
      date: true,
      status: true,
      note: true,
      preferredStartTime: true,
      preferredEndTime: true,
    },
  },
} satisfies Prisma.AvailabilityMonthSelect;

// Last moment of the (1-based) month in UTC — the default cut-off when a
// slot is self-opened rather than opened by an admin.
const endOfMonthUTC = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

// Whether (year, month) counts as "the current month" for self-opening.
// Checked at UTC±(14h/12h) — the extreme timezones — so a device that has
// already rolled into the new month (or is still in the old one) is never
// locked out at a month boundary.
const isCurrentMonth = (year: number, month: number) => {
  for (const d of [
    new Date(),
    new Date(Date.now() + 14 * 60 * 60 * 1000),
    new Date(Date.now() - 12 * 60 * 60 * 1000),
  ]) {
    if (d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month) return true;
  }
  return false;
};

// Staff can always fill in the current month: if management hasn't opened a
// slot yet, one is created on first access. Admin-opened slots (and their
// cut-offs) are left untouched; other months still require an admin to open.
const ensureCurrentMonthOpen = async (userId: string, year: number, month: number) => {
  if (!isCurrentMonth(year, month)) return;
  await prisma.availabilityMonth.upsert({
    where: { userId_year_month: { userId, year, month } },
    create: { userId, year, month, cutoffAt: endOfMonthUTC(year, month) },
    update: {},
    select: { id: true },
  });
};

// Availability is only editable while the slot is a DRAFT and the cut-off is
// still in the future; after that it is binding.
const loadEditableMonth = async (userId: string, year: number, month: number) => {
  await ensureCurrentMonthOpen(userId, year, month);
  const m = await prisma.availabilityMonth.findUnique({
    where: { userId_year_month: { userId, year, month } },
    select: { id: true, status: true, cutoffAt: true, _count: { select: { days: true } } },
  });
  if (!m) {
    throw new AppError("Availability for this month is not open yet.", 404);
  }
  if (m.status !== "DRAFT") {
    throw new AppError("Your availability is already submitted and can no longer be edited.", 409);
  }
  if (m.cutoffAt.getTime() < Date.now()) {
    throw new AppError("The cut-off date for this month has passed.", 409);
  }
  return m;
};

// ─── List my availability months (which ones are open to submit) ─
const listMyMonths = async (userId: string) => {
  const months = await prisma.availabilityMonth.findMany({
    where: { userId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    select: {
      id: true,
      year: true,
      month: true,
      status: true,
      cutoffAt: true,
      submittedAt: true,
      _count: { select: { days: true } },
    },
  });

  const now = Date.now();
  return months.map((m) => ({
    id: m.id,
    year: m.year,
    month: m.month,
    status: m.status,
    cutoffAt: m.cutoffAt,
    submittedAt: m.submittedAt,
    dayCount: m._count.days,
    // The app can show/hide the "edit availability" action based on this.
    editable: m.status === "DRAFT" && m.cutoffAt.getTime() > now,
  }));
};

// ─── Get my availability for a month ─────────────────────────────
const getMyMonth = async (userId: string, year: number, month: number) => {
  await ensureCurrentMonthOpen(userId, year, month);
  const m = await prisma.availabilityMonth.findUnique({
    where: { userId_year_month: { userId, year, month } },
    select: monthSelect,
  });
  if (!m) {
    throw new AppError("Availability for this month is not open yet.", 404);
  }
  return m;
};

// ─── Set my day entries (full replace) ───────────────────────────
const setDays = async (userId: string, year: number, month: number, days: DayEntry[]) => {
  const m = await loadEditableMonth(userId, year, month);

  // Every entry must fall inside the target month.
  const monthStart = Date.UTC(year, month - 1, 1);
  const monthEnd = Date.UTC(year, month, 1);
  for (const d of days) {
    const t = Date.parse(d.date);
    if (!(t >= monthStart && t < monthEnd)) {
      throw new AppError(
        `Date ${d.date} is not within ${String(month).padStart(2, "0")}/${year}.`,
        400
      );
    }
  }

  // Reject duplicate dates in the payload (would violate the unique constraint).
  const seen = new Set<string>();
  for (const d of days) {
    const key = new Date(d.date).toISOString().slice(0, 10);
    if (seen.has(key)) {
      throw new AppError(`Duplicate entry for date ${key}.`, 400);
    }
    seen.add(key);
  }

  const rows = days.map((d) => {
    const row: Prisma.AvailabilityDayCreateManyInput = {
      availabilityMonthId: m.id,
      date: new Date(d.date),
      status: d.status,
    };
    if (d.note !== undefined) row.note = d.note;
    if (d.preferredStartTime !== undefined) row.preferredStartTime = new Date(d.preferredStartTime);
    if (d.preferredEndTime !== undefined) row.preferredEndTime = new Date(d.preferredEndTime);
    return row;
  });

  await prisma.$transaction([
    prisma.availabilityDay.deleteMany({ where: { availabilityMonthId: m.id } }),
    prisma.availabilityDay.createMany({ data: rows }),
  ]);

  return getMyMonth(userId, year, month);
};

// ─── Submit bindingly ────────────────────────────────────────────
const submit = async (userId: string, year: number, month: number) => {
  const m = await loadEditableMonth(userId, year, month);
  if (m._count.days === 0) {
    throw new AppError("Add your availability before submitting.", 400);
  }

  return prisma.availabilityMonth.update({
    where: { id: m.id },
    data: { status: "SUBMITTED", submittedAt: new Date() },
    select: monthSelect,
  });
};

export const userAvailabilityServices = {
  listMyMonths,
  getMyMonth,
  setDays,
  submit,
};

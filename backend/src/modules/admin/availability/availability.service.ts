import { prisma } from "../../../config/db";
import { AppError } from "../../../utils/AppError";
import type { OpenAvailabilityInput } from "./availability.validation";
import type { Prisma } from "../../../generated/prisma/client";

const monthDetailSelect = {
  id: true,
  userId: true,
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
  user: { select: { id: true, name: true, firstName: true, lastName: true, email: true } },
} satisfies Prisma.AvailabilityMonthSelect;

// ─── Open a month for availability (one slot per active employee) ─
const openMonth = async (data: OpenAvailabilityInput) => {
  const cutoffAt = new Date(data.cutoffAt);
  const users = await prisma.user.findMany({ where: { isActive: true }, select: { id: true } });
  if (users.length === 0) {
    throw new AppError("There are no active employees to open availability for.", 409);
  }

  // Upsert a slot per user — new ones start DRAFT; existing ones just get the
  // (possibly updated) cut-off, preserving anything already filled in.
  await prisma.$transaction(
    users.map((u) =>
      prisma.availabilityMonth.upsert({
        where: { userId_year_month: { userId: u.id, year: data.year, month: data.month } },
        create: { userId: u.id, year: data.year, month: data.month, cutoffAt },
        update: { cutoffAt },
        select: { id: true },
      })
    )
  );

  return { year: data.year, month: data.month, cutoffAt, opened: users.length };
};

// ─── Submission status for every active employee ─────────────────
const getMonthStatus = async (year: number, month: number) => {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, firstName: true, lastName: true, email: true },
  });

  const months = await prisma.availabilityMonth.findMany({
    where: { year, month, userId: { in: users.map((u) => u.id) } },
    select: {
      userId: true,
      status: true,
      submittedAt: true,
      cutoffAt: true,
      _count: { select: { days: true } },
    },
  });
  const byUser = new Map(months.map((m) => [m.userId, m]));

  const rows = users.map((u) => {
    const m = byUser.get(u.id);
    return {
      userId: u.id,
      name: u.name,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      // NOT_OPENED = this employee has no slot for the month yet.
      status: m ? m.status : ("NOT_OPENED" as const),
      submittedAt: m?.submittedAt ?? null,
      cutoffAt: m?.cutoffAt ?? null,
      filledDays: m?._count.days ?? 0,
    };
  });

  const submitted = rows.filter((r) => r.status === "SUBMITTED");
  const notSubmitted = rows.filter((r) => r.status !== "SUBMITTED");

  return {
    year,
    month,
    rows,
    notSubmitted,
    summary: { total: rows.length, submitted: submitted.length, notSubmitted: notSubmitted.length },
  };
};

// ─── Full grid: every employee's availability days for a month ───
// One call that gives the admin dashboard the complete picture — each active
// employee with their submitted (or draft) day-by-day availability — so it can
// render the availability grid that feeds weekly planning.
const getMonthGrid = async (year: number, month: number) => {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, firstName: true, lastName: true, email: true },
  });

  const months = await prisma.availabilityMonth.findMany({
    where: { year, month, userId: { in: users.map((u) => u.id) } },
    select: {
      userId: true,
      status: true,
      submittedAt: true,
      cutoffAt: true,
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
    },
  });
  const byUser = new Map(months.map((m) => [m.userId, m]));

  const employees = users.map((u) => {
    const m = byUser.get(u.id);
    return {
      userId: u.id,
      name: u.name,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      status: m ? m.status : ("NOT_OPENED" as const),
      submittedAt: m?.submittedAt ?? null,
      cutoffAt: m?.cutoffAt ?? null,
      days: m?.days ?? [],
    };
  });

  const submitted = employees.filter((e) => e.status === "SUBMITTED").length;
  return {
    year,
    month,
    employees,
    summary: { total: employees.length, submitted, notSubmitted: employees.length - submitted },
  };
};

// ─── A single employee's availability for a month ────────────────
const getUserMonth = async (userId: string, year: number, month: number) => {
  const m = await prisma.availabilityMonth.findUnique({
    where: { userId_year_month: { userId, year, month } },
    select: monthDetailSelect,
  });
  if (!m) {
    throw new AppError("This employee has no availability for the given month.", 404);
  }
  return m;
};

// ─── Nudge an employee who hasn't submitted ──────────────────────
const nudge = async (userId: string, year: number, month: number) => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) {
    throw new AppError("Employee not found.", 404);
  }

  const m = await prisma.availabilityMonth.findUnique({
    where: { userId_year_month: { userId, year, month } },
    select: { status: true },
  });
  if (!m) {
    throw new AppError("Availability for this month has not been opened for this employee.", 409);
  }
  if (m.status === "SUBMITTED") {
    throw new AppError("This employee has already submitted their availability.", 409);
  }

  await prisma.notification.create({
    data: {
      userId,
      type: "AVAILABILITY_REMINDER",
      channel: "IN_APP",
      status: "SENT",
      title: "Availability reminder",
      body: `Please submit your availability for ${String(month).padStart(2, "0")}/${year} before the cut-off.`,
      sentAt: new Date(),
      payload: { year, month },
    },
  });

  return { notified: true };
};

export const adminAvailabilityServices = {
  openMonth,
  getMonthStatus,
  getMonthGrid,
  getUserMonth,
  nudge,
};

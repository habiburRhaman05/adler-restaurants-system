import { prisma } from "../../../config/db";
import type { ListAttendanceQuery, ReportQuery } from "./attendance.validation";
import type { Prisma } from "../../../generated/prisma/client";

const startOfUTCDay = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
};

const userSelect = {
  id: true,
  name: true,
  firstName: true,
  lastName: true,
  email: true,
  hourlyRate: true,
} satisfies Prisma.UserSelect;

const entrySelect = {
  id: true,
  userId: true,
  user: { select: userSelect },
  shiftId: true,
  shift: {
    select: {
      id: true,
      date: true,
      startTime: true,
      endTime: true,
      category: { select: { id: true, name: true } },
    },
  },
  clockInAt: true,
  clockOutAt: true,
  breakMinutes: true,
  status: true,
  workedMinutes: true,
  lateMinutes: true,
  overtimeMinutes: true,
  location: true,
  note: true,
} satisfies Prisma.TimeEntrySelect;

// ─── Admin list view ─────────────────────────────────────────────
const listAttendance = async (query: ListAttendanceQuery) => {
  const { page, limit, userId, date, status } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.TimeEntryWhereInput = {};
  if (userId) where.userId = userId;
  if (status) where.status = status;
  if (date) {
    const day = startOfUTCDay(new Date(date));
    where.clockInAt = { gte: day, lt: addDays(day, 1) };
  }

  const [entries, total] = await Promise.all([
    prisma.timeEntry.findMany({
      where,
      skip,
      take: limit,
      orderBy: { clockInAt: "desc" },
      select: entrySelect,
    }),
    prisma.timeEntry.count({ where }),
  ]);

  return {
    entries,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// ─── Per-employee report (hours + wage estimate + absences) ──────
const getAttendanceReport = async (query: ReportQuery) => {
  let start: Date;
  let endExclusive: Date;
  if (query.from && query.to) {
    start = startOfUTCDay(new Date(query.from));
    endExclusive = addDays(startOfUTCDay(new Date(query.to)), 1);
  } else {
    const anchor = query.month ? new Date(`${query.month}-01T00:00:00.000Z`) : new Date();
    start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
    endExclusive = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1));
  }

  const entryWhere: Prisma.TimeEntryWhereInput = {
    status: "COMPLETED",
    clockInAt: { gte: start, lt: endExclusive },
  };
  if (query.userId) entryWhere.userId = query.userId;

  const now = new Date();

  const [entries, endedShifts] = await Promise.all([
    prisma.timeEntry.findMany({
      where: entryWhere,
      select: {
        userId: true,
        user: { select: userSelect },
        workedMinutes: true,
        breakMinutes: true,
        lateMinutes: true,
        overtimeMinutes: true,
      },
    }),
    // Absence detection: published roster shifts that have ended with no time
    // entry recorded against them (computed on read, never persisted).
    prisma.shift.findMany({
      where: {
        date: { gte: start, lt: endExclusive },
        endTime: { lt: now },
        status: { in: ["ACCEPTED", "PENDING"] },
        weeklyPlan: { status: "PUBLISHED" },
        timeEntries: { none: {} },
        ...(query.userId ? { userId: query.userId } : {}),
      },
      select: {
        id: true,
        userId: true,
        user: { select: userSelect },
        date: true,
        startTime: true,
        endTime: true,
        category: { select: { id: true, name: true } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
  ]);

  type Row = {
    user: (typeof entries)[number]["user"];
    workedMinutes: number;
    breakMinutes: number;
    lateCount: number;
    overtimeMinutes: number;
    entryCount: number;
    absenceCount: number;
  };
  const byUser = new Map<string, Row>();
  const rowFor = (userId: string, user: Row["user"]) => {
    let row = byUser.get(userId);
    if (!row) {
      row = {
        user,
        workedMinutes: 0,
        breakMinutes: 0,
        lateCount: 0,
        overtimeMinutes: 0,
        entryCount: 0,
        absenceCount: 0,
      };
      byUser.set(userId, row);
    }
    return row;
  };

  for (const e of entries) {
    const row = rowFor(e.userId, e.user);
    row.workedMinutes += e.workedMinutes ?? 0;
    row.breakMinutes += e.breakMinutes;
    row.lateCount += (e.lateMinutes ?? 0) > 0 ? 1 : 0;
    row.overtimeMinutes += e.overtimeMinutes ?? 0;
    row.entryCount += 1;
  }
  for (const s of endedShifts) {
    rowFor(s.userId, s.user).absenceCount += 1;
  }

  const employees = [...byUser.entries()].map(([userId, row]) => {
    const workedHours = row.workedMinutes / 60;
    const hourlyRate = row.user.hourlyRate ? Number(row.user.hourlyRate) : null;
    return {
      userId,
      user: row.user,
      workedHours: Number(workedHours.toFixed(2)),
      breakMinutes: row.breakMinutes,
      lateCount: row.lateCount,
      overtimeMinutes: row.overtimeMinutes,
      entryCount: row.entryCount,
      absenceCount: row.absenceCount,
      estimatedWage: hourlyRate !== null ? Number((workedHours * hourlyRate).toFixed(2)) : null,
    };
  });

  return {
    range: {
      start: start.toISOString().slice(0, 10),
      end: addDays(endExclusive, -1).toISOString().slice(0, 10),
    },
    employees,
    absences: endedShifts.map((s) => ({
      shiftId: s.id,
      userId: s.userId,
      userName:
        s.user.name ??
        ([s.user.firstName, s.user.lastName].filter(Boolean).join(" ") || s.user.email),
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      category: s.category,
    })),
    totals: {
      workedHours: Number(employees.reduce((sum, e) => sum + e.workedHours, 0).toFixed(2)),
      estimatedWage: Number(
        employees.reduce((sum, e) => sum + (e.estimatedWage ?? 0), 0).toFixed(2)
      ),
      absenceCount: endedShifts.length,
    },
  };
};

export const adminAttendanceServices = {
  listAttendance,
  getAttendanceReport,
};

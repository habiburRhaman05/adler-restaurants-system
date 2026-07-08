import { prisma } from "../../../config/db";
import { AppError } from "../../../utils/AppError";
import type { ClockInInput, ClockOutInput, HistoryQuery } from "./attendance.validation";
import type { Prisma } from "../../../generated/prisma/client";

const MINUTES_PER_MS = 1 / (1000 * 60);

const entrySelect = {
  id: true,
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
  breakStartedAt: true,
  breakMinutes: true,
  location: true,
  status: true,
  workedMinutes: true,
  lateMinutes: true,
  overtimeMinutes: true,
  note: true,
  createdAt: true,
} satisfies Prisma.TimeEntrySelect;

const findOpenEntry = (userId: string) =>
  prisma.timeEntry.findFirst({
    where: { userId, status: { in: ["ACTIVE", "ON_BREAK"] } },
    select: entrySelect,
    orderBy: { clockInAt: "desc" },
  });

// Live seconds counters for the mobile timer.
const withElapsed = <T extends { clockInAt: Date; breakMinutes: number; breakStartedAt: Date | null; status: string }>(
  entry: T
) => {
  const now = Date.now();
  const liveBreakSeconds =
    entry.status === "ON_BREAK" && entry.breakStartedAt
      ? Math.floor((now - entry.breakStartedAt.getTime()) / 1000)
      : 0;
  const breakSeconds = entry.breakMinutes * 60 + liveBreakSeconds;
  const elapsedSeconds = Math.floor((now - entry.clockInAt.getTime()) / 1000);
  return {
    ...entry,
    elapsedSeconds,
    breakSeconds,
    workedSeconds: Math.max(0, elapsedSeconds - breakSeconds),
  };
};

// ─── Clock in ────────────────────────────────────────────────────
const clockIn = async (userId: string, data: ClockInInput) => {
  const open = await findOpenEntry(userId);
  if (open) throw new AppError("You are already clocked in.", 409);

  let lateMinutes: number | null = null;
  const now = new Date();

  if (data.shiftId) {
    const shift = await prisma.shift.findUnique({
      where: { id: data.shiftId },
      select: {
        id: true,
        userId: true,
        status: true,
        startTime: true,
        endTime: true,
        weeklyPlan: { select: { status: true } },
      },
    });
    if (!shift || shift.userId !== userId) throw new AppError("Shift not found.", 404);
    if (shift.weeklyPlan.status !== "PUBLISHED") {
      throw new AppError("This shift's schedule has not been published yet.", 409);
    }
    if (shift.status !== "ACCEPTED" && shift.status !== "PENDING") {
      throw new AppError("You can only clock in to an active (accepted) shift.", 409);
    }
    if (now >= shift.endTime) {
      throw new AppError("This shift has already ended.", 409);
    }

    // Configurable early clock-in window (default 15 minutes before start).
    const settings = await prisma.orgSettings.findUnique({
      where: { id: 1 },
      select: { earlyClockInWindowMinutes: true },
    });
    const windowMinutes = settings?.earlyClockInWindowMinutes ?? 15;
    const earliest = new Date(shift.startTime.getTime() - windowMinutes * 60 * 1000);
    if (now < earliest) {
      throw new AppError(
        `You can clock in starting ${windowMinutes} minutes before your shift.`,
        400
      );
    }

    lateMinutes = Math.max(0, Math.round((now.getTime() - shift.startTime.getTime()) * MINUTES_PER_MS));
  }

  const entry = await prisma.timeEntry.create({
    data: {
      userId,
      clockInAt: now,
      status: "ACTIVE",
      ...(data.shiftId ? { shiftId: data.shiftId } : {}),
      ...(data.latitude !== undefined ? { latitude: data.latitude } : {}),
      ...(data.longitude !== undefined ? { longitude: data.longitude } : {}),
      ...(data.location !== undefined ? { location: data.location } : {}),
      ...(data.note !== undefined ? { note: data.note } : {}),
      ...(lateMinutes !== null ? { lateMinutes } : {}),
    },
    select: entrySelect,
  });

  return withElapsed(entry);
};

// ─── Breaks ──────────────────────────────────────────────────────
const startBreak = async (userId: string) => {
  const open = await findOpenEntry(userId);
  if (!open) throw new AppError("You are not clocked in.", 409);
  if (open.status === "ON_BREAK") throw new AppError("You are already on a break.", 409);

  const entry = await prisma.timeEntry.update({
    where: { id: open.id },
    data: { status: "ON_BREAK", breakStartedAt: new Date() },
    select: entrySelect,
  });
  return withElapsed(entry);
};

const endBreak = async (userId: string) => {
  const open = await findOpenEntry(userId);
  if (!open || open.status !== "ON_BREAK" || !open.breakStartedAt) {
    throw new AppError("You are not on a break.", 409);
  }

  const addedMinutes = Math.max(
    0,
    Math.round((Date.now() - open.breakStartedAt.getTime()) * MINUTES_PER_MS)
  );
  const entry = await prisma.timeEntry.update({
    where: { id: open.id },
    data: {
      status: "ACTIVE",
      breakStartedAt: null,
      breakMinutes: open.breakMinutes + addedMinutes,
    },
    select: entrySelect,
  });
  return withElapsed(entry);
};

// ─── Clock out ───────────────────────────────────────────────────
const clockOut = async (userId: string, data: ClockOutInput) => {
  const open = await findOpenEntry(userId);
  if (!open) throw new AppError("You are not clocked in.", 409);

  const now = new Date();

  // A break still running at clock-out is folded into the break total.
  const extraBreak =
    open.status === "ON_BREAK" && open.breakStartedAt
      ? Math.max(0, Math.round((now.getTime() - open.breakStartedAt.getTime()) * MINUTES_PER_MS))
      : 0;
  const breakMinutes = open.breakMinutes + extraBreak;

  const totalMinutes = Math.max(
    0,
    Math.round((now.getTime() - open.clockInAt.getTime()) * MINUTES_PER_MS)
  );
  const workedMinutes = Math.max(0, totalMinutes - breakMinutes);

  const overtimeMinutes = open.shift
    ? Math.max(0, Math.round((now.getTime() - open.shift.endTime.getTime()) * MINUTES_PER_MS))
    : null;

  const [entry] = await prisma.$transaction([
    prisma.timeEntry.update({
      where: { id: open.id },
      data: {
        status: "COMPLETED",
        clockOutAt: now,
        breakStartedAt: null,
        breakMinutes,
        workedMinutes,
        ...(overtimeMinutes !== null ? { overtimeMinutes } : {}),
        ...(data.note !== undefined ? { note: data.note } : {}),
      },
      select: entrySelect,
    }),
    // Mirror actuals onto the roster shift for reporting/hours.
    ...(open.shiftId
      ? [
          prisma.shift.update({
            where: { id: open.shiftId },
            data: {
              actualStartTime: open.clockInAt,
              actualEndTime: now,
              actualBreakMinutes: breakMinutes,
            },
          }),
        ]
      : []),
  ]);

  return {
    entry,
    summary: {
      workedHours: Number((workedMinutes / 60).toFixed(2)),
      workedMinutes,
      breakMinutes,
      lateMinutes: entry.lateMinutes ?? 0,
      overtimeMinutes: overtimeMinutes ?? 0,
    },
  };
};

// ─── Current status / history ────────────────────────────────────
const getCurrentStatus = async (userId: string) => {
  const open = await findOpenEntry(userId);
  return { active: open !== null, entry: open ? withElapsed(open) : null };
};

const getHistory = async (userId: string, query: HistoryQuery) => {
  const { page, limit, month } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.TimeEntryWhereInput = { userId, status: "COMPLETED" };
  if (month) {
    const anchor = new Date(`${month}-01T00:00:00.000Z`);
    where.clockInAt = {
      gte: anchor,
      lt: new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1)),
    };
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

  const totals = entries.reduce(
    (acc, e) => {
      acc.workedMinutes += e.workedMinutes ?? 0;
      acc.breakMinutes += e.breakMinutes;
      acc.lateCount += (e.lateMinutes ?? 0) > 0 ? 1 : 0;
      return acc;
    },
    { workedMinutes: 0, breakMinutes: 0, lateCount: 0 }
  );

  return {
    entries,
    totals: { ...totals, workedHours: Number((totals.workedMinutes / 60).toFixed(2)) },
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const attendanceServices = {
  clockIn,
  clockOut,
  startBreak,
  endBreak,
  getCurrentStatus,
  getHistory,
};

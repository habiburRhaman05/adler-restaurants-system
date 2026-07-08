import { prisma } from "../../../config/db";
import { AppError } from "../../../utils/AppError";
import type {
  MyShiftsQuery,
  RespondShiftInput,
  BatchRespondInput,
  MyHoursQuery,
} from "./me.validation";
import type { Prisma } from "../../../generated/prisma/client";

const HOURS_PER_MS = 1 / (1000 * 60 * 60);

// [start, endExclusive) UTC bounds of a "YYYY-MM" month; defaults to now.
const monthBounds = (month?: string) => {
  const anchor = month ? new Date(`${month}-01T00:00:00.000Z`) : new Date();
  const start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
  const endExclusive = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1));
  return { start, endExclusive };
};

const myShiftSelect = {
  id: true,
  weeklyPlanId: true,
  date: true,
  startTime: true,
  endTime: true,
  status: true,
  rejectionReason: true,
  actualStartTime: true,
  actualEndTime: true,
  actualBreakMinutes: true,
  category: { select: { id: true, name: true } },
  weeklyPlan: { select: { status: true, weekStartDate: true, weekEndDate: true } },
} satisfies Prisma.ShiftSelect;

// ─── My shifts (published plans only — drafts are never visible) ──
const getMyShifts = async (userId: string, query: MyShiftsQuery) => {
  const { start, endExclusive } = monthBounds(query.month);

  const [shifts, unpublishedPlanCount] = await Promise.all([
    prisma.shift.findMany({
      where: {
        userId,
        date: { gte: start, lt: endExclusive },
        weeklyPlan: { status: "PUBLISHED" },
        status: { notIn: ["CANCELLED", "SWAPPED_OUT"] },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      select: myShiftSelect,
    }),
    // Lets the mobile empty state distinguish "no plan exists" from "a plan
    // exists but hasn't been published yet".
    prisma.weeklyPlan.count({
      where: {
        status: { not: "PUBLISHED" },
        weekStartDate: { lt: endExclusive },
        weekEndDate: { gte: start },
      },
    }),
  ]);

  return {
    month: `${start.toISOString().slice(0, 7)}`,
    status: "published" as const,
    hasUnpublishedPlan: unpublishedPlanCount > 0,
    shifts,
  };
};

// ─── Respond to an assigned shift (accept / reject) ──────────────
const respondToShift = async (userId: string, data: RespondShiftInput) => {
  const shift = await prisma.shift.findUnique({
    where: { id: data.shiftId },
    select: {
      id: true,
      userId: true,
      status: true,
      endTime: true,
      weeklyPlan: { select: { status: true } },
    },
  });
  if (!shift || shift.userId !== userId) {
    throw new AppError("Shift not found.", 404);
  }
  if (shift.weeklyPlan.status !== "PUBLISHED") {
    throw new AppError("This shift's schedule has not been published yet.", 409);
  }
  if (shift.status !== "PENDING") {
    throw new AppError("This shift has already been responded to.", 409);
  }
  if (shift.endTime <= new Date()) {
    throw new AppError("This shift has already ended.", 409);
  }

  const updated = await prisma.shift.update({
    where: { id: shift.id },
    data:
      data.action === "ACCEPT"
        ? { status: "ACCEPTED", rejectionReason: null }
        : { status: "REJECTED", rejectionReason: data.reason ?? null },
    select: myShiftSelect,
  });

  return updated;
};

const batchRespond = async (userId: string, data: BatchRespondInput) => {
  const results: { shiftId: string; success: boolean; error?: string }[] = [];
  for (const response of data.responses) {
    try {
      await respondToShift(userId, response);
      results.push({ shiftId: response.shiftId, success: true });
    } catch (err) {
      results.push({
        shiftId: response.shiftId,
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }
  return {
    results,
    succeeded: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
  };
};

// ─── My hours (planned vs actual, for the Analysis tab) ──────────
const getMyHours = async (userId: string, query: MyHoursQuery) => {
  const { start, endExclusive } = monthBounds(query.month);

  const [shifts, user] = await Promise.all([
    prisma.shift.findMany({
      where: {
        userId,
        date: { gte: start, lt: endExclusive },
        weeklyPlan: { status: "PUBLISHED" },
        status: { in: ["ACCEPTED", "PENDING"] },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        status: true,
        actualStartTime: true,
        actualEndTime: true,
        actualBreakMinutes: true,
        category: { select: { id: true, name: true } },
      },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { hourlyRate: true, contractedHoursMonthly: true },
    }),
  ]);

  const entries = shifts.map((s) => {
    const plannedHours = (s.endTime.getTime() - s.startTime.getTime()) * HOURS_PER_MS;
    const actualHours =
      s.actualStartTime && s.actualEndTime
        ? Math.max(
            0,
            (s.actualEndTime.getTime() - s.actualStartTime.getTime()) * HOURS_PER_MS -
              (s.actualBreakMinutes ?? 0) / 60
          )
        : null;
    return {
      shiftId: s.id,
      date: s.date,
      category: s.category,
      status: s.status,
      plannedStart: s.startTime,
      plannedEnd: s.endTime,
      actualStart: s.actualStartTime,
      actualEnd: s.actualEndTime,
      breakMinutes: s.actualBreakMinutes,
      hours: Number((actualHours ?? plannedHours).toFixed(2)),
    };
  });

  const totalHours = Number(entries.reduce((sum, e) => sum + e.hours, 0).toFixed(2));

  return {
    month: `${start.toISOString().slice(0, 7)}`,
    totalHours,
    targetHours: user?.contractedHoursMonthly ? Number(user.contractedHoursMonthly) : null,
    hourlyRate: user?.hourlyRate ? Number(user.hourlyRate) : null,
    entries,
  };
};

const updateProfile = async (userId: string, data: { firstName?: string; lastName?: string; phone?: string; address?: string }) => {
  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      address: true,
      contractedHoursMonthly: true,
      hourlyRate: true,
    }
  });

  return user;
};

export const meServices = {
  getMyShifts,
  respondToShift,
  batchRespond,
  getMyHours,
  updateProfile,
};

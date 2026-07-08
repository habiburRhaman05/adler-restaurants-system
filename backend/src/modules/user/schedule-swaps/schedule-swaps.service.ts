import { prisma } from "../../../config/db";
import { AppError } from "../../../utils/AppError";
import type {
  SearchSwapTargetsQuery,
  CreateScheduleSwapInput,
  ListMySwapsQuery,
  RespondSwapInput,
} from "./schedule-swaps.validation";
import type { Prisma } from "../../../generated/prisma/client";

const HOURS_PER_MS = 1 / (1000 * 60 * 60);

const startOfUTCDay = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
};

const durationHours = (s: { startTime: Date; endTime: Date }) =>
  (s.endTime.getTime() - s.startTime.getTime()) * HOURS_PER_MS;

const displayName = (u: {
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
}) => u.name ?? ([u.firstName, u.lastName].filter(Boolean).join(" ") || u.email);

const swapShiftSelect = {
  id: true,
  date: true,
  startTime: true,
  endTime: true,
  status: true,
  category: { select: { id: true, name: true } },
} satisfies Prisma.ShiftSelect;

const swapUserSelect = {
  id: true,
  name: true,
  firstName: true,
  lastName: true,
  email: true,
} satisfies Prisma.UserSelect;

export const scheduleSwapSelect = {
  id: true,
  swapType: true,
  initiatorUserId: true,
  initiatorUser: { select: swapUserSelect },
  initiatorShiftId: true,
  initiatorShift: { select: swapShiftSelect },
  recipientUserId: true,
  recipientUser: { select: swapUserSelect },
  recipientShiftId: true,
  recipientShift: { select: swapShiftSelect },
  status: true,
  recipientRespondedAt: true,
  ruleCheckResult: true,
  ruleCheckPassed: true,
  adminReason: true,
  resolvedAt: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SwapRequestSelect;

// A swap that still blocks its shifts from being offered again.
const OPEN_SWAP_STATUSES = ["PENDING_RECIPIENT", "PENDING_ADMIN_APPROVAL"] as const;

// ─── Advisory L-GAV rule check (projected hours after the swap) ──
const projectedHours = async (
  userId: string,
  window: { start: Date; endExclusive: Date },
  excludeShiftId: string,
  incomingShift: { startTime: Date; endTime: Date }
) => {
  const rows = await prisma.shift.findMany({
    where: {
      userId,
      id: { not: excludeShiftId },
      startTime: { gte: window.start, lt: window.endExclusive },
      status: { notIn: ["CANCELLED", "REJECTED", "SWAPPED_OUT"] },
    },
    select: { startTime: true, endTime: true },
  });
  let hours = rows.reduce((sum, r) => sum + durationHours(r), 0);
  if (
    incomingShift.startTime >= window.start &&
    incomingShift.startTime < window.endExclusive
  ) {
    hours += durationHours(incomingShift);
  }
  return hours;
};

const weekWindow = (d: Date) => {
  const day = startOfUTCDay(d);
  const diffToMonday = (day.getUTCDay() + 6) % 7;
  const start = addDays(day, -diffToMonday);
  return { start, endExclusive: addDays(start, 7) };
};

const dayWindow = (d: Date) => {
  const start = startOfUTCDay(d);
  return { start, endExclusive: addDays(start, 1) };
};

type SwapParty = {
  userId: string;
  name: string;
  givingShiftId: string;
  takingShift: { startTime: Date; endTime: Date };
};

const evaluateSwapRules = async (parties: SwapParty[]) => {
  const settings = await prisma.orgSettings.findUnique({
    where: { id: 1 },
    select: { maxDailyHours: true, maxWeeklyHours: true },
  });
  const maxWeekly = settings ? Number(settings.maxWeeklyHours) : Infinity;
  const maxDaily = settings ? Number(settings.maxDailyHours) : Infinity;

  const violations: string[] = [];
  for (const p of parties) {
    const week = await projectedHours(
      p.userId,
      weekWindow(p.takingShift.startTime),
      p.givingShiftId,
      p.takingShift
    );
    if (week > maxWeekly) {
      violations.push(`Would exceed ${maxWeekly}h weekly max for ${p.name}`);
    }
    const day = await projectedHours(
      p.userId,
      dayWindow(p.takingShift.startTime),
      p.givingShiftId,
      p.takingShift
    );
    if (day > maxDaily) {
      violations.push(`Would exceed ${maxDaily}h daily max for ${p.name}`);
    }
  }
  return { passed: violations.length === 0, violations };
};

// ─── Search swappable shifts on a day ────────────────────────────
const searchSwapTargets = async (userId: string, query: SearchSwapTargetsQuery) => {
  const day = startOfUTCDay(new Date(query.date));

  const shifts = await prisma.shift.findMany({
    where: {
      date: day,
      userId: { not: userId },
      status: { in: ["PENDING", "ACCEPTED"] },
      endTime: { gt: new Date() },
      weeklyPlan: { status: "PUBLISHED" },
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      // Exclude shifts already tied up in an open swap.
      swapsAsInitiatorShift: { none: { status: { in: [...OPEN_SWAP_STATUSES] } } },
      swapsAsRecipientShift: { none: { status: { in: [...OPEN_SWAP_STATUSES] } } },
    },
    orderBy: [{ startTime: "asc" }],
    select: {
      ...swapShiftSelect,
      userId: true,
      user: { select: swapUserSelect },
    },
  });

  return { date: day.toISOString().slice(0, 10), shifts };
};

// ─── Create a swap request ───────────────────────────────────────
const createSwap = async (userId: string, data: CreateScheduleSwapInput) => {
  if (data.recipientUserId === userId) {
    throw new AppError("You cannot request a swap with yourself.", 400);
  }

  const [initiatorShift, recipientShift] = await Promise.all([
    prisma.shift.findUnique({
      where: { id: data.initiatorShiftId },
      select: {
        id: true,
        userId: true,
        status: true,
        startTime: true,
        endTime: true,
        weeklyPlan: { select: { status: true } },
        user: { select: swapUserSelect },
      },
    }),
    prisma.shift.findUnique({
      where: { id: data.recipientShiftId },
      select: {
        id: true,
        userId: true,
        status: true,
        startTime: true,
        endTime: true,
        weeklyPlan: { select: { status: true } },
        user: { select: swapUserSelect },
      },
    }),
  ]);

  if (!initiatorShift || initiatorShift.userId !== userId) {
    throw new AppError("Your shift was not found.", 404);
  }
  if (!recipientShift || recipientShift.userId !== data.recipientUserId) {
    throw new AppError("The other employee's shift was not found.", 404);
  }
  for (const [label, shift] of [
    ["your shift", initiatorShift],
    ["the other shift", recipientShift],
  ] as const) {
    if (shift.weeklyPlan.status !== "PUBLISHED") {
      throw new AppError(`The schedule for ${label} is not published.`, 409);
    }
    if (shift.status !== "PENDING" && shift.status !== "ACCEPTED") {
      throw new AppError(`Cannot swap: ${label} is ${shift.status.toLowerCase()}.`, 409);
    }
    if (shift.endTime <= new Date()) {
      throw new AppError(`Cannot swap: ${label} has already ended.`, 409);
    }
  }

  // No duplicate open swap involving either shift.
  const openSwap = await prisma.swapRequest.findFirst({
    where: {
      status: { in: [...OPEN_SWAP_STATUSES] },
      OR: [
        { initiatorShiftId: { in: [initiatorShift.id, recipientShift.id] } },
        { recipientShiftId: { in: [initiatorShift.id, recipientShift.id] } },
      ],
    },
    select: { id: true },
  });
  if (openSwap) {
    throw new AppError("One of these shifts is already part of a pending swap request.", 409);
  }

  // Advisory rule check — stored, never blocking (admin sees it on approval).
  const ruleCheck = await evaluateSwapRules([
    {
      userId,
      name: displayName(initiatorShift.user),
      givingShiftId: initiatorShift.id,
      takingShift: recipientShift,
    },
    {
      userId: data.recipientUserId,
      name: displayName(recipientShift.user),
      givingShiftId: recipientShift.id,
      takingShift: initiatorShift,
    },
  ]);

  const settings = await prisma.orgSettings.findUnique({
    where: { id: 1 },
    select: { swapExpiryHours: true },
  });
  const expiryHours = settings?.swapExpiryHours ?? 72;
  const now = new Date();

  const [swap] = await prisma.$transaction([
    prisma.swapRequest.create({
      data: {
        swapType: "TARGETED",
        initiatorUserId: userId,
        initiatorShiftId: initiatorShift.id,
        recipientUserId: data.recipientUserId,
        recipientShiftId: recipientShift.id,
        status: "PENDING_RECIPIENT",
        ruleCheckResult: ruleCheck,
        ruleCheckPassed: ruleCheck.passed,
        ruleCheckedAt: now,
        expiresAt: new Date(now.getTime() + expiryHours * 60 * 60 * 1000),
      },
      select: scheduleSwapSelect,
    }),
    prisma.notification.create({
      data: {
        userId: data.recipientUserId,
        type: "SWAP_REQUEST_RECEIVED",
        channel: "IN_APP",
        status: "SENT",
        title: "Shift swap request",
        body: `${displayName(initiatorShift.user)} wants to swap shifts with you. Open the Swaps tab to respond.`,
        sentAt: now,
        payload: { kind: "scheduleSwap" },
      },
    }),
  ]);

  return swap;
};

// ─── My swaps ────────────────────────────────────────────────────
const listMySwaps = async (userId: string, query: ListMySwapsQuery) => {
  const { role, status, page, limit } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.SwapRequestWhereInput =
    role === "initiated"
      ? { initiatorUserId: userId }
      : role === "received"
        ? { recipientUserId: userId }
        : { OR: [{ initiatorUserId: userId }, { recipientUserId: userId }] };
  if (status) where.status = status;

  const [swaps, total] = await Promise.all([
    prisma.swapRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: scheduleSwapSelect,
    }),
    prisma.swapRequest.count({ where }),
  ]);

  return {
    swaps,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// ─── Recipient responds ──────────────────────────────────────────
const respondToSwap = async (userId: string, swapId: string, data: RespondSwapInput) => {
  const swap = await prisma.swapRequest.findUnique({
    where: { id: swapId },
    select: {
      id: true,
      status: true,
      initiatorUserId: true,
      recipientUserId: true,
      expiresAt: true,
      recipientUser: { select: swapUserSelect },
    },
  });
  if (!swap || swap.recipientUserId !== userId) {
    throw new AppError("Swap request not found.", 404);
  }
  if (swap.status !== "PENDING_RECIPIENT") {
    throw new AppError("This swap request is no longer awaiting your response.", 409);
  }
  if (swap.expiresAt && swap.expiresAt <= new Date()) {
    await prisma.swapRequest.update({ where: { id: swapId }, data: { status: "EXPIRED" } });
    throw new AppError("This swap request has expired.", 409);
  }

  const now = new Date();
  const accepted = data.action === "ACCEPT";
  const recipientName = swap.recipientUser ? displayName(swap.recipientUser) : "The other employee";

  const [updated] = await prisma.$transaction([
    prisma.swapRequest.update({
      where: { id: swapId },
      data: {
        status: accepted ? "PENDING_ADMIN_APPROVAL" : "REJECTED",
        recipientRespondedAt: now,
        ...(accepted ? {} : { resolvedAt: now }),
      },
      select: scheduleSwapSelect,
    }),
    prisma.notification.create({
      data: {
        userId: swap.initiatorUserId,
        type: accepted ? "SWAP_PENDING_ADMIN_APPROVAL" : "SWAP_REQUEST_RESULT",
        channel: "IN_APP",
        status: "SENT",
        title: accepted ? "Swap accepted — awaiting admin" : "Swap declined",
        body: accepted
          ? `${recipientName} accepted your swap request. It now needs admin approval.`
          : `${recipientName} declined your swap request.`,
        sentAt: now,
        payload: { swapId, kind: "scheduleSwap" },
      },
    }),
  ]);

  return updated;
};

// ─── Initiator cancels ───────────────────────────────────────────
const cancelSwap = async (userId: string, swapId: string) => {
  const swap = await prisma.swapRequest.findUnique({
    where: { id: swapId },
    select: { id: true, status: true, initiatorUserId: true },
  });
  if (!swap || swap.initiatorUserId !== userId) {
    throw new AppError("Swap request not found.", 404);
  }
  if (swap.status !== "PENDING_RECIPIENT") {
    throw new AppError("Only a swap still awaiting the other employee can be cancelled.", 409);
  }

  return prisma.swapRequest.update({
    where: { id: swapId },
    data: { status: "CANCELLED", resolvedAt: new Date() },
    select: scheduleSwapSelect,
  });
};

export const scheduleSwapsServices = {
  searchSwapTargets,
  createSwap,
  listMySwaps,
  respondToSwap,
  cancelSwap,
};

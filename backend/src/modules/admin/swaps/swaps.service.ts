import { prisma } from "../../../config/db";
import { AppError } from "../../../utils/AppError";
import { swapSelect } from "../../user/swaps/swaps.service";
import type { Prisma } from "../../../generated/prisma/client";

const HOURS_PER_MS = 1 / (1000 * 60 * 60);
const durationHours = (s: { startTime: Date; endTime: Date }) =>
  (s.endTime.getTime() - s.startTime.getTime()) * HOURS_PER_MS;

const displayName = (u: { name: string | null; firstName: string | null; lastName: string | null; email: string }) =>
  u.name ?? ([u.firstName, u.lastName].filter(Boolean).join(" ") || u.email);

// Monday-based ISO week bounds (UTC) containing the given date.
const weekBounds = (d: Date) => {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const diffToMonday = (date.getUTCDay() + 6) % 7;
  const start = new Date(date);
  start.setUTCDate(date.getUTCDate() - diffToMonday);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  return { start, end };
};

const dayBounds = (d: Date) => {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 1);
  return { start, end };
};

// Sum a user's admin-approved hours within [start,end), excluding one shift and
// adding a hypothetical incoming shift — i.e. the schedule *after* the swap.
const projectedHours = async (
  userId: string,
  window: { start: Date; end: Date },
  excludeShiftId: string,
  incomingShift: { startTime: Date; endTime: Date },
) => {
  const rows = await prisma.shiftOfferResponse.findMany({
    where: {
      userId,
      approvalStatus: "APPROVED",
      shiftOfferId: { not: excludeShiftId },
      shiftOffer: { startTime: { gte: window.start, lt: window.end } },
    },
    select: { shiftOffer: { select: { startTime: true, endTime: true } } },
  });
  let hours = rows.reduce((sum, r) => sum + durationHours(r.shiftOffer), 0);
  if (incomingShift.startTime >= window.start && incomingShift.startTime < window.end) {
    hours += durationHours(incomingShift);
  }
  return hours;
};

type SwapForRules = {
  initiatorUserId: string;
  initiatorShiftId: string;
  recipientUserId: string;
  recipientShiftId: string;
  initiatorUser: { name: string | null; firstName: string | null; lastName: string | null; email: string };
  recipientUser: { name: string | null; firstName: string | null; lastName: string | null; email: string };
  initiatorShift: { startTime: Date; endTime: Date };
  recipientShift: { startTime: Date; endTime: Date };
};

// Lightweight L-GAV check: after the swap, would either employee exceed the
// configured daily or weekly hour caps? Advisory (the admin may still approve).
const evaluateSwapRules = async (swap: SwapForRules) => {
  const settings = await prisma.orgSettings.findUnique({
    where: { id: 1 },
    select: { maxDailyHours: true, maxWeeklyHours: true },
  });
  const maxWeekly = settings ? Number(settings.maxWeeklyHours) : Infinity;
  const maxDaily = settings ? Number(settings.maxDailyHours) : Infinity;

  const violations: string[] = [];

  // Initiator takes the recipient's shift; recipient takes the initiator's.
  const checks = [
    {
      userId: swap.initiatorUserId,
      name: displayName(swap.initiatorUser),
      giving: swap.initiatorShiftId,
      taking: swap.recipientShift,
    },
    {
      userId: swap.recipientUserId,
      name: displayName(swap.recipientUser),
      giving: swap.recipientShiftId,
      taking: swap.initiatorShift,
    },
  ];

  for (const c of checks) {
    const week = await projectedHours(c.userId, weekBounds(c.taking.startTime), c.giving, c.taking);
    if (week > maxWeekly) {
      violations.push(`Would exceed ${maxWeekly}h weekly max for ${c.name}`);
    }
    const day = await projectedHours(c.userId, dayBounds(c.taking.startTime), c.giving, c.taking);
    if (day > maxDaily) {
      violations.push(`Would exceed ${maxDaily}h daily max for ${c.name}`);
    }
  }

  return { passed: violations.length === 0, violations };
};

// swapSelect already carries the nested user names and shift times the rule
// engine needs; we only additionally need the scalar FK ids. (Spreading a
// second select with the same nested keys would OVERRIDE, not merge, dropping
// jobTitle/category from the payload — so add only the scalar fields here.)
const listSelect = {
  ...swapSelect,
  initiatorUserId: true,
  initiatorShiftId: true,
  recipientUserId: true,
  recipientShiftId: true,
} satisfies Prisma.ShiftSwapRequestSelect;

// ─── List Swaps (with rule check on pending ones) ────────────────
const listSwaps = async (query: {
  page: number;
  limit: number;
  status?: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
}) => {
  const { page, limit, status } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.ShiftSwapRequestWhereInput = {};
  if (status) where.status = status;

  const [swaps, total] = await Promise.all([
    prisma.shiftSwapRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: listSelect,
    }),
    prisma.shiftSwapRequest.count({ where }),
  ]);

  // Rule check only matters for pending decisions.
  const withRules = await Promise.all(
    swaps.map(async (s) => {
      const ruleCheck = s.status === "PENDING" ? await evaluateSwapRules(s) : null;
      // Strip the rule-only fields from the response payload.
      const {
        initiatorUserId: _iu,
        initiatorShiftId: _is,
        recipientUserId: _ru,
        recipientShiftId: _rs,
        ...rest
      } = s;
      return { ...rest, ruleCheck };
    })
  );

  return {
    swaps: withRules,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// ─── Approve Swap (perform exchange + notify) ────────────────────
const approveSwap = async (swapId: string, adminId: string, note?: string) => {
  const swap = await prisma.shiftSwapRequest.findUnique({
    where: { id: swapId },
    select: {
      id: true,
      status: true,
      initiatorUserId: true,
      initiatorShiftId: true,
      recipientUserId: true,
      recipientShiftId: true,
      initiatorShift: { select: { jobTitle: true } },
      recipientShift: { select: { jobTitle: true } },
    },
  });
  if (!swap) throw new AppError("Swap request not found.", 404);
  if (swap.status !== "PENDING") {
    throw new AppError("Only pending swaps can be approved.", 409);
  }

  // Re-verify both employees still hold their confirmed shifts (state can drift).
  const [initiatorOk, recipientOk] = await Promise.all([
    prisma.shiftOfferResponse.findFirst({
      where: {
        userId: swap.initiatorUserId,
        shiftOfferId: swap.initiatorShiftId,
        approvalStatus: "APPROVED",
      },
      select: { id: true },
    }),
    prisma.shiftOfferResponse.findFirst({
      where: {
        userId: swap.recipientUserId,
        shiftOfferId: swap.recipientShiftId,
        approvalStatus: "APPROVED",
      },
      select: { id: true },
    }),
  ]);
  if (!initiatorOk || !recipientOk) {
    throw new AppError(
      "One of the shifts is no longer confirmed for its employee; this swap can no longer be applied.",
      409
    );
  }

  const now = new Date();
  const bodyInitiator = `Your shift "${swap.initiatorShift.jobTitle}" was swapped for "${swap.recipientShift.jobTitle}".`;
  const bodyRecipient = `Your shift "${swap.recipientShift.jobTitle}" was swapped for "${swap.initiatorShift.jobTitle}".`;

  const [, , , , updated] = await prisma.$transaction([
    // Clear any responses by either employee on either shift to free the
    // @@unique([shiftOfferId, userId]) slots before re-creating the swapped ones.
    prisma.shiftOfferResponse.deleteMany({
      where: {
        OR: [
          { shiftOfferId: swap.initiatorShiftId, userId: { in: [swap.initiatorUserId, swap.recipientUserId] } },
          { shiftOfferId: swap.recipientShiftId, userId: { in: [swap.initiatorUserId, swap.recipientUserId] } },
        ],
      },
    }),
    // Initiator now confirmed on the recipient's shift.
    prisma.shiftOfferResponse.create({
      data: {
        shiftOfferId: swap.recipientShiftId,
        userId: swap.initiatorUserId,
        status: "ACCEPTED",
        approvalStatus: "APPROVED",
        approvedById: adminId,
        approvedAt: now,
      },
    }),
    // Recipient now confirmed on the initiator's shift.
    prisma.shiftOfferResponse.create({
      data: {
        shiftOfferId: swap.initiatorShiftId,
        userId: swap.recipientUserId,
        status: "ACCEPTED",
        approvalStatus: "APPROVED",
        approvedById: adminId,
        approvedAt: now,
      },
    }),
    prisma.notification.createMany({
      data: [
        {
          userId: swap.initiatorUserId,
          type: "SWAP_REQUEST_RESULT",
          channel: "IN_APP",
          status: "SENT",
          title: "Swap approved",
          body: bodyInitiator,
          sentAt: now,
          payload: { swapId, result: "APPROVED" },
        },
        {
          userId: swap.recipientUserId,
          type: "SWAP_REQUEST_RESULT",
          channel: "IN_APP",
          status: "SENT",
          title: "Swap approved",
          body: bodyRecipient,
          sentAt: now,
          payload: { swapId, result: "APPROVED" },
        },
      ],
    }),
    prisma.shiftSwapRequest.update({
      where: { id: swapId },
      data: {
        status: "APPROVED",
        reviewedById: adminId,
        reviewedAt: now,
        ...(note !== undefined ? { adminNote: note } : {}),
      },
      select: swapSelect,
    }),
  ]);

  return updated;
};

// ─── Reject Swap ─────────────────────────────────────────────────
const rejectSwap = async (swapId: string, adminId: string, note?: string) => {
  const swap = await prisma.shiftSwapRequest.findUnique({
    where: { id: swapId },
    select: { id: true, status: true, initiatorUserId: true, recipientUserId: true },
  });
  if (!swap) throw new AppError("Swap request not found.", 404);
  if (swap.status !== "PENDING") {
    throw new AppError("Only pending swaps can be rejected.", 409);
  }

  const now = new Date();
  const [, updated] = await prisma.$transaction([
    prisma.notification.createMany({
      data: [swap.initiatorUserId, swap.recipientUserId].map((userId) => ({
        userId,
        type: "SWAP_REQUEST_RESULT" as const,
        channel: "IN_APP" as const,
        status: "SENT" as const,
        title: "Swap rejected",
        body: "Your shift swap request was not approved.",
        sentAt: now,
        payload: { swapId, result: "REJECTED" },
      })),
    }),
    prisma.shiftSwapRequest.update({
      where: { id: swapId },
      data: {
        status: "REJECTED",
        reviewedById: adminId,
        reviewedAt: now,
        ...(note !== undefined ? { adminNote: note } : {}),
      },
      select: swapSelect,
    }),
  ]);

  return updated;
};

export const adminSwapServices = {
  listSwaps,
  approveSwap,
  rejectSwap,
};

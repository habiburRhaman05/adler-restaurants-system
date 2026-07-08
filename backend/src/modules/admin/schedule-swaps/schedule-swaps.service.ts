import { prisma } from "../../../config/db";
import { AppError } from "../../../utils/AppError";
import { scheduleSwapSelect } from "../../user/schedule-swaps/schedule-swaps.service";
import type {
  ListScheduleSwapsQuery,
  ReviewScheduleSwapInput,
} from "./schedule-swaps.validation";
import type { Prisma } from "../../../generated/prisma/client";

// ─── Approval queue ──────────────────────────────────────────────
const listSwaps = async (query: ListScheduleSwapsQuery) => {
  const { page, limit, status } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.SwapRequestWhereInput = {};
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

const getSwapForReview = async (swapId: string) => {
  const swap = await prisma.swapRequest.findUnique({
    where: { id: swapId },
    select: {
      id: true,
      status: true,
      initiatorUserId: true,
      initiatorShiftId: true,
      recipientUserId: true,
      recipientShiftId: true,
    },
  });
  if (!swap) throw new AppError("Swap request not found.", 404);
  if (swap.status !== "PENDING_ADMIN_APPROVAL") {
    throw new AppError("Only a swap awaiting admin approval can be reviewed.", 409);
  }
  if (!swap.recipientUserId || !swap.recipientShiftId) {
    throw new AppError("This swap request has no recipient shift.", 409);
  }
  return swap as typeof swap & { recipientUserId: string; recipientShiftId: string };
};

// ─── Approve: exchange the two shifts' owners in one transaction ─
const approveSwap = async (swapId: string, adminId: string, data: ReviewScheduleSwapInput) => {
  const swap = await getSwapForReview(swapId);

  // Re-verify both shifts still belong to the stated users and are usable
  // (state can drift between recipient acceptance and admin review).
  const [initiatorShift, recipientShift] = await Promise.all([
    prisma.shift.findUnique({
      where: { id: swap.initiatorShiftId },
      select: { id: true, userId: true, status: true, endTime: true },
    }),
    prisma.shift.findUnique({
      where: { id: swap.recipientShiftId },
      select: { id: true, userId: true, status: true, endTime: true },
    }),
  ]);
  const usable = (s: { userId: string; status: string; endTime: Date } | null, owner: string) =>
    s !== null &&
    s.userId === owner &&
    (s.status === "PENDING" || s.status === "ACCEPTED") &&
    s.endTime > new Date();
  if (
    !usable(initiatorShift, swap.initiatorUserId) ||
    !usable(recipientShift, swap.recipientUserId)
  ) {
    throw new AppError(
      "One of the shifts has changed since this swap was requested; it can no longer be applied.",
      409
    );
  }

  const now = new Date();
  const [, , , updated] = await prisma.$transaction([
    // The actual exchange — this is where the main plan changes.
    prisma.shift.update({
      where: { id: swap.initiatorShiftId },
      data: { userId: swap.recipientUserId, status: "ACCEPTED" },
    }),
    prisma.shift.update({
      where: { id: swap.recipientShiftId },
      data: { userId: swap.initiatorUserId, status: "ACCEPTED" },
    }),
    prisma.notification.createMany({
      data: [swap.initiatorUserId, swap.recipientUserId].map((userId) => ({
        userId,
        type: "SWAP_REQUEST_RESULT" as const,
        channel: "IN_APP" as const,
        status: "SENT" as const,
        title: "Swap approved",
        body: "Your shift swap has been approved by the admin. Check your updated schedule.",
        sentAt: now,
        payload: { swapId, result: "APPROVED" },
      })),
    }),
    prisma.swapRequest.update({
      where: { id: swapId },
      data: {
        status: "APPROVED",
        approvedById: adminId,
        resolvedAt: now,
        ...(data.reason !== undefined ? { adminReason: data.reason } : {}),
      },
      select: scheduleSwapSelect,
    }),
  ]);

  return updated;
};

// ─── Reject ──────────────────────────────────────────────────────
const rejectSwap = async (swapId: string, adminId: string, data: ReviewScheduleSwapInput) => {
  const swap = await getSwapForReview(swapId);
  const now = new Date();

  const [, updated] = await prisma.$transaction([
    prisma.notification.createMany({
      data: [swap.initiatorUserId, swap.recipientUserId].map((userId) => ({
        userId,
        type: "SWAP_REQUEST_RESULT" as const,
        channel: "IN_APP" as const,
        status: "SENT" as const,
        title: "Swap rejected",
        body: "Your shift swap request was not approved by the admin.",
        sentAt: now,
        payload: { swapId, result: "REJECTED" },
      })),
    }),
    prisma.swapRequest.update({
      where: { id: swapId },
      data: {
        status: "REJECTED",
        approvedById: adminId,
        resolvedAt: now,
        ...(data.reason !== undefined ? { adminReason: data.reason } : {}),
      },
      select: scheduleSwapSelect,
    }),
  ]);

  return updated;
};

export const adminScheduleSwapsServices = {
  listSwaps,
  approveSwap,
  rejectSwap,
};

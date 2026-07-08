import { prisma } from "../../../config/db";
import { AppError } from "../../../utils/AppError";
import type { CreateSwapInput } from "./swaps.validation";
import type { Prisma } from "../../../generated/prisma/client";

// Shared projection for a swap request (also used by the admin module).
export const swapSelect = {
  id: true,
  status: true,
  reason: true,
  adminNote: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  initiatorUser: { select: { id: true, name: true, firstName: true, lastName: true, email: true } },
  recipientUser: { select: { id: true, name: true, firstName: true, lastName: true, email: true } },
  initiatorShift: {
    select: {
      id: true,
      jobTitle: true,
      startTime: true,
      endTime: true,
      category: { select: { id: true, name: true } },
    },
  },
  recipientShift: {
    select: {
      id: true,
      jobTitle: true,
      startTime: true,
      endTime: true,
      category: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.ShiftSwapRequestSelect;

// A "confirmed shift" is a ShiftOffer the given user is admin-APPROVED for.
const assertConfirmedShift = async (userId: string, shiftId: string, label: string) => {
  const response = await prisma.shiftOfferResponse.findFirst({
    where: { userId, shiftOfferId: shiftId, approvalStatus: "APPROVED" },
    select: { id: true, shiftOffer: { select: { endTime: true } } },
  });
  if (!response) {
    throw new AppError(`${label} is not a confirmed shift for that employee.`, 409);
  }
  if (response.shiftOffer.endTime.getTime() < Date.now()) {
    throw new AppError(`${label} has already ended.`, 409);
  }
};

// ─── Create Swap Request ─────────────────────────────────────────
const createSwap = async (initiatorUserId: string, data: CreateSwapInput) => {
  if (data.recipientUserId === initiatorUserId) {
    throw new AppError("You cannot swap a shift with yourself.", 400);
  }

  const recipient = await prisma.user.findUnique({
    where: { id: data.recipientUserId },
    select: { id: true, isActive: true },
  });
  if (!recipient) {
    throw new AppError("Recipient employee not found.", 404);
  }

  // Both sides must currently hold their confirmed shifts.
  await assertConfirmedShift(initiatorUserId, data.initiatorShiftId, "Your shift");
  await assertConfirmedShift(data.recipientUserId, data.recipientShiftId, "The recipient's shift");

  // Prevent duplicate pending requests for the same pair of shifts.
  const duplicate = await prisma.shiftSwapRequest.findFirst({
    where: {
      status: "PENDING",
      initiatorShiftId: data.initiatorShiftId,
      recipientShiftId: data.recipientShiftId,
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new AppError("A pending swap already exists for these shifts.", 409);
  }

  const createData: Prisma.ShiftSwapRequestCreateInput = {
    initiatorUser: { connect: { id: initiatorUserId } },
    initiatorShift: { connect: { id: data.initiatorShiftId } },
    recipientUser: { connect: { id: data.recipientUserId } },
    recipientShift: { connect: { id: data.recipientShiftId } },
  };
  if (data.reason !== undefined) createData.reason = data.reason;

  const swap = await prisma.shiftSwapRequest.create({
    data: createData,
    select: swapSelect,
  });

  // Let the colleague know they're part of a swap awaiting admin approval.
  await prisma.notification.create({
    data: {
      userId: data.recipientUserId,
      type: "SWAP_REQUEST_RECEIVED",
      channel: "IN_APP",
      status: "SENT",
      title: "Shift swap requested",
      body: `A colleague requested to swap shifts with you (pending admin approval).`,
      sentAt: new Date(),
      payload: { swapId: swap.id },
    },
  });

  return swap;
};

// ─── List My Swaps ───────────────────────────────────────────────
const listMySwaps = async (
  userId: string,
  query: {
    page: number;
    limit: number;
    status?: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
    role?: "initiated" | "received";
  }
) => {
  const { page, limit, status, role } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.ShiftSwapRequestWhereInput = {};
  if (status) where.status = status;
  if (role === "initiated") where.initiatorUserId = userId;
  else if (role === "received") where.recipientUserId = userId;
  else where.OR = [{ initiatorUserId: userId }, { recipientUserId: userId }];

  const [swaps, total] = await Promise.all([
    prisma.shiftSwapRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: swapSelect,
    }),
    prisma.shiftSwapRequest.count({ where }),
  ]);

  return {
    swaps,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// ─── Cancel My Swap ──────────────────────────────────────────────
const cancelSwap = async (userId: string, swapId: string) => {
  const swap = await prisma.shiftSwapRequest.findUnique({
    where: { id: swapId },
    select: { id: true, initiatorUserId: true, status: true },
  });
  if (!swap) {
    throw new AppError("Swap request not found.", 404);
  }
  if (swap.initiatorUserId !== userId) {
    throw new AppError("Only the employee who created the swap can cancel it.", 403);
  }
  if (swap.status !== "PENDING") {
    throw new AppError("Only pending swaps can be cancelled.", 409);
  }

  return prisma.shiftSwapRequest.update({
    where: { id: swapId },
    data: { status: "CANCELLED" },
    select: swapSelect,
  });
};

export const userSwapServices = {
  createSwap,
  listMySwaps,
  cancelSwap,
};

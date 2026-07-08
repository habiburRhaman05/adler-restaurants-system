import { prisma } from "../../../config/db";
import { AppError } from "../../../utils/AppError";
import type { RespondToShiftInput } from "./shifts.validation";
import type { Prisma } from "../../../generated/prisma/client";

// Only shifts that have been published (notified) are ever exposed to staff —
// drafts stay internal to management.
const buildShiftSelect = (userId: string) =>
  ({
    id: true,
    jobTitle: true,
    categoryId: true,
    startTime: true,
    endTime: true,
    hourlyPrice: true,
    description: true,
    notifiedAt: true,
    createdAt: true,
    category: { select: { id: true, name: true } },
    responses: {
      where: { userId },
      select: { status: true, approvalStatus: true, respondedAt: true, approvedAt: true },
    },
    // Confirmed (admin-approved) workers on this shift.
    _count: { select: { responses: { where: { approvalStatus: "APPROVED" } } } },
  }) satisfies Prisma.ShiftOfferSelect;

const shapeShift = <
  T extends {
    responses: {
      status: string;
      approvalStatus: string;
      respondedAt: Date;
      approvedAt: Date | null;
    }[];
    _count: { responses: number };
  }
>(
  shift: T
) => {
  const { responses, _count, ...rest } = shift;
  const myResponse = responses[0] ?? null;
  return {
    ...rest,
    myResponse,
    // Number of workers confirmed by the admin for this shift.
    confirmedCount: _count.responses,
  };
};

// ─── List Available Shifts ───────────────────────────────────────
const listAvailableShifts = async (
  userId: string,
  query: {
    page: number;
    limit: number;
    categoryId?: string;
    mine?: "accepted" | "rejected" | "pending";
    upcoming?: boolean;
  }
) => {
  const { page, limit, categoryId, mine, upcoming } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.ShiftOfferWhereInput = { notifiedAt: { not: null } };
  if (categoryId) where.categoryId = categoryId;
  if (upcoming) where.endTime = { gte: new Date() };
  if (mine === "accepted") where.responses = { some: { userId, status: "ACCEPTED" } };
  if (mine === "rejected") where.responses = { some: { userId, status: "REJECTED" } };
  if (mine === "pending") where.responses = { none: { userId } };

  const [shifts, total] = await Promise.all([
    prisma.shiftOffer.findMany({
      where,
      skip,
      take: limit,
      orderBy: { startTime: "asc" },
      select: buildShiftSelect(userId),
    }),
    prisma.shiftOffer.count({ where }),
  ]);

  return {
    shifts: shifts.map(shapeShift),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// ─── Get Single Shift ────────────────────────────────────────────
const getShiftForUser = async (userId: string, shiftId: string) => {
  const shift = await prisma.shiftOffer.findFirst({
    where: { id: shiftId, notifiedAt: { not: null } },
    select: buildShiftSelect(userId),
  });
  if (!shift) {
    throw new AppError("Shift not found.", 404);
  }
  return shapeShift(shift);
};

// ─── Respond to Shift (accept / reject) ──────────────────────────
const respondToShift = async (
  userId: string,
  shiftId: string,
  data: RespondToShiftInput
) => {
  const shift = await prisma.shiftOffer.findFirst({
    where: { id: shiftId, notifiedAt: { not: null } },
    select: { id: true, endTime: true },
  });
  if (!shift) {
    throw new AppError("Shift not found.", 404);
  }

  if (shift.endTime.getTime() < Date.now()) {
    throw new AppError("This shift has already ended.", 409);
  }

  // A staff member can change their mind up to the shift end, so we upsert.
  const response = await prisma.shiftOfferResponse.upsert({
    where: { shiftOfferId_userId: { shiftOfferId: shiftId, userId } },
    create: { shiftOfferId: shiftId, userId, status: data.status },
    update: { status: data.status, respondedAt: new Date() },
    select: {
      id: true,
      shiftOfferId: true,
      status: true,
      respondedAt: true,
    },
  });

  return response;
};

export const userShiftServices = {
  listAvailableShifts,
  getShiftForUser,
  respondToShift,
};

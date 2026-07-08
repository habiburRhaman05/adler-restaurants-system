import { prisma } from "../../../config/db";
import { AppError } from "../../../utils/AppError";
import type { CreateShiftInput, UpdateShiftInput } from "./shifts.validation";
import type { Prisma } from "../../../generated/prisma/client";

const shiftSelect = {
  id: true,
  jobTitle: true,
  categoryId: true,
  startTime: true,
  endTime: true,
  hourlyPrice: true,
  description: true,
  notifiedAt: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true } },
} satisfies Prisma.ShiftOfferSelect;

// Roll a set of responses up into the counts the admin UI needs. A staff
// ACCEPT is a volunteer offer; only an admin-APPROVED acceptance counts as an
// available/confirmed worker.
const summarizeResponses = (
  responses: { status: string; approvalStatus: string }[]
) => {
  const accepted = responses.filter((r) => r.status === "ACCEPTED");
  return {
    acceptedCount: accepted.length,
    approvedCount: accepted.filter((r) => r.approvalStatus === "APPROVED").length,
    pendingApprovalCount: accepted.filter((r) => r.approvalStatus === "PENDING").length,
    rejectedByAdminCount: accepted.filter((r) => r.approvalStatus === "REJECTED").length,
    declinedCount: responses.filter((r) => r.status === "REJECTED").length,
  };
};

const ensureCategoryUsable = async (categoryId: string) => {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, isActive: true },
  });
  if (!category) {
    throw new AppError("Selected category does not exist.", 404);
  }
  if (!category.isActive) {
    throw new AppError("Selected category is inactive.", 409);
  }
};

// ─── Create Shift ────────────────────────────────────────────────
const createShift = async (data: CreateShiftInput, adminId: string) => {
  await ensureCategoryUsable(data.categoryId);

  const createData: Prisma.ShiftOfferCreateInput = {
    jobTitle: data.jobTitle,
    startTime: new Date(data.startTime),
    endTime: new Date(data.endTime),
    hourlyPrice: data.hourlyPrice,
    category: { connect: { id: data.categoryId } },
    createdBy: { connect: { id: adminId } },
  };
  if (data.description !== undefined) createData.description = data.description;

  return prisma.shiftOffer.create({ data: createData, select: shiftSelect });
};

// ─── Update Shift ────────────────────────────────────────────────
const updateShift = async (shiftId: string, data: UpdateShiftInput) => {
  const existing = await prisma.shiftOffer.findUnique({ where: { id: shiftId } });
  if (!existing) {
    throw new AppError("Shift not found.", 404);
  }

  if (data.categoryId) {
    await ensureCategoryUsable(data.categoryId);
  }

  // Cross-field guard when only one bound is being changed.
  const nextStart = data.startTime ? new Date(data.startTime) : existing.startTime;
  const nextEnd = data.endTime ? new Date(data.endTime) : existing.endTime;
  if (nextEnd <= nextStart) {
    throw new AppError("endTime must be after startTime.", 400);
  }

  const updateData: Prisma.ShiftOfferUpdateInput = {};
  if (data.jobTitle !== undefined) updateData.jobTitle = data.jobTitle;
  if (data.categoryId !== undefined) updateData.category = { connect: { id: data.categoryId } };
  if (data.startTime !== undefined) updateData.startTime = new Date(data.startTime);
  if (data.endTime !== undefined) updateData.endTime = new Date(data.endTime);
  if (data.hourlyPrice !== undefined) updateData.hourlyPrice = data.hourlyPrice;
  if (data.description !== undefined) updateData.description = data.description;

  return prisma.shiftOffer.update({
    where: { id: shiftId },
    data: updateData,
    select: shiftSelect,
  });
};

// ─── Delete Shift ────────────────────────────────────────────────
const deleteShift = async (shiftId: string) => {
  const existing = await prisma.shiftOffer.findUnique({ where: { id: shiftId } });
  if (!existing) {
    throw new AppError("Shift not found.", 404);
  }
  // Responses cascade-delete with the shift (onDelete: Cascade).
  await prisma.shiftOffer.delete({ where: { id: shiftId } });
};

// ─── Notify Employees ────────────────────────────────────────────
// Fans out an in-app notification to every active staff member and stamps
// the shift as notified. Returns how many recipients were notified.
const notifyShift = async (shiftId: string) => {
  const shift = await prisma.shiftOffer.findUnique({
    where: { id: shiftId },
    select: shiftSelect,
  });
  if (!shift) {
    throw new AppError("Shift not found.", 404);
  }

  const recipients = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  if (recipients.length === 0) {
    throw new AppError("There are no active employees to notify.", 409);
  }

  const now = new Date();
  const title = "New shift available";
  const body = `${shift.jobTitle} (${shift.category.name}) — tap to view and accept.`;

  const [, updatedShift] = await prisma.$transaction([
    prisma.notification.createMany({
      data: recipients.map((u) => ({
        userId: u.id,
        type: "SHIFT_OFFER_PUBLISHED" as const,
        channel: "IN_APP" as const,
        status: "SENT" as const,
        title,
        body,
        sentAt: now,
        payload: {
          shiftOfferId: shift.id,
          jobTitle: shift.jobTitle,
          categoryId: shift.categoryId,
          categoryName: shift.category.name,
          startTime: shift.startTime.toISOString(),
          endTime: shift.endTime.toISOString(),
          hourlyPrice: shift.hourlyPrice.toString(),
        },
      })),
    }),
    prisma.shiftOffer.update({
      where: { id: shiftId },
      data: { notifiedAt: now },
      select: shiftSelect,
    }),
  ]);

  return { shift: updatedShift, notifiedCount: recipients.length };
};

// ─── List Shifts (admin) ─────────────────────────────────────────
const getAllShifts = async (query: {
  page: number;
  limit: number;
  categoryId?: string;
  notified?: boolean;
  upcoming?: boolean;
}) => {
  const { page, limit, categoryId, notified, upcoming } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.ShiftOfferWhereInput = {};
  if (categoryId) where.categoryId = categoryId;
  if (notified !== undefined) where.notifiedAt = notified ? { not: null } : null;
  if (upcoming) where.endTime = { gte: new Date() };

  const [shifts, total] = await Promise.all([
    prisma.shiftOffer.findMany({
      where,
      skip,
      take: limit,
      orderBy: { startTime: "desc" },
      select: {
        ...shiftSelect,
        responses: { select: { status: true, approvalStatus: true } },
      },
    }),
    prisma.shiftOffer.count({ where }),
  ]);

  const data = shifts.map(({ responses, ...shift }) => ({
    ...shift,
    ...summarizeResponses(responses),
  }));

  return {
    shifts: data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// ─── Get Shift By ID ─────────────────────────────────────────────
const getShiftById = async (shiftId: string) => {
  const shift = await prisma.shiftOffer.findUnique({
    where: { id: shiftId },
    select: {
      ...shiftSelect,
      responses: { select: { status: true, approvalStatus: true } },
    },
  });
  if (!shift) {
    throw new AppError("Shift not found.", 404);
  }
  const { responses, ...rest } = shift;
  return { ...rest, ...summarizeResponses(responses) };
};

// Response projection used everywhere the admin needs to see who responded.
const responseSelect = {
  id: true,
  status: true,
  approvalStatus: true,
  respondedAt: true,
  approvedAt: true,
  approvalNote: true,
  user: {
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      department: true,
      designation: true,
      employeeType: true,
    },
  },
} satisfies Prisma.ShiftOfferResponseSelect;

// ─── Get Shift Responses (who accepted, availability count) ──────
const getShiftResponses = async (shiftId: string) => {
  const shift = await prisma.shiftOffer.findUnique({
    where: { id: shiftId },
    select: shiftSelect,
  });
  if (!shift) {
    throw new AppError("Shift not found.", 404);
  }

  const responses = await prisma.shiftOfferResponse.findMany({
    where: { shiftOfferId: shiftId },
    orderBy: { respondedAt: "asc" },
    select: responseSelect,
  });

  const accepted = responses.filter((r) => r.status === "ACCEPTED");
  const rejected = responses.filter((r) => r.status === "REJECTED");
  const summary = summarizeResponses(responses);

  return {
    shift,
    // Everyone who volunteered, with their per-response approval state.
    accepted,
    // Employees who declined the offer.
    declined: rejected,
    counts: {
      ...summary,
      total: responses.length,
      // "How many workers are available for this shift" = admin-approved count.
      available: summary.approvedCount,
    },
  };
};

// ─── Approve / Reject an acceptance ──────────────────────────────
const loadResponseForApproval = async (shiftId: string, responseId: string) => {
  const response = await prisma.shiftOfferResponse.findFirst({
    where: { id: responseId, shiftOfferId: shiftId },
    select: {
      id: true,
      status: true,
      approvalStatus: true,
      userId: true,
      shiftOffer: { select: { jobTitle: true, startTime: true } },
    },
  });
  if (!response) {
    throw new AppError("Shift response not found.", 404);
  }
  if (response.status !== "ACCEPTED") {
    throw new AppError("Only accepted shifts can be approved or rejected.", 409);
  }
  return response;
};

const approveResponse = async (shiftId: string, responseId: string, adminId: string) => {
  const response = await loadResponseForApproval(shiftId, responseId);

  const now = new Date();
  const [updated] = await prisma.$transaction([
    prisma.shiftOfferResponse.update({
      where: { id: responseId },
      data: {
        approvalStatus: "APPROVED",
        approvedById: adminId,
        approvedAt: now,
        approvalNote: null,
      },
      select: responseSelect,
    }),
    // Let the employee know their shift is confirmed (updates their app status).
    prisma.notification.create({
      data: {
        userId: response.userId,
        type: "SHIFT_CHANGED",
        channel: "IN_APP",
        status: "SENT",
        title: "Shift confirmed",
        body: `You are confirmed for "${response.shiftOffer.jobTitle}".`,
        sentAt: now,
        payload: { shiftOfferId: shiftId, approvalStatus: "APPROVED" },
      },
    }),
  ]);

  return updated;
};

const rejectResponse = async (
  shiftId: string,
  responseId: string,
  adminId: string,
  note?: string
) => {
  const response = await loadResponseForApproval(shiftId, responseId);

  const now = new Date();
  const [updated] = await prisma.$transaction([
    prisma.shiftOfferResponse.update({
      where: { id: responseId },
      data: {
        approvalStatus: "REJECTED",
        approvedById: adminId,
        approvedAt: now,
        ...(note !== undefined ? { approvalNote: note } : {}),
      },
      select: responseSelect,
    }),
    prisma.notification.create({
      data: {
        userId: response.userId,
        type: "SHIFT_CHANGED",
        channel: "IN_APP",
        status: "SENT",
        title: "Shift not assigned",
        body: `You were not assigned to "${response.shiftOffer.jobTitle}".`,
        sentAt: now,
        payload: { shiftOfferId: shiftId, approvalStatus: "REJECTED" },
      },
    }),
  ]);

  return updated;
};

// ─── Shift Approvals feed ────────────────────────────────────────
// Published shifts that have volunteers, surfaced for the admin to approve.
const getShiftsForApproval = async (query: {
  page: number;
  limit: number;
  pendingOnly?: boolean;
}) => {
  const { page, limit, pendingOnly } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.ShiftOfferWhereInput = {
    notifiedAt: { not: null },
    responses: pendingOnly
      ? { some: { status: "ACCEPTED", approvalStatus: "PENDING" } }
      : { some: { status: "ACCEPTED" } },
  };

  const [shifts, total] = await Promise.all([
    prisma.shiftOffer.findMany({
      where,
      skip,
      take: limit,
      orderBy: { startTime: "asc" },
      select: {
        ...shiftSelect,
        responses: {
          where: { status: "ACCEPTED" },
          orderBy: { respondedAt: "asc" },
          select: responseSelect,
        },
      },
    }),
    prisma.shiftOffer.count({ where }),
  ]);

  const data = shifts.map(({ responses, ...shift }) => ({
    ...shift,
    volunteers: responses,
    ...summarizeResponses(responses),
    available: responses.filter((r) => r.approvalStatus === "APPROVED").length,
  }));

  return {
    shifts: data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const shiftServices = {
  createShift,
  updateShift,
  deleteShift,
  notifyShift,
  getAllShifts,
  getShiftById,
  getShiftResponses,
  approveResponse,
  rejectResponse,
  getShiftsForApproval,
};

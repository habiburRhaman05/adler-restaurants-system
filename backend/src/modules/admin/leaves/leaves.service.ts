import { prisma } from "../../../config/db";
import { AppError } from "../../../utils/AppError";
import type { ListLeavesQuery, ReviewLeaveInput } from "./leaves.validation";
import type { Prisma } from "../../../generated/prisma/client";

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
};

const adminLeaveSelect = {
  id: true,
  userId: true,
  user: {
    select: { id: true, name: true, firstName: true, lastName: true, email: true },
  },
  leaveType: true,
  startDate: true,
  endDate: true,
  reason: true,
  status: true,
  adminNote: true,
  reviewedById: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.LeaveRequestSelect;

// ─── List (approval queue) ───────────────────────────────────────
const listLeaves = async (query: ListLeavesQuery) => {
  const { page, limit, status, userId } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.LeaveRequestWhereInput = {};
  if (status) where.status = status;
  if (userId) where.userId = userId;

  const [leaves, total] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: adminLeaveSelect,
    }),
    prisma.leaveRequest.count({ where }),
  ]);

  // How many roster shifts an approval would cancel (surfaced in the dialog).
  const withImpact = await Promise.all(
    leaves.map(async (leave) => {
      if (leave.status !== "PENDING") return { ...leave, affectedShiftCount: 0 };
      const affectedShiftCount = await prisma.shift.count({
        where: {
          userId: leave.userId,
          date: { gte: leave.startDate, lt: addDays(leave.endDate, 1) },
          status: { notIn: ["CANCELLED", "REJECTED"] },
        },
      });
      return { ...leave, affectedShiftCount };
    })
  );

  return {
    leaves: withImpact,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

const getPendingLeaveOr404 = async (leaveId: string) => {
  const leave = await prisma.leaveRequest.findUnique({
    where: { id: leaveId },
    select: {
      id: true,
      userId: true,
      status: true,
      startDate: true,
      endDate: true,
      leaveType: true,
    },
  });
  if (!leave) throw new AppError("Leave request not found.", 404);
  if (leave.status !== "PENDING") {
    throw new AppError("Only a pending leave request can be reviewed.", 409);
  }
  return leave;
};

// ─── Approve: cancel overlapping roster shifts in the same transaction ─
// Applies to draft AND published plans alike; the shift cancellation itself is
// a silent data update (no extra notification) — only the leave-result
// notification is sent.
const approveLeave = async (leaveId: string, adminId: string, data: ReviewLeaveInput) => {
  const leave = await getPendingLeaveOr404(leaveId);
  const now = new Date();

  const [updated, cancelled] = await prisma.$transaction([
    prisma.leaveRequest.update({
      where: { id: leaveId },
      data: {
        status: "APPROVED",
        reviewedById: adminId,
        reviewedAt: now,
        ...(data.adminNote !== undefined ? { adminNote: data.adminNote } : {}),
      },
      select: adminLeaveSelect,
    }),
    prisma.shift.updateMany({
      where: {
        userId: leave.userId,
        date: { gte: leave.startDate, lt: addDays(leave.endDate, 1) },
        status: { notIn: ["CANCELLED", "REJECTED"] },
      },
      data: {
        status: "CANCELLED",
        rejectionReason: "Employee on approved leave",
        leaveRequestId: leaveId,
      },
    }),
    prisma.notification.create({
      data: {
        userId: leave.userId,
        type: "LEAVE_REQUEST_RESULT",
        channel: "IN_APP",
        status: "SENT",
        title: "Leave approved",
        body: `Your ${leave.leaveType.toLowerCase()} leave from ${leave.startDate
          .toISOString()
          .slice(0, 10)} to ${leave.endDate.toISOString().slice(0, 10)} has been approved.`,
        sentAt: now,
        payload: { leaveId },
      },
    }),
  ]);

  return { leave: updated, cancelledShiftCount: cancelled.count };
};

// ─── Reject ──────────────────────────────────────────────────────
const rejectLeave = async (leaveId: string, adminId: string, data: ReviewLeaveInput) => {
  const leave = await getPendingLeaveOr404(leaveId);
  const now = new Date();

  const [updated] = await prisma.$transaction([
    prisma.leaveRequest.update({
      where: { id: leaveId },
      data: {
        status: "REJECTED",
        reviewedById: adminId,
        reviewedAt: now,
        ...(data.adminNote !== undefined ? { adminNote: data.adminNote } : {}),
      },
      select: adminLeaveSelect,
    }),
    prisma.notification.create({
      data: {
        userId: leave.userId,
        type: "LEAVE_REQUEST_RESULT",
        channel: "IN_APP",
        status: "SENT",
        title: "Leave rejected",
        body: `Your ${leave.leaveType.toLowerCase()} leave request was not approved.${
          data.adminNote ? ` Note: ${data.adminNote}` : ""
        }`,
        sentAt: now,
        payload: { leaveId },
      },
    }),
  ]);

  return { leave: updated };
};

export const adminLeavesServices = {
  listLeaves,
  approveLeave,
  rejectLeave,
};

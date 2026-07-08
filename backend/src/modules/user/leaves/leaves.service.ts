import { prisma } from "../../../config/db";
import { AppError } from "../../../utils/AppError";
import { sendEmail } from "../../../utils/mail/mailer";
import type { CreateLeaveInput, MyLeavesQuery } from "./leaves.validation";
import type { Prisma } from "../../../generated/prisma/client";

const startOfUTCDay = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

export const leaveSelect = {
  id: true,
  userId: true,
  leaveType: true,
  startDate: true,
  endDate: true,
  reason: true,
  status: true,
  adminNote: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.LeaveRequestSelect;

const displayName = (u: {
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
}) => u.name ?? ([u.firstName, u.lastName].filter(Boolean).join(" ") || u.email);

// ─── Create a leave request (in-app record + real email to admins) ─
const createLeave = async (userId: string, data: CreateLeaveInput) => {
  const startDate = startOfUTCDay(new Date(data.startDate));
  const endDate = startOfUTCDay(new Date(data.endDate));

  const today = startOfUTCDay(new Date());
  if (endDate < today) {
    throw new AppError("Leave cannot end in the past.", 400);
  }

  // No second request overlapping a still-open (pending/approved) one.
  const overlapping = await prisma.leaveRequest.findFirst({
    where: {
      userId,
      status: { in: ["PENDING", "APPROVED"] },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    select: { id: true, status: true },
  });
  if (overlapping) {
    throw new AppError(
      `You already have a ${overlapping.status.toLowerCase()} leave request overlapping these dates.`,
      409
    );
  }

  const [leave, user, admins] = await Promise.all([
    prisma.leaveRequest.create({
      data: {
        userId,
        leaveType: data.leaveType,
        startDate,
        endDate,
        reason: data.reason,
      },
      select: leaveSelect,
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, firstName: true, lastName: true, email: true },
    }),
    prisma.admin.findMany({
      where: { isActive: true },
      select: { email: true },
    }),
  ]);

  // Real email to every active admin — the employee's "emergency leave" mail.
  if (user && admins.length > 0) {
    const name = displayName(user);
    const range = `${leave.startDate.toISOString().slice(0, 10)} to ${leave.endDate
      .toISOString()
      .slice(0, 10)}`;
    void sendEmail({
      to: admins.map((a) => a.email),
      subject: `New leave request — ${name}`,
      text: [
        `${name} has requested ${data.leaveType.toLowerCase()} leave.`,
        `Dates: ${range}`,
        `Reason: ${data.reason}`,
        "",
        "Review it in the admin dashboard under Leave Requests.",
      ].join("\n"),
    });
  }

  return leave;
};

// ─── My leave requests ───────────────────────────────────────────
const getMyLeaves = async (userId: string, query: MyLeavesQuery) => {
  const { page, limit, status } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.LeaveRequestWhereInput = { userId };
  if (status) where.status = status;

  const [leaves, total] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: leaveSelect,
    }),
    prisma.leaveRequest.count({ where }),
  ]);

  return {
    leaves,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// ─── Cancel (only while still pending) ───────────────────────────
const cancelLeave = async (userId: string, leaveId: string) => {
  const leave = await prisma.leaveRequest.findUnique({
    where: { id: leaveId },
    select: { id: true, userId: true, status: true },
  });
  if (!leave || leave.userId !== userId) throw new AppError("Leave request not found.", 404);
  if (leave.status !== "PENDING") {
    throw new AppError("Only a pending leave request can be cancelled.", 409);
  }

  return prisma.leaveRequest.update({
    where: { id: leaveId },
    data: { status: "CANCELLED" },
    select: leaveSelect,
  });
};

export const leavesServices = {
  createLeave,
  getMyLeaves,
  cancelLeave,
};

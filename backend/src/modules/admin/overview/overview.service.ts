import { prisma } from "../../../config/db";
import { reportServices } from "../reports/reports.service";
import { adminSwapServices } from "../swaps/swaps.service";
import { adminAvailabilityServices } from "../availability/availability.service";

const displayName = (u: {
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
}) => u.name ?? ([u.firstName, u.lastName].filter(Boolean).join(" ") || u.email);

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const dayName = (d: Date) => WEEKDAYS[d.getUTCDay()];

// Service vs. dinner service split — a shift starting before 16:00 is "Lunch".
const mealPeriod = (d: Date) => (d.getUTCHours() < 16 ? "Lunch" : "Dinner");

// YYYY-MM-DD from a @db.Date value (stored at UTC midnight).
const dateOnly = (d: Date) => d.toISOString().slice(0, 10);

// Dashboard "Overview" payload for the admin webapp.
const getOverview = async () => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [
    activeEmployees,
    inactiveEmployees,
    topCategories,
    subCategories,
    draftShifts,
    upcomingShifts,
    pendingApprovals,
    shiftsAwaitingApproval,
    pendingSwaps,
    thisMonth,
    plans,
    recentStaff,
    swapList,
    availabilityStatus,
  ] = await Promise.all([
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { isActive: false } }),
    prisma.category.count({ where: { parentId: null } }),
    prisma.category.count({ where: { parentId: { not: null } } }),
    prisma.shiftOffer.count({ where: { notifiedAt: null } }),
    prisma.shiftOffer.count({ where: { notifiedAt: { not: null }, endTime: { gte: now } } }),
    // Individual acceptances still waiting on an admin decision.
    prisma.shiftOfferResponse.count({
      where: { status: "ACCEPTED", approvalStatus: "PENDING" },
    }),
    // Distinct published shifts that have at least one pending acceptance.
    prisma.shiftOffer.count({
      where: {
        notifiedAt: { not: null },
        responses: { some: { status: "ACCEPTED", approvalStatus: "PENDING" } },
      },
    }),
    // Shift swaps waiting on the admin's review.
    prisma.shiftSwapRequest.count({ where: { status: "PENDING" } }),
    // Scheduled/worked hours, overtime and wage cost for the current month.
    reportServices.buildReport({}),
    // Weekly plans (newest first) with their assignment counts.
    prisma.weeklyPlan.findMany({
      orderBy: [{ weekStartDate: "desc" }],
      take: 6,
      select: {
        id: true,
        weekNumber: true,
        weekStartDate: true,
        weekEndDate: true,
        status: true,
        _count: { select: { shifts: true } },
      },
    }),
    // Newest team members.
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        designation: true,
        department: true,
        isActive: true,
      },
    }),
    // Pending swaps, already carrying an advisory rule-check result.
    adminSwapServices.listSwaps({ page: 1, limit: 5, status: "PENDING" }),
    // Monthly availability submission status for the current month.
    adminAvailabilityServices.getMonthStatus(currentYear, currentMonth),
  ]);

  return {
    kpis: {
      employees: {
        active: activeEmployees,
        inactive: inactiveEmployees,
        total: activeEmployees + inactiveEmployees,
      },
      categories: {
        total: topCategories,
        subCategories,
      },
      shifts: {
        draft: draftShifts,
        upcoming: upcomingShifts,
        awaitingApproval: shiftsAwaitingApproval,
      },
      approvals: {
        pendingResponses: pendingApprovals,
      },
      swaps: {
        pending: pendingSwaps,
      },
    },
    thisMonth: {
      period: thisMonth.period,
      scheduledHours: thisMonth.summary.totalWorked,
      overtime: thisMonth.summary.overtime,
      hoursDue: thisMonth.summary.hoursDue,
      wageCost: thisMonth.summary.wageCost,
    },
    plans: plans.map((p) => ({
      id: p.id,
      weekNumber: p.weekNumber,
      dateRange: { start: dateOnly(p.weekStartDate), end: dateOnly(p.weekEndDate) },
      status: p.status.toLowerCase(),
      assignmentsCount: p._count.shifts,
    })),
    swaps: swapList.swaps.map((s) => ({
      id: s.id,
      fromEmployeeId: s.initiatorUser.id,
      toEmployeeId: s.recipientUser.id,
      fromEmployeeName: displayName(s.initiatorUser),
      toEmployeeName: displayName(s.recipientUser),
      day: dayName(s.initiatorShift.startTime),
      time: mealPeriod(s.initiatorShift.startTime),
      ruleCheck: s.ruleCheck?.passed ? "pass" : "fail",
    })),
    staff: recentStaff.map((u) => ({
      id: u.id,
      name: displayName(u),
      designation: u.designation,
      department: u.department,
      avatar: null,
      status: u.isActive ? "Active" : "Inactive",
    })),
    availability: {
      year: availabilityStatus.year,
      month: availabilityStatus.month,
      total: availabilityStatus.summary.total,
      submitted: availabilityStatus.summary.submitted,
      notSubmitted: availabilityStatus.summary.notSubmitted,
    },
  };
};

export const overviewServices = { getOverview };

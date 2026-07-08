import { prisma } from "../../../config/db";
import type { Prisma } from "../../../generated/prisma/client";

// Hours worked are derived from admin-APPROVED shift acceptances whose shift
// falls in the report month. This flow has no separate time-clock, so
// "scheduled" and "worked" are the same figure until real clock-in data exists.
const HOURS_PER_MS = 1 / (1000 * 60 * 60);

const round2 = (n: number) => Math.round(n * 100) / 100;

const monthRange = (year: number, month: number) => {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
};

export type EmployeeReportRow = {
  userId: string;
  name: string | null;
  email: string;
  employeeType: string | null;
  contractType: string | null;
  workloadPercent: number | null;
  categories: { id: string; name: string }[];
  contractedHours: number | null;
  scheduledHours: number;
  workedHours: number;
  overtimeHours: number;
  dueHours: number;
  hourlyRate: number | null;
  monthlySalary: number | null;
  wageCost: number;
};

const buildReport = async (query: {
  year?: number;
  month?: number;
  categoryId?: string;
}) => {
  const now = new Date();
  const year = query.year ?? now.getUTCFullYear();
  const month = query.month ?? now.getUTCMonth() + 1;
  const { start, end } = monthRange(year, month);

  // 1. Employees in scope (active, optionally filtered by category/role).
  const userWhere: Prisma.UserWhereInput = { isActive: true };
  if (query.categoryId) userWhere.categories = { some: { categoryId: query.categoryId } };

  const employees = await prisma.user.findMany({
    where: userWhere,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      employeeType: true,
      contractType: true,
      workloadPercent: true,
      hourlyRate: true,
      monthlySalary: true,
      contractedHoursMonthly: true,
      categories: {
        select: { category: { select: { id: true, name: true } } },
        orderBy: { assignedAt: "asc" },
      },
    },
  });

  // 2. Approved shift hours for these employees in the month.
  const approved = await prisma.shiftOfferResponse.findMany({
    where: {
      approvalStatus: "APPROVED",
      userId: { in: employees.map((e) => e.id) },
      shiftOffer: { startTime: { gte: start, lt: end } },
    },
    select: {
      userId: true,
      shiftOffer: { select: { startTime: true, endTime: true } },
    },
  });

  const hoursByUser = new Map<string, number>();
  for (const r of approved) {
    const hrs = (r.shiftOffer.endTime.getTime() - r.shiftOffer.startTime.getTime()) * HOURS_PER_MS;
    hoursByUser.set(r.userId, (hoursByUser.get(r.userId) ?? 0) + hrs);
  }

  // 3. Per-employee rows.
  const rows: EmployeeReportRow[] = employees.map((e) => {
    const worked = round2(hoursByUser.get(e.id) ?? 0);
    const contracted = e.contractedHoursMonthly !== null ? Number(e.contractedHoursMonthly) : null;
    const hourlyRate = e.hourlyRate !== null ? Number(e.hourlyRate) : null;
    const monthlySalary = e.monthlySalary !== null ? Number(e.monthlySalary) : null;

    const overtimeHours = contracted !== null ? round2(Math.max(0, worked - contracted)) : 0;
    const dueHours = contracted !== null ? round2(Math.max(0, contracted - worked)) : 0;

    // Wage: hourly staff bill by hours worked; salaried staff bill their fixed
    // monthly salary. Prefer the hourly rate when both exist (matches the UI).
    const wageCost =
      hourlyRate !== null
        ? round2(worked * hourlyRate)
        : monthlySalary !== null
          ? round2(monthlySalary)
          : 0;

    return {
      userId: e.id,
      name: e.name,
      email: e.email,
      employeeType: e.employeeType,
      contractType: e.contractType,
      workloadPercent: e.workloadPercent !== null ? Number(e.workloadPercent) : null,
      categories: e.categories.map((c) => c.category),
      contractedHours: contracted,
      scheduledHours: worked,
      workedHours: worked,
      overtimeHours,
      dueHours,
      hourlyRate,
      monthlySalary,
      wageCost,
    };
  });

  // 4. Summary tiles.
  const summary = rows.reduce(
    (acc, r) => {
      acc.totalWorked += r.workedHours;
      acc.overtime += r.overtimeHours;
      acc.hoursDue += r.dueHours;
      acc.wageCost += r.wageCost;
      return acc;
    },
    { totalWorked: 0, overtime: 0, hoursDue: 0, wageCost: 0 }
  );

  return {
    period: { year, month },
    summary: {
      totalWorked: round2(summary.totalWorked),
      overtime: round2(summary.overtime),
      hoursDue: round2(summary.hoursDue),
      wageCost: round2(summary.wageCost),
      employeeCount: rows.length,
    },
    employees: rows,
  };
};

// CSV export of the same data.
const csvCell = (value: string | number | null) => {
  const s = value === null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const buildReportCsv = async (query: { year?: number; month?: number; categoryId?: string }) => {
  const report = await buildReport(query);
  const header = [
    "Employee",
    "Email",
    "Employee Type",
    "Contract Type",
    "Workload %",
    "Categories",
    "Contracted Hours",
    "Scheduled Hours",
    "Worked Hours",
    "Overtime Hours",
    "Due Hours",
    "Hourly Rate",
    "Monthly Salary",
    "Wage Cost",
  ];
  const lines = [header.join(",")];
  for (const r of report.employees) {
    lines.push(
      [
        csvCell(r.name ?? r.email),
        csvCell(r.email),
        csvCell(r.employeeType),
        csvCell(r.contractType),
        csvCell(r.workloadPercent),
        csvCell(r.categories.map((c) => c.name).join(" | ")),
        csvCell(r.contractedHours),
        csvCell(r.scheduledHours),
        csvCell(r.workedHours),
        csvCell(r.overtimeHours),
        csvCell(r.dueHours),
        csvCell(r.hourlyRate),
        csvCell(r.monthlySalary),
        csvCell(r.wageCost),
      ].join(",")
    );
  }
  const filename = `report-${report.period.year}-${String(report.period.month).padStart(2, "0")}.csv`;
  return { csv: lines.join("\n"), filename };
};

export const reportServices = {
  buildReport,
  buildReportCsv,
};

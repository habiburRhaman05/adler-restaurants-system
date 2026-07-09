import { apiClient } from "@/lib/api-client";

// ─── Types ──────────────────────────────────────────────────
export interface KpiData {
  employees: { active: number; total: number };
  shifts: { upcoming: number; draft: number };
  swaps: { pending: number };
  approvals: { pendingResponses: number };
}

export interface PlanSummary {
  id: string;
  weekNumber: number;
  dateRange: { start: string; end: string };
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  assignmentsCount: number;
}

export interface SwapSummary {
  id: string;
  fromEmployeeId: string;
  toEmployeeId: string;
  fromEmployeeName: string;
  toEmployeeName: string;
  day: string;
  time: string;
  ruleCheck: 'pass' | 'fail';
}

export interface StaffSummary {
  id: string;
  name: string;
  designation: string;
  department: string;
  avatar: string | null;
  status: string;
}

export interface SnapshotData {
  totalEmployees: number;
  approvedPlans: number;
  submittedPlans: number;
  pendingSwaps: number;
}

export interface AvailabilityData {
  year: number;
  month: number;
  total: number;
  submitted: number;
  notSubmitted: number;
}

export interface OverviewData {
  kpis: KpiData;
  plans: PlanSummary[];
  swaps: SwapSummary[];
  staff: StaffSummary[];
  snapshot: SnapshotData;
  availability: AvailabilityData;
}

// ─── Service ────────────────────────────────────────────────
export const overviewService = {
  /** Single aggregate for the Overview page — real data from /admin/overview. */
  async getOverviewData(): Promise<OverviewData> {
    return apiClient.get("/admin/overview");
  },
};

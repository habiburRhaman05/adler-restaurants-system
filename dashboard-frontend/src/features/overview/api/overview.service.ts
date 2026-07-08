import { apiClient } from "@/lib/api-client";

type PromiseDelay = <T>(data: T, ms?: number) => Promise<T>;

const delay: PromiseDelay = (data, ms = 600) =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

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

// ─── Mock data ──────────────────────────────────────────────
const mockKpis: KpiData = {
  employees: { active: 18, total: 24 },
  shifts: { upcoming: 6, draft: 3 },
  swaps: { pending: 4 },
  approvals: { pendingResponses: 2 },
};

const mockPlans: PlanSummary[] = [
  { id: 'plan1', weekNumber: 1, dateRange: { start: '2026-11-03', end: '2026-11-09' }, status: 'approved', assignmentsCount: 8 },
  { id: 'plan2', weekNumber: 2, dateRange: { start: '2026-11-10', end: '2026-11-16' }, status: 'submitted', assignmentsCount: 5 },
  { id: 'plan3', weekNumber: 3, dateRange: { start: '2026-11-17', end: '2026-11-23' }, status: 'draft', assignmentsCount: 3 },
  { id: 'plan4', weekNumber: 4, dateRange: { start: '2026-11-24', end: '2026-11-30' }, status: 'draft', assignmentsCount: 0 },
];

const mockSwaps: SwapSummary[] = [
  { id: 'swap1', fromEmployeeId: 'e1', toEmployeeId: 'e2', fromEmployeeName: 'Alice Smith', toEmployeeName: 'Bob Jones', day: 'Monday', time: 'Lunch', ruleCheck: 'pass' },
  { id: 'swap2', fromEmployeeId: 'e3', toEmployeeId: 'e4', fromEmployeeName: 'Carol White', toEmployeeName: 'Dave Brown', day: 'Wednesday', time: 'Dinner', ruleCheck: 'fail' },
  { id: 'swap3', fromEmployeeId: 'e5', toEmployeeId: 'e6', fromEmployeeName: 'Eve Davis', toEmployeeName: 'Frank Miller', day: 'Friday', time: 'Lunch', ruleCheck: 'pass' },
  { id: 'swap4', fromEmployeeId: 'e7', toEmployeeId: 'e8', fromEmployeeName: 'Grace Wilson', toEmployeeName: 'Henry Taylor', day: 'Saturday', time: 'Dinner', ruleCheck: 'pass' },
];

const mockStaff: StaffSummary[] = [
  { id: 's1', name: 'Alice Smith', designation: 'Chef de Rang', department: 'Service', avatar: null, status: 'Active' },
  { id: 's2', name: 'Bob Jones', designation: 'Commis', department: 'Kitchen', avatar: null, status: 'Active' },
  { id: 's3', name: 'Carol White', designation: 'Bartender', department: 'Bar', avatar: null, status: 'Active' },
  { id: 's4', name: 'Dave Brown', designation: 'Dishwasher', department: 'Kitchen', avatar: null, status: 'Active' },
  { id: 's5', name: 'Eve Davis', designation: 'Server', department: 'Service', avatar: null, status: 'Inactive' },
];

const mockSnapshot: SnapshotData = {
  totalEmployees: 24,
  approvedPlans: 3,
  submittedPlans: 2,
  pendingSwaps: 4,
};

// ─── Service functions ──────────────────────────────────────
export const overviewService = {

  
  async getOverviewData(): Promise<OverviewData> {
    return apiClient.get("/admin/overview");
  },

  async getKpis(): Promise<KpiData> {
    return delay(mockKpis, 500);
  },

  async getPlans(): Promise<PlanSummary[]> {
    return delay(mockPlans, 700);
  },

  async getSwaps(): Promise<SwapSummary[]> {
    return delay(mockSwaps, 600);
  },

  async getStaff(): Promise<StaffSummary[]> {
    return delay(mockStaff, 400);
  },

  async getSnapshot(): Promise<SnapshotData> {
    return delay(mockSnapshot, 550);
  },

  /** Fetch all overview data at once (for optimistic loading) */
  async getAll(): Promise<OverviewData> {
    return delay({
      kpis: mockKpis,
      plans: mockPlans,
      swaps: mockSwaps,
      staff: mockStaff,
      snapshot: mockSnapshot,
      availability: { year: 2026, month: 7, total: 18, submitted: 12, notSubmitted: 6 },
    }, 800);
  },
};

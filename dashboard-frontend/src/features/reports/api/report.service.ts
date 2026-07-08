import { apiClient } from "@/lib/api-client";
import { buildQuery } from "@/types";

export interface ReportSummary {
  totalWorked: number;
  overtime: number;
  hoursDue: number;
  wageCost: number;
  employeeCount: number;
}

export interface ReportEmployee {
  userId: string;
  name: string;
  email: string;
  employeeType: string;
  contractType: string;
  workloadPercent: number;
  categories: { id: string; name: string }[];
  contractedHours: number;
  scheduledHours: number;
  workedHours: number;
  overtimeHours: number;
  dueHours: number;
  hourlyRate: number | null;
  monthlySalary: number | null;
  wageCost: number;
}

export interface ReportsData {
  period: { year: number; month: number };
  summary: ReportSummary;
  employees: ReportEmployee[];
}

export const reportService = {
  getReports: async (params: { year?: number; month?: number; categoryId?: string }) => {
    return apiClient.get<{ data: ReportsData }>(`/admin/reports${buildQuery(params)}`);
  },
  
  getExportUrl: (params: { year?: number; month?: number; categoryId?: string }) => {
    return `${import.meta.env.VITE_API_BASE_URL}/admin/reports/export${buildQuery(params)}`;
  }
};

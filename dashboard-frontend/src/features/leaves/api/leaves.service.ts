import { apiClient } from "@/lib/api-client";
import { buildQuery } from "@/types";

export interface LeaveRequest {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
  leaveType: string;
  startDate: string;
  endDate: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  reason: string | null;
  adminNote: string | null;
  createdAt: string;
}

export interface ListLeavesResponse {
  leaves: LeaveRequest[];
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const leavesService = {
  getLeaves: async (params: { page?: number; limit?: number; status?: string; userId?: string }) => {
    return apiClient.get<{ data: ListLeavesResponse; meta: { pagination: PaginationMeta } }>(`/admin/leaves${buildQuery(params)}`);
  },
  approveLeave: async (leaveId: string, data?: { adminNote?: string }) => {
    return apiClient.post<{ message: string; data: any }>(`/admin/leaves/${leaveId}/approve`, data || {});
  },
  rejectLeave: async (leaveId: string, data?: { adminNote?: string }) => {
    return apiClient.post<{ message: string; data: any }>(`/admin/leaves/${leaveId}/reject`, data || {});
  },
};

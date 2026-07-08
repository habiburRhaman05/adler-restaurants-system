import { apiClient } from '@/lib/api-client';
import { buildQuery } from '@/types';

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface Shift {
  id: string;
  jobTitle: string;
  startTime: string;
  endTime: string;
  hourlyPrice: number;
  description?: string;
  categoryId: string;
  category: {
    id: string;
    name: string;
  };
  notifiedAt: string | null;
  createdById: string;
  
  // Roll-up counts
  acceptedCount: number;
  approvedCount: number;
  pendingApprovalCount: number;
  rejectedByAdminCount: number;
  declinedCount: number;
  available: number; // usually = approvedCount
}

export interface ShiftInput {
  jobTitle: string;
  categoryId: string;
  startTime: string;
  endTime: string;
  hourlyPrice: number;
  description?: string;
}

export interface ShiftFilters {
  page?: number;
  limit?: number;
  categoryId?: string;
  notified?: boolean;
  upcoming?: boolean;
}

export interface ShiftListResponse {
  success: boolean;
  data: {
    shifts: Shift[];
  };
  meta: {
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface Volunteer {
  id: string;
  status: 'ACCEPTED' | 'REJECTED';
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  respondedAt: string;
  approvedAt: string | null;
  approvalNote: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
    department: string;
    designation: string;
    employeeType: string;
  };
}

export interface ShiftApprovalsFeedResponse {
  success: boolean;
  data: {
    shifts: (Shift & { volunteers: Volunteer[] })[];
  };
  meta: {
    pagination: any;
  };
}

export interface ShiftResponsesResponse {
  success: boolean;
  data: {
    shift: Shift;
    accepted: Volunteer[];
    declined: Volunteer[];
    counts: {
      acceptedCount: number;
      approvedCount: number;
      pendingApprovalCount: number;
      rejectedByAdminCount: number;
      declinedCount: number;
      total: number;
      available: number;
    };
  };
}

// ─── Service ───────────────────────────────────────────────────────────────

export const shiftService = {
  // --- Shifts ---
  
  create: (data: ShiftInput): Promise<Shift> =>
    apiClient.post('/admin/shifts', data),

  getAll: (filters: ShiftFilters = {}): Promise<ShiftListResponse> =>
    apiClient.get(`/admin/shifts${buildQuery(filters)}`),

  getById: (id: string): Promise<Shift> =>
    apiClient.get(`/admin/shifts/${id}`),

  update: (id: string, data: Partial<ShiftInput>): Promise<Shift> =>
    apiClient.patch(`/admin/shifts/${id}`, data),

  remove: (id: string): Promise<void> =>
    apiClient.delete(`/admin/shifts/${id}`),

  notify: (id: string): Promise<{ success: boolean; message: string; data: { shift: Shift; notifiedCount: number } }> =>
    apiClient.post(`/admin/shifts/${id}/notify`),

  // --- Approvals ---

  getApprovalsFeed: (filters: { page?: number; limit?: number; pendingOnly?: boolean } = {}): Promise<ShiftApprovalsFeedResponse> =>
    apiClient.get(`/admin/shifts/approvals${buildQuery(filters)}`),

  getShiftResponses: (shiftId: string): Promise<ShiftResponsesResponse> =>
    apiClient.get(`/admin/shifts/${shiftId}/responses`),

  approveResponse: (shiftId: string, responseId: string): Promise<{ data: { response: Volunteer } }> =>
    apiClient.post(`/admin/shifts/${shiftId}/responses/${responseId}/approve`),

  rejectResponse: (shiftId: string, responseId: string, note?: string): Promise<{ data: { response: Volunteer } }> =>
    apiClient.post(`/admin/shifts/${shiftId}/responses/${responseId}/reject`, { note }),
};

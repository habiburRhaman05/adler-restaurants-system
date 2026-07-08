import { apiClient } from '@/lib/api-client';
import { buildQuery } from '@/types';

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface Swap {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reason: string;
  adminNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  initiatorUser: {
    id: string;
    name: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
  recipientUser: {
    id: string;
    name: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
  initiatorShift: {
    id: string;
    jobTitle: string;
    startTime: string;
    endTime: string;
    category: {
      id: string;
      name: string;
    };
  };
  recipientShift: {
    id: string;
    jobTitle: string;
    startTime: string;
    endTime: string;
    category: {
      id: string;
      name: string;
    };
  };
  ruleCheck: {
    passed: boolean;
    violations: string[];
  } | null;
}

export interface SwapFilters {
  page?: number;
  limit?: number;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
}

export interface SwapListResponse {
  success: boolean;
  data: {
    swaps: Swap[];
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

// ─── Service ───────────────────────────────────────────────────────────────

export const swapService = {
  getAll: (filters: SwapFilters = {}): Promise<SwapListResponse> =>
    apiClient.get(`/admin/swaps${buildQuery(filters)}`),

  approve: (swapId: string, note?: string): Promise<{ data: { swap: Swap } }> =>
    apiClient.post(`/admin/swaps/${swapId}/approve`, { note }),

  reject: (swapId: string, note?: string): Promise<{ data: { swap: Swap } }> =>
    apiClient.post(`/admin/swaps/${swapId}/reject`, { note }),
};

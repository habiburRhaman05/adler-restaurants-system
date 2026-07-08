import { apiClient } from '@/lib/api-client';

export type DemandStatus = 'DRAFT' | 'PUBLISHED';

export interface DayDemand {
  date: string;
  requiredCount: number;
  demandId: string | null;
}

export interface CategoryDemandRow {
  category: {
    id: string;
    name: string;
  };
  cells: DayDemand[];
}

export interface DemandWeek {
  id: string;
  weekStartDate: string;
  weekEndDate: string;
  status: DemandStatus;
  publishedAt: string | null;
  relative: 'current' | 'upcoming' | 'past';
  days: string[];
  categories: CategoryDemandRow[];
}

export interface DemandGridResponse {
  scope: string;
  today: string;
  currentWeek: {
    weekStartDate: string;
    weekEndDate: string;
  };
  weeks: DemandWeek[];
}

export interface LightweightWeek {
  id: string;
  weekStartDate: string;
  weekEndDate: string;
  status: DemandStatus;
  publishedAt: string | null;
  demandCount: number;
  relative: 'current' | 'upcoming' | 'past';
}

export interface LightweightWeeksResponse {
  weeks: LightweightWeek[];
}

export interface CreateWeekInput {
  weekStartDate: string;
  copyFromWeekId?: string;
}

export interface SaveCellInput {
  categoryId: string;
  date: string;
  requiredCount: number;
}

export interface SaveWeekInput {
  demands: SaveCellInput[];
}

export const demandService = {
  getGrid: (params?: { scope?: string; date?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.scope) searchParams.append('scope', params.scope);
    if (params?.date) searchParams.append('date', params.date);
    const qs = searchParams.toString();
    return apiClient.get<DemandGridResponse>(`/admin/demands${qs ? `?${qs}` : ''}`);
  },

  getWeeks: () => {
    return apiClient.get<LightweightWeeksResponse>('/admin/demands/weeks');
  },

  createWeek: (input: CreateWeekInput) => {
    return apiClient.post<{ week: DemandWeek }>('/admin/demands/weeks', input);
  },

  getWeek: (weekId: string) => {
    return apiClient.get<{ week: DemandWeek }>(`/admin/demands/weeks/${weekId}`);
  },

  saveWeek: (weekId: string, input: SaveWeekInput) => {
    return apiClient.put<{ week: DemandWeek }>(`/admin/demands/weeks/${weekId}`, input);
  },

  updateCell: (weekId: string, input: SaveCellInput) => {
    return apiClient.put<{ demand: { id: string; categoryId: string; date: string; requiredCount: number } }>(
      `/admin/demands/weeks/${weekId}/cell`,
      input
    );
  },

  publishWeek: (weekId: string) => {
    return apiClient.post<{ week: DemandWeek }>(`/admin/demands/weeks/${weekId}/publish`);
  },

  deleteWeek: (weekId: string) => {
    return apiClient.delete<{ success: boolean }>(`/admin/demands/weeks/${weekId}`);
  },
};

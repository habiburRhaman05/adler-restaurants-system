import { z } from 'zod';
import api from '@/lib/axios';
import { buildQuery } from '@/types';

// ─── Schemas & Types ────────────────────────────────────────
export const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME'] as const;
export const CONTRACT_TYPES = ['HOURLY', 'MONTHLY_SALARY', 'WORKLOAD_PERCENT'] as const;

export const employeeSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  email: z.string(),
  department: z.string().optional(),
  designation: z.string().optional(),
  employeeType: z.enum(EMPLOYMENT_TYPES).optional(),
  contractType: z.enum(CONTRACT_TYPES).optional(),
  isActive: z.boolean().optional(),
  workloadPercent: z.union([z.string(), z.number()]).optional(),
  hourlyRate: z.union([z.string(), z.number()]).optional(),
  monthlySalary: z.union([z.string(), z.number()]).optional(),
  contractedHoursMonthly: z.union([z.string(), z.number()]).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  hireDate: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  categories: z.array(z.any()).optional(),
  mustChangePassword: z.boolean().optional(),
  lastLoginAt: z.string().nullable().optional(),
  deactivatedAt: z.string().nullable().optional(),
});

export type Employee = z.infer<typeof employeeSchema>;

export type EmployeeInput = {
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address?: string;
  department?: string;
  designation?: string;
  employeeType?: 'FULL_TIME' | 'PART_TIME';
  isActive?: boolean;
  contractType?: 'HOURLY' | 'MONTHLY_SALARY' | 'WORKLOAD_PERCENT';
  workloadPercent?: number;
  hourlyRate?: number;
  monthlySalary?: number;
  contractedHoursMonthly?: number;
  hireDate?: string;
  categoryIds?: string[];
  mustChangePassword?: boolean;
};

export interface EmployeeListResponse {
  success: boolean;
  data: {
    users: Employee[];
    counts: {
      active: number;
      inactive: number;
    };
  };
  meta: {
    pagination: {
      limit: number;
      nextCursor: string | null;
      hasNextPage: boolean;
    };
  };
}

export interface EmployeeFilters {
  search?: string;
  categoryId?: string;
  isActive?: boolean | string;
  cursor?: string;
  limit?: number;
}

// ─── Service ────────────────────────────────────────────────
export const employeeService = {
  /** Fetch employees with optional filters (pagination, search, sort). */
  getAll: (filters: EmployeeFilters = {}): Promise<EmployeeListResponse> =>
    api.get(`/admin/users${buildQuery(filters)}`).then(res => res.data),

  /** Get single employee by ID. */
  getById: (id: string): Promise<{ data: { user: Employee } }> =>
    api.get(`/admin/users/${id}`).then(res => res.data),

  /** Create new employee. */
  create: (data: EmployeeInput): Promise<{ data: { user: Employee } }> =>
    api.post('/admin/users', data).then(res => res.data),

  /** Update existing employee (partial). */
  update: (id: string, data: Partial<EmployeeInput>): Promise<{ data: { user: Employee } }> =>
    api.patch(`/admin/users/${id}`, data).then(res => res.data),

  /** Delete employee. */
  remove: (id: string): Promise<{ message: string }> =>
    api.delete(`/admin/users/${id}`).then(res => res.data),

  /** Deactivate employee. */
  deactivate: (id: string): Promise<{ data: { user: Employee } }> =>
    api.patch(`/admin/users/${id}/deactivate`, {}).then(res => res.data),

  /** Activate employee. */
  activate: (id: string): Promise<{ data: { user: Employee } }> =>
    api.patch(`/admin/users/${id}/activate`, {}).then(res => res.data),

  // ─── Client-side utilities ─────────────────────────────

  /** Compute stats from an employee array. */
  getStats: (employees: Employee[]) => ({
    total: employees.length,
    active: employees.filter((e) => e.isActive !== false).length,
    inactive: employees.filter((e) => e.isActive === false).length,
  }),
};

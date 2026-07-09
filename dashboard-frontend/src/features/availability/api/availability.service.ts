import { z } from 'zod';
import { apiClient } from '@/lib/api-client';

// Mirrors backend/src/modules/admin/availability (grid / open / nudge).

const availabilityDaySchema = z.object({
  id: z.string(),
  date: z.string(),
  // AVAILABLE | UNAVAILABLE | WISH — lenient so a new enum value never breaks the page.
  status: z.string(),
  note: z.string().nullish(),
  preferredStartTime: z.string().nullish(),
  preferredEndTime: z.string().nullish(),
});
export type AvailabilityDay = z.infer<typeof availabilityDaySchema>;

const gridEmployeeSchema = z.object({
  userId: z.string(),
  name: z.string().nullish(),
  firstName: z.string().nullish(),
  lastName: z.string().nullish(),
  email: z.string(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'LOCKED', 'NOT_OPENED']).catch('NOT_OPENED'),
  submittedAt: z.string().nullish(),
  cutoffAt: z.string().nullish(),
  days: z.array(availabilityDaySchema),
});
export type AvailabilityGridEmployee = z.infer<typeof gridEmployeeSchema>;

const gridSchema = z.object({
  year: z.number(),
  month: z.number(),
  employees: z.array(gridEmployeeSchema),
  summary: z.object({
    total: z.number(),
    submitted: z.number(),
    notSubmitted: z.number(),
  }),
});
export type AvailabilityGrid = z.infer<typeof gridSchema>;

const openResponseSchema = z.object({
  year: z.number(),
  month: z.number(),
  cutoffAt: z.string(),
  opened: z.number(),
});
export type OpenMonthResponse = z.infer<typeof openResponseSchema>;

export const availabilityService = {
  /** Full month grid: every active employee + their day-by-day availability. */
  getGrid: (year: number, month: number): Promise<AvailabilityGrid> =>
    apiClient.get(`/admin/availability/grid?year=${year}&month=${month}`, { schema: gridSchema }),

  /** Open (or re-open with a new cut-off) the month for all active employees. */
  openMonth: (year: number, month: number, cutoffAt: string): Promise<OpenMonthResponse> =>
    apiClient.post('/admin/availability/open', { year, month, cutoffAt }, { schema: openResponseSchema }),

  /** One-tap reminder for an employee who hasn't submitted yet. */
  nudge: (userId: string, year: number, month: number): Promise<void> =>
    apiClient.post(`/admin/availability/${userId}/nudge`, { year, month }),
};

/** Display name matching the backend's displayName helper. */
export function availabilityUserName(e: AvailabilityGridEmployee): string {
  return e.name ?? ([e.firstName, e.lastName].filter(Boolean).join(' ') || e.email);
}

import { z } from 'zod';
import { apiClient } from '@/lib/api-client';

export const settingsSchema = z.object({
  id: z.string().optional().default('1'),
  maxDailyHours: z.number(),
  maxWeeklyHours: z.number(),
  minRestHours: z.number(),
  breakAfterHours: z.number(),
  breakMinutes: z.number(),
  notifications: z.object({
    email: z.boolean(),
    push: z.boolean(),
    digest: z.boolean(),
  }),
  sessionTimeoutMinutes: z.number(),
});

export type Settings = z.infer<typeof settingsSchema>;

export const settingsService = {
  get: (): Promise<Settings> => apiClient.get('/settings', { schema: settingsSchema }),
  update: (data: Partial<Settings>): Promise<Settings> =>
    apiClient.put('/settings', data, { schema: settingsSchema }),
  updateProfile: (data: any): Promise<any> =>
    apiClient.patch('/auth/admin/profile', data),
};

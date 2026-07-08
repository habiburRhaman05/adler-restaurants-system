import { z } from 'zod';
import { apiClient } from '@/lib/api-client';
import {
  loginResponseSchema,
  meResponseSchema,
  type LoginInput,
  type LoginResponse,
  type MeResponse,
} from '../schemas/auth.schema';

export interface UpdateProfileInput {
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
}

const updateProfileResponseSchema = z.object({
  admin: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string().nullish(),
    firstName: z.string().nullish(),
    lastName: z.string().nullish(),
  }),
  passwordChanged: z.boolean(),
});
export type UpdateProfileResponse = z.infer<typeof updateProfileResponseSchema>;

export const authService = {
  login: async (credentials: LoginInput): Promise<LoginResponse> => {
    return apiClient.post<LoginResponse>('/auth/admin/login', credentials, {
      schema: loginResponseSchema,
    });
  },

  me: async (): Promise<MeResponse> => {
    return apiClient.get<MeResponse>('/auth/admin/profile', {
      schema: meResponseSchema,
    });
  },

  logout: async (): Promise<void> => {
    return apiClient.post<void>('/auth/admin/logout', undefined);
  },

  updateProfile: async (data: UpdateProfileInput): Promise<UpdateProfileResponse> => {
    return apiClient.patch<UpdateProfileResponse>('/auth/admin/profile', data, {
      schema: updateProfileResponseSchema,
    });
  },

  forgotPassword: async (email: string): Promise<void> => {
    await apiClient.post('/auth/admin/forgot-password', { email });
  },

  resetPassword: async (token: string, newPassword: string): Promise<void> => {
    await apiClient.post('/auth/admin/reset-password', { token, newPassword });
  },
};

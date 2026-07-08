import { apiClient } from '@/lib/api-client';
import {
  loginResponseSchema,
  meResponseSchema,
  type LoginInput,
  type LoginResponse,
  type MeResponse,
} from '../schemas/auth.schema';

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
  updateProfile: async (): Promise<void> => {
    return apiClient.patch<void>('/auth/admin/profile', undefined);
  },
  changePassword: async (): Promise<void> => {
    return apiClient.patch<void>('/auth/admin/change-password', undefined);
  },
};

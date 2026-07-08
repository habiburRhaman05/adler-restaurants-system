import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import type { ApiResponse, LoginPayload, LoginResponseData, ProfileUser, UpdateProfilePayload } from '../types';

export async function loginRequest(payload: LoginPayload) {
  const { data } = await apiClient.post<ApiResponse<LoginResponseData>>(ENDPOINTS.auth.login, payload);
  return data;
}

export async function logoutRequest(): Promise<void> {
  await apiClient.post(ENDPOINTS.auth.logout);
}

export async function fetchProfile() {
  const { data } = await apiClient.get<ApiResponse<{ user: ProfileUser }>>(ENDPOINTS.auth.profile);
  return data.data.user;
}

export async function updateProfileRequest(payload: UpdateProfilePayload) {
  const { data } = await apiClient.patch<ApiResponse<{ user: ProfileUser }>>(ENDPOINTS.me.profile, payload);
  return data.data.user;
}

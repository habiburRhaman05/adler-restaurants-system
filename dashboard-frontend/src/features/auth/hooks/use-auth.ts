import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';
import { ApiError } from '@/lib/axios';
import { authService, type UpdateProfileInput } from '../api/auth.service';
import type { LoginInput } from '../schemas/auth.schema';

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiError && error.message ? error.message : fallback;

// ─── Query keys ────────────────────────────────────────────
export const authKeys = {
  all: ['auth'] as const,
  me: () => [...authKeys.all, 'me'] as const,
};

// ─── Login ─────────────────────────────────────────────────
export function useLogin() {
  const storeLogin = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (credentials: LoginInput) => authService.login(credentials),
    onSuccess: (data) => {
      storeLogin(data.admin);
      toast.success('Welcome back!', {
        description: `Signed in as ${data.admin.email}`,
      });
      navigate('/dashboard', { replace: true });
    },
    onError: () => {
      toast.error('Login failed', {
        description: 'Invalid email or password. Please try again.',
      });
    },
  });
}

// ─── Logout ────────────────────────────────────────────────
export function useLogout() {
  const storeLogout = useAuthStore((s) => s.logout);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      storeLogout();
      queryClient.clear();
      navigate('/login', { replace: true });
      toast.success('Signed out successfully');
    },
    onError: () => {
      // Even if the API call fails, still clear local state
      storeLogout();
      queryClient.clear();
      navigate('/login', { replace: true });
    },
  });
}

// ─── Forgot / Reset Password ───────────────────────────────
export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => authService.forgotPassword(email),
    onError: (error) => {
      toast.error('Could not send reset email', {
        description: errorMessage(error, 'Please try again in a moment.'),
      });
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ token, newPassword }: { token: string; newPassword: string }) =>
      authService.resetPassword(token, newPassword),
    onError: (error) => {
      toast.error('Password reset failed', {
        description: errorMessage(error, 'The link may be invalid or expired — request a new one.'),
      });
    },
  });
}

// ─── Update Own Profile ────────────────────────────────────
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const storeLogout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: UpdateProfileInput) => authService.updateProfile(data),
    onSuccess: (result) => {
      if (result.passwordChanged) {
        // Backend revoked every session — force a clean re-login.
        toast.success('Password changed', {
          description: 'Please sign in again with your new password.',
        });
        storeLogout();
        queryClient.clear();
        navigate('/login', { replace: true });
        return;
      }
      queryClient.invalidateQueries({ queryKey: authKeys.me() });
      toast.success('Profile updated successfully');
    },
    onError: (error) => {
      toast.error('Update failed', {
        description: errorMessage(error, 'Please check the form and try again.'),
      });
    },
  });
}

// ─── Current User (profile fetch) ──────────────────────────
export function useCurrentUser() {
  const setUser = useAuthStore((s) => s.setUser);

  return useQuery({
    queryKey: authKeys.me(),
    queryFn: async () => {
      const response = await authService.me();
      setUser(response.admin);
      return response;
    },
    retry: false,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

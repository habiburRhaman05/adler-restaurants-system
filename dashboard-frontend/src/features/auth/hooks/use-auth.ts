import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';
import { authService } from '../api/auth.service';
import type { LoginInput } from '../schemas/auth.schema';

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

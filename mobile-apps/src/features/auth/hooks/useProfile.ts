import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchProfile, updateProfileRequest } from '../api/auth.api';
import { UpdateProfilePayload } from '../types';
import { useAuthStore } from '../store/authStore';

export function useProfile() {
  const setUser = useAuthStore((s) => s.setUser);
  const status = useAuthStore((s) => s.status);

  return useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const user = await fetchProfile();
      setUser(user);
      return user;
    },
    enabled: status === 'authenticated',
    staleTime: 1000 * 60 * 2,
    retry: false,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: (payload: UpdateProfilePayload) => updateProfileRequest(payload),
    onSuccess: (user) => {
      setUser(user);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

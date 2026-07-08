import { create } from 'zustand';
import { fetchProfile } from '../api/auth.api';
import type { User } from '../types';

type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

type AuthState = {
  status: AuthStatus;
  user: User | null;
  restoreSession: () => Promise<void>;
  setSession: (user: User) => void;
  setUser: (user: User) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  status: 'checking',
  user: null,

  restoreSession: async () => {
    try {
      const user = await fetchProfile();
      set({ status: 'authenticated', user });
    } catch {
      set({ status: 'unauthenticated', user: null });
    }
  },

  setSession: (user) => {
    set({ status: 'authenticated', user });
  },

  setUser: (user) => {
    set({ user });
  },

  logout: () => {
    set({ status: 'unauthenticated', user: null });
  },
}));

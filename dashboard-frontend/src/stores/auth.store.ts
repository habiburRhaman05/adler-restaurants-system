import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/features/auth/schemas/auth.schema';

// ─── Roles ──────────────────────────────────────────────────
export const UserRole = {
  ADMIN: 'admin',
  EMPLOYEE: 'employee',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

// ─── State ──────────────────────────────────────────────────
interface AuthState {
  /** Authenticated user info (null when logged out). */
  admin: User | null;
  /** Derived from admin !== null. */
  isAuthenticated: boolean;
  /** True once the persisted state has been hydrated from storage. */
  isHydrated: boolean;
  /** Timestamp (ms) of last user activity for session timeout. */
  lastActivity: number | null;
}

interface AuthActions {
  /** Called after a successful login. */
  login: (admin: User) => void;
  /** Called after logout or session expiry. */
  logout: () => void;
  /** Update the current user (e.g. after profile fetch). */
  setUser: (admin: User) => void;
  /** Mark the store as hydrated (called by persist callback). */
  setHydrated: () => void;
  /** Touch the activity timer (call on user interaction). */
  touchActivity: () => void;
}

type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  admin: null,
  isAuthenticated: false,
  isHydrated: false,
  lastActivity: null,
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      ...initialState,

      login: (admin) =>
        set({
          admin,
          isAuthenticated: true,
          isHydrated: true,
          lastActivity: Date.now(),
        }),

      logout: () =>
        set({
          admin: null,
          isAuthenticated: false,
          isHydrated: true,
          lastActivity: null,
        }),

      setUser: (admin) => set({ admin }),

      setHydrated: () => set({ isHydrated: true }),

      touchActivity: () => set({ lastActivity: Date.now() }),
    }),
    {
      name: 'auth-storage',
      // Only persist admin — tokens are managed via httpOnly cookies
      partialize: (state) => ({
        admin: state.admin,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
);

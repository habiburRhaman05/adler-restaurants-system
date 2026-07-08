import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore, type UserRole } from '@/stores/auth.store';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: UserRole;
}


const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const admin = useAuthStore((s) => s.admin);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const lastActivity = useAuthStore((s) => s.lastActivity);
  const logout = useAuthStore((s) => s.logout);
  const location = useLocation();

  useEffect(() => {
    if (!isAuthenticated || !lastActivity || !SESSION_TIMEOUT_MS) return;

    const elapsed = Date.now() - lastActivity;
    if (elapsed >= SESSION_TIMEOUT_MS) {
      logout();
    }
  }, [isAuthenticated, lastActivity, logout]);


  if (!isHydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f0f5ff]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm font-medium text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }


  if (!admin || !isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }


  if (requiredRole && admin.role !== requiredRole) {

    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

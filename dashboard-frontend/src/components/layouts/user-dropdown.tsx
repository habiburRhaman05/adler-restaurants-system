import { useNavigate } from 'react-router-dom';
import { User as UserIcon, Settings as SettingsIcon, LogOut, Loader2, HelpCircle } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/stores/auth.store';
import { useLogout } from '@/features/auth/hooks/use-auth';
import { initials } from '@/lib/utils';

export function UserDropdown() {
  const user = useAuthStore((s) => s.admin);
  const navigate = useNavigate();
  const { mutate: logout, isPending: isLoggingOut } = useLogout();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-lg shadow-blue-600/25 overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500/40 hover:shadow-blue-600/40 hover:scale-105 transition-all duration-200 cursor-pointer">
          {user?.avatar ? (
            <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
          ) : (
            initials(user?.name)
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 rounded-xl border-blue-100/80 bg-white/95 backdrop-blur-xl shadow-2xl shadow-slate-900/10 p-1.5"
      >
        <DropdownMenuLabel className="px-2 py-2">
          <div className="flex flex-col">
            <span className="font-semibold text-slate-900 truncate">
              {user?.name ?? 'Account'}
            </span>
            <span className="text-xs font-normal text-slate-400 truncate">
              {user?.email}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-1 bg-slate-100" />
        <DropdownMenuItem onSelect={() => navigate('/dashboard/profile')} className="cursor-pointer rounded-lg mx-0.5 my-0.5 text-slate-700 focus:bg-slate-100 focus:text-slate-900 transition-colors">
          <UserIcon className="mr-2 h-4 w-4 text-slate-500" /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate('/dashboard/settings')} className="cursor-pointer rounded-lg mx-0.5 my-0.5 text-slate-700 focus:bg-slate-100 focus:text-slate-900 transition-colors">
          <SettingsIcon className="mr-2 h-4 w-4 text-slate-500" /> Settings
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate('/dashboard')} className="cursor-pointer rounded-lg mx-0.5 my-0.5 text-slate-700 focus:bg-slate-100 focus:text-slate-900 transition-colors">
          <HelpCircle className="mr-2 h-4 w-4 text-slate-500" /> Help & Support
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-1 bg-slate-100" />
        <DropdownMenuItem
          className="cursor-pointer text-red-600 focus:text-red-600 rounded-lg mx-0.5 my-0.5 hover:bg-red-50 data-[disabled]:opacity-50 data-[disabled]:pointer-events-none"
          disabled={isLoggingOut}
          onSelect={(e) => {
            // Prevent menu from closing immediately — keep popup open
            // so the loading spinner is visible until redirect happens
            e.preventDefault();
            logout();
          }}
        >
          {isLoggingOut ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Signing out...</span>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </span>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

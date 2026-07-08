import { Bell, AlignJustify, UtensilsCrossed, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useSidebar } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { UserDropdown } from './user-dropdown';

export function Header() {
  const { toggleSidebar } = useSidebar();
  const navigate = useNavigate();

  return (
    <header className="h-[65px] flex items-center gap-4 border-b border-slate-200/60 bg-white/70 backdrop-blur-2xl shadow-sm px-4 md:px-6 top-0 z-30 sticky">
      {/* Left: Hamburger + Logo on mobile */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="flex items-center justify-center h-12 w-12 text-[#64748B] hover:text-[#1E293B] hover:bg-black/[0.04] rounded-xl transition-all duration-200"
          aria-label="Toggle sidebar"
        >
          <AlignJustify className="h-5 w-5" />
        </button>

        {/* Mobile logo */}
        <div className="flex items-center gap-2 md:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
            <UtensilsCrossed className="h-4 w-4" />
          </div>
          <span className="text-[17px] font-black tracking-tight text-slate-900 flex items-center gap-1.5">
            ADLER
            <Sparkles className="h-3.5 w-3.5 text-blue-500" />
          </span>
        </div>
      </div>

    

      {/* Right actions */}
      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/dashboard/notifications')}
          className="relative h-11 w-11 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-all"
          aria-label="Notifications"
        >
          <Bell className="h-[22px] w-[22px]" />
          <span className="absolute top-[10px] right-[10px] h-2.5 w-2.5 rounded-full bg-blue-600 ring-2 ring-white" />
        </Button>

        <UserDropdown />
      </div>
    </header>
  );
}

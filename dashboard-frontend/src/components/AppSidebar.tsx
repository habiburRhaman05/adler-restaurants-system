import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarRange,
  Users,
  Layers,
  ArrowLeftRight,
  BarChart3,
  Settings as SettingsIcon,
  ClipboardList,
  UtensilsCrossed,
  Plane,
  Clock,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth.store";
import { initials } from "@/lib/utils";
import { useApprovals } from "@/features/approvals/hooks/use-approvals";

const items = [
  { title: "Overview", url: "/dashboard", icon: LayoutDashboard },
  { title: "Schedule planner", url: "/dashboard/schedule", icon: CalendarRange },
  // { title: "Plans", url: "/dashboard/plans", icon: Layers },\
  { title: "Demands", url: "/dashboard/demands", icon: ClipboardList },
  { title: "Employees", url: "/dashboard/employees", icon: Users },
  { title: "Categories", url: "/dashboard/categories", icon: Layers },
  {
    title: "Shift Approvals",
    url: "/dashboard/approvals",
    icon: ArrowLeftRight,
    approvalsBadge: true,
  },
  { title: "Attendance", url: "/dashboard/attendance", icon: Clock },
  { title: "Leave Requests", url: "/dashboard/leaves", icon: Plane },
  { title: "Reports & Payroll", url: "/dashboard/reports", icon: BarChart3 },
  { title: "Settings", url: "/dashboard/settings", icon: SettingsIcon },
];

export function AppSidebar() {
  const location = useLocation();
  const pathname = location.pathname;
  const user = useAuthStore((s) => s.admin);
  const { data: approvals } = useApprovals({ status: "pending" });
  const pendingCount = approvals?.total ?? 0;

  const isActive = (url: string) =>
    url === "/dashboard"
      ? pathname === "/dashboard"
      : pathname === url || pathname.startsWith(url + "/");

  return (
    <Sidebar
      collapsible="icon"
      className="bg-[#F1F5F9]/80  backdrop-blur-xl border-r border-[#E2E8F0]"
    >
      {/* ── Header ──────────────────────────────────── */}
      <SidebarHeader className="h-[65px] border-b border-[#E2E8F0] sm:bg-transparent bg-white">
  <div className="flex h-full items-center px-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
    <div className="flex items-center gap-3 group-data-[collapsible=icon]:gap-0">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-600/25 transition-all duration-200 group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:w-9">
        <UtensilsCrossed className="h-5 w-5 group-data-[collapsible=icon]:h-4 group-data-[collapsible=icon]:w-4" />
      </div>
      <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
        <span className="text-lg font-bold tracking-tight text-[#1E293B]">
          ADLER
        </span>
        <span className="text-xs font-medium text-[#64748B]">
          Staff Planning
        </span>
      </div>
    </div>
  </div>
</SidebarHeader>
      {/* ── Navigation ──────────────────────────────── */}
      <SidebarContent className="sm:bg-transparent bg-white group-data-[collapsible=icon]:gap-0">
        <SidebarGroup className="group-data-[collapsible=icon]:p-0">
          <SidebarGroupLabel className="text-[11px] uppercase tracking-[0.2em] text-[#64748B] font-semibold px-4">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="px-2 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:gap-0">
              {items.map((item) => {
                const active = isActive(item.url);
                const showBadge = item.approvalsBadge && pendingCount > 0;

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      size="lg"
                      className={`rounded-xl transition-all duration-200 font-medium ${
                        active
                          ? "bg-blue-600 text-white shadow-md shadow-blue-600/20 hover:bg-blue-700"
                          : "text-[#64748B] hover:bg-[#E2E8F0] hover:text-[#1E293B]"
                      }`}
                    >
                      <Link to={item.url}>
                        <item.icon className="h-5 w-5 shrink-0 group-data-[collapsible=icon]:mx-auto" />
                        <span className="text-sm group-data-[collapsible=icon]:hidden">
                          {item.title}
                        </span>
                        {showBadge && (
                          <Badge className="ml-auto h-6 min-w-6 px-1.5 bg-white text-blue-600 rounded-md text-[11px] font-bold border border-blue-200 shadow-sm group-data-[collapsible=icon]:hidden">
                            {pendingCount}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ── Footer / Profile ────────────────────────── */}
      <SidebarFooter className="border-t border-[#E2E8F0] sm:bg-transparent bg-white group-data-[collapsible=icon]:p-0">
        <SidebarMenuButton
          asChild
          isActive={pathname === "/dashboard/profile"}
          tooltip={user?.name ?? "Profile"}
          size="lg"
          className={`rounded-xl transition-all duration-200 font-medium ${
            pathname === "/dashboard/profile"
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/20 hover:bg-blue-700"
              : "text-[#64748B] hover:bg-[#E2E8F0] hover:text-[#1E293B]"
          }`}
        >
          <Link
            to="/dashboard/profile"
            className="flex items-center gap-3 px-3 py-2 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:gap-0"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-xs font-bold text-white shadow-lg shadow-blue-600/20 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8">
              {user?.avatar ? (
                <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
              ) : (
                initials(user?.name)
              )}
            </div>
            <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden">
              <span className="truncate font-semibold text-sm">
                {user?.name ?? "Account"}
              </span>
              <span className="truncate text-xs font-medium opacity-70">
                {user?.role ?? "User"}
              </span>
            </div>
          </Link>
        </SidebarMenuButton>
      </SidebarFooter>
    </Sidebar>
  );
}

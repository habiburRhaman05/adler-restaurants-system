// import { useQuery } from '@tanstack/react-query';
// import { Users, CalendarRange, ArrowLeftRight, AlertTriangle } from 'lucide-react';

// import { useAuthStore } from '@/stores/auth.store';
// import { overviewService } from '@/features/overview/api/overview.service';
// import {
//   KpiCard,
//   PlanStatusCard,
//   PendingSwapsCard,
//   RecentStaffCard,
//   SnapshotCard,
//   OverviewHeader,
// } from '@/components/overview';

// // ─── Query keys ──────────────────────────────────────────────
// const overviewKeys = {
//   all: ['overview'] as const,
//   kpis: () => [...overviewKeys.all, 'kpis'] as const,
//   plans: () => [...overviewKeys.all, 'plans'] as const,
//   swaps: () => [...overviewKeys.all, 'swaps'] as const,
//   staff: () => [...overviewKeys.all, 'staff'] as const,
//   snapshot: () => [...overviewKeys.all, 'snapshot'] as const,
// };

// export function OverviewPage() {
//   const user = useAuthStore((s) => s.admin);
//   const firstName = user?.name?.split(' ')[0] ?? 'there';

//   // ── Each section loads independently with its own skeleton ──
//   const { data: kpis, isLoading: kpisLoading } = useQuery({
//     queryKey: overviewKeys.kpis(),
//     queryFn: overviewService.getOverviewData,
//     staleTime: 5 * 60 * 1000,
//   });

//   console.log(kpis);
  

//   const { data: plans, isLoading: plansLoading } = useQuery({
//     queryKey: overviewKeys.plans(),
//     queryFn: overviewService.getPlans,
//     staleTime: 5 * 60 * 1000,
//   });

//   const { data: swaps, isLoading: swapsLoading } = useQuery({
//     queryKey: overviewKeys.swaps(),
//     queryFn: overviewService.getSwaps,
//     staleTime: 5 * 60 * 1000,
//   });

//   const { data: staff, isLoading: staffLoading } = useQuery({
//     queryKey: overviewKeys.staff(),
//     queryFn: overviewService.getStaff,
//     staleTime: 5 * 60 * 1000,
//   });

//   const { data: snapshot, isLoading: snapshotLoading } = useQuery({
//     queryKey: overviewKeys.snapshot(),
//     queryFn: overviewService.getSnapshot,
//     staleTime: 5 * 60 * 1000,
//   });

//   return (
//     <div className="p-4 md:p-8 space-y-8 max-w-[1600px] mx-auto">
//       <OverviewHeader firstName={firstName} />

//       {/* ── KPI Cards ── */}
//       <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
//         <KpiCard
//           icon={Users}
//           label="Active Employees"
//           value={String(kpis?.activeEmployees ?? 0)}
//           hint={`${kpis?.totalEmployees ?? 0} total`}
//           loading={kpisLoading}
//         />
//         <KpiCard
//           icon={CalendarRange}
//           label="Plans"
//           value={String(kpis?.plansCount ?? 0)}
//           hint={`${kpis?.draftPlans ?? 0} draft`}
//           loading={kpisLoading}
//         />
//         <KpiCard
//           icon={ArrowLeftRight}
//           label="Pending Swaps"
//           value={String(kpis?.pendingSwaps ?? 0)}
//           hint="Waiting for review"
//           accent
//           loading={kpisLoading}
//         />
//         <KpiCard
//           icon={AlertTriangle}
//           label="Rule Violations"
//           value={String(kpis?.violations ?? 0)}
//           hint="Across all plans"
//           loading={kpisLoading}
//         />
//       </div>

//       {/* ── Main Content Grid ── */}
//       <div className="grid gap-6 lg:grid-cols-3">
//         <PlanStatusCard loading={plansLoading} plans={plans ?? []} />
//         <PendingSwapsCard loading={swapsLoading} swaps={swaps ?? []} />
//         <RecentStaffCard loading={staffLoading} staff={staff ?? []} />
//         <SnapshotCard loading={snapshotLoading} data={snapshot} />
//       </div>
//     </div>
//   );
// }




import { useQuery } from '@tanstack/react-query';
import { Users, CalendarRange, ArrowLeftRight, AlertTriangle } from 'lucide-react';

import { useAuthStore } from '@/stores/auth.store';
import { overviewService } from '@/features/overview/api/overview.service';
import {
  KpiCard,
  PendingSwapsCard,
  RecentStaffCard,
  SnapshotCard,
  AvailabilityCard,
  OverviewHeader,
} from '@/components/overview';

// ─── Query keys ──────────────────────────────────────────────
const overviewKeys = {
  all: ['overview'] as const,
  kpis: () => [...overviewKeys.all, 'kpis'] as const,
  plans: () => [...overviewKeys.all, 'plans'] as const,
  swaps: () => [...overviewKeys.all, 'swaps'] as const,
  staff: () => [...overviewKeys.all, 'staff'] as const,
  snapshot: () => [...overviewKeys.all, 'snapshot'] as const,
};

export function OverviewPage() {
  const user = useAuthStore((s) => s.admin);
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  // ── Single query for all overview data ──
  const { data: overviewData, isLoading } = useQuery({
    queryKey: overviewKeys.all,
    queryFn: overviewService.getOverviewData,
    staleTime: 5 * 60 * 1000,
  });

  const kpis = overviewData?.kpis;
  const swaps = overviewData?.swaps ?? [];
  const staff = overviewData?.staff ?? [];
  const availability = overviewData?.availability;

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-[1600px] mx-auto">
      <OverviewHeader firstName={firstName} />

      {/* ── KPI Cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Users}
          label="Active Employees"
          value={String(kpis?.employees?.active ?? 0)}
          hint={`${kpis?.employees?.total ?? 0} total`}
          loading={isLoading}
        />
        <KpiCard
          icon={CalendarRange}
          label="Upcoming Shifts"
          value={String(kpis?.shifts?.upcoming ?? 0)}
          hint={`${kpis?.shifts?.draft ?? 0} draft`}
          loading={isLoading}
        />
        <KpiCard
          icon={ArrowLeftRight}
          label="Pending Swaps"
          value={String(kpis?.swaps?.pending ?? 0)}
          hint="Waiting for review"
          accent
          loading={isLoading}
        />
        <KpiCard
          icon={AlertTriangle}
          label="Pending Approvals"
          value={String(kpis?.approvals?.pendingResponses ?? 0)}
          hint="Needs action"
          loading={isLoading}
        />
      </div>

      {/* ── Main Content Grid ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        <AvailabilityCard loading={isLoading} data={availability} />
        <RecentStaffCard loading={isLoading} staff={staff} />
        <PendingSwapsCard loading={isLoading} swaps={swaps} />
        <div className="lg:col-span-3">
          <SnapshotCard loading={isLoading} data={overviewData?.snapshot} />
        </div>
      </div>
    </div>
  );
}

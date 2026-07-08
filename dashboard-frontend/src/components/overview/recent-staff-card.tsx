import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { initials } from '@/lib/utils';
import type { StaffSummary } from '@/features/overview/api/overview.service';

interface RecentStaffCardProps {
  loading?: boolean;
  staff: StaffSummary[];
}

function StaffSkeleton() {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="h-3 w-36 rounded-md" />
        </div>
      </div>
      <Skeleton className="h-5 w-14 rounded-md" />
    </div>
  );
}

export function RecentStaffCard({ loading, staff }: RecentStaffCardProps) {
  return (
    <Card className="lg:col-span-1 col-span-6 rounded-2xl border-slate-200 shadow-sm bg-white overflow-hidden">
      <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
        <CardTitle className="text-lg font-bold text-slate-900">Recently Added Staff</CardTitle>
        <p className="text-sm font-medium text-slate-500 mt-1">Newest members of the team.</p>
      </CardHeader>
      <CardContent className="p-6 space-y-3">
        {loading && Array.from({ length: 4 }).map((_, i) => <StaffSkeleton key={i} />)}
        {!loading && staff.length === 0 && (
          <p className="text-slate-500 font-medium text-center py-6">No staff members yet.</p>
        )}
        {!loading && staff.slice(0, 4).map((e) => (
          <div
            key={e.id}
            className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0 border border-blue-200 overflow-hidden">
                {e.avatar ? (
                  <img src={e.avatar} alt={e.name} className="h-full w-full object-cover" />
                ) : (
                  initials(e.name)
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{e.name}</p>
                <p className="text-[11px] font-medium text-slate-500 truncate">{e.designation} · {e.department}</p>
              </div>
            </div>
            <Badge variant="outline" className="border-slate-200 text-slate-600 bg-slate-50">
              {e.status}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

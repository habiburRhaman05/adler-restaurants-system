import { Link } from 'react-router-dom';
import { ArrowRight, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { PlanSummary } from '@/features/overview/api/overview.service';

const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  submitted: { label: 'Submitted', cls: 'bg-amber-50 text-amber-600 border-amber-200' },
  approved: { label: 'Approved', cls: 'bg-blue-50 text-blue-600 border-blue-200' },
  rejected: { label: 'Rejected', cls: 'bg-rose-50 text-rose-600 border-rose-200' },
};

interface PlanStatusCardProps {
  loading?: boolean;
  plans: PlanSummary[];
}

function StatusBadge({ status }: { status: PlanSummary['status'] }) {
  const m = STATUS_META[status] ?? STATUS_META.draft;
  return <span className={`text-xs px-2.5 py-1 rounded-md font-bold border ${m.cls}`}>{m.label}</span>;
}

function PlanSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 p-4 bg-white">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24 rounded-md" />
          <Skeleton className="h-3 w-36 rounded-md" />
        </div>
        <Skeleton className="h-6 w-16 rounded-md" />
      </div>
      <Skeleton className="mt-3 h-8 w-full rounded-lg" />
    </div>
  );
}

export function PlanStatusCard({ loading, plans }: PlanStatusCardProps) {
  return (
    <Card className="lg:col-span-2 rounded-2xl border-slate-200 shadow-sm bg-white overflow-hidden">
      <CardHeader className="flex-row items-center justify-between bg-slate-50/50 border-b border-slate-100 pb-4">
        <div>
          <CardTitle className="text-lg font-bold text-slate-900">Plan Status</CardTitle>
          <p className="text-sm font-medium text-slate-500 mt-1">Weekly plans by status</p>
        </div>
        <Button variant="ghost" size="sm" asChild className="text-primary hover:text-primary hover:bg-primary/5">
          <Link to="/dashboard/plans/manage">
            Open <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 p-6">
        {loading && Array.from({ length: 4 }).map((_, i) => <PlanSkeleton key={i} />)}
        {!loading && plans.length === 0 && (
          <p className="text-slate-500 font-medium col-span-2 py-8 text-center">No plans yet. Create one to get started.</p>
        )}
        {!loading && plans.map((w) => (
          <Link
            key={w.id}
            to={`/dashboard/plan/${w.id}`}
            className="rounded-xl border border-slate-200 p-4 hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5 transition-all bg-white block"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-900">Week {w.weekNumber}</p>
                <p className="text-xs font-medium text-slate-500 mt-0.5">{w.dateRange.start} → {w.dateRange.end}</p>
              </div>
              <StatusBadge status={w.status} />
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-50 p-2 rounded-lg">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              {w.assignmentsCount} assignment{w.assignmentsCount !== 1 ? 's' : ''}
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

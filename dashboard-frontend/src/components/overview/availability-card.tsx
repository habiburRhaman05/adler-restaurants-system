import { CalendarCheck, Clock, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { AvailabilityData } from '@/features/overview/api/overview.service';

interface AvailabilityCardProps {
  loading?: boolean;
  data?: AvailabilityData;
}

function AvailabilitySkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32 rounded-md" />
        <Skeleton className="h-4 w-20 rounded-md" />
      </div>
      <Skeleton className="h-3 w-full rounded-full" />
      <div className="flex justify-between">
        <Skeleton className="h-10 w-20 rounded-lg" />
        <Skeleton className="h-10 w-20 rounded-lg" />
      </div>
    </div>
  );
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function AvailabilityCard({ loading, data }: AvailabilityCardProps) {
  const total = data?.total ?? 0;
  const submitted = data?.submitted ?? 0;
  const notSubmitted = data?.notSubmitted ?? 0;
  const monthName = data?.month ? MONTH_NAMES[data.month - 1] ?? 'Current' : 'Current';
  const pct = total > 0 ? Math.round((submitted / total) * 100) : 0;

  return (
    <Card className="rounded-2xl border-slate-200 shadow-sm bg-white overflow-hidden">
      <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-blue-600" />
            Monthly Availability
          </CardTitle>
          <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-3 py-1 rounded-full shadow-sm">
            {monthName} {data?.year ?? ''}
          </span>
        </div>
        <p className="text-sm font-medium text-slate-500 mt-1">
          Staff who have submitted their availability slots.
        </p>
      </CardHeader>
      <CardContent className="p-6">
        {loading ? (
          <AvailabilitySkeleton />
        ) : (
          <div className="space-y-5">
            {/* Progress bar */}
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-bold text-slate-700">{pct}% complete</span>
                <span className="font-medium text-slate-500">
                  {submitted} / {total} submitted
                </span>
              </div>
              <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 mb-2">
                  <CalendarCheck className="h-3.5 w-3.5" />
                  Submitted
                </div>
                <p className="text-2xl font-black text-slate-900 tracking-tight">{submitted}</p>
                <p className="text-xs font-medium text-slate-500 mt-1">
                  {pct}% of staff
                </p>
              </div>

              <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 mb-2">
                  <Clock className="h-3.5 w-3.5" />
                  Due
                </div>
                <p className="text-2xl font-black text-slate-900 tracking-tight">{notSubmitted}</p>
                <p className="text-xs font-medium text-slate-500 mt-1">
                  {total > 0 ? `${100 - pct}% of staff` : '—'}
                </p>
              </div>
            </div>

            {/* Footer hint */}
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 pt-1">
              <Users className="h-3.5 w-3.5" />
              {total} active employee{total !== 1 ? 's' : ''} total
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { Link } from 'react-router-dom';
import { ArrowLeftRight, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { SwapSummary } from '@/features/overview/api/overview.service';

interface PendingSwapsCardProps {
  loading?: boolean;
  swaps: SwapSummary[];
}

function SwapSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 p-3 bg-white">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-24 rounded-md" />
        <Skeleton className="h-3.5 w-3.5 rounded-full" />
        <Skeleton className="h-4 w-24 rounded-md" />
        <Skeleton className="ml-auto h-5 w-10 rounded-md" />
      </div>
      <Skeleton className="mt-2 h-3 w-32 rounded-md" />
    </div>
  );
}

export function PendingSwapsCard({ loading, swaps }: PendingSwapsCardProps) {
  return (
    <Card className="rounded-2xl lg:col-span-1 border-slate-200 shadow-sm bg-white overflow-hidden">
      <CardHeader className="flex-row items-center justify-between bg-slate-50/50 border-b border-slate-100 pb-4">
        <CardTitle className="text-lg font-bold text-slate-900">Pending Swaps</CardTitle>
        <Button variant="ghost" size="sm" asChild className="text-primary hover:text-primary hover:bg-primary/5">
          <Link to="/dashboard/approvals">
            All <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="p-6 space-y-3">
        {loading && Array.from({ length: 3 }).map((_, i) => <SwapSkeleton key={i} />)}
        {!loading && swaps.length === 0 && (
          <p className="text-slate-500 font-medium text-center py-6">No pending swaps.</p>
        )}
        {!loading && swaps.slice(0, 3).map((s) => (
          <div key={s.id} className="rounded-xl border border-slate-200 p-3 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-bold text-slate-900 truncate">{s.fromEmployeeName}</span>
              <ArrowLeftRight className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span className="font-bold text-slate-900 truncate">{s.toEmployeeName}</span>
              <Badge
                variant="outline"
                className={`ml-auto shrink-0 ${
                  s.ruleCheck === 'pass'
                    ? 'border-blue-200 text-blue-600 bg-blue-50'
                    : 'border-rose-200 text-rose-600 bg-rose-50'
                }`}
              >
                {s.ruleCheck === 'pass' ? 'OK' : 'Fail'}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-2">{s.day} · {s.time}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

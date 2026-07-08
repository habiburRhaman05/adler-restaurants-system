import { type LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
  loading?: boolean;
}

export function KpiCard({ icon: Icon, label, value, hint, accent, loading }: KpiCardProps) {
  return (
    <Card
      className={cn(
        'rounded-2xl shadow-sm bg-white border transition-all duration-200 hover:shadow-md hover:-translate-y-0.5',
        accent ? 'border-blue-400/40 ring-1 ring-blue-400/10' : 'border-slate-200'
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Icon className="h-4 w-4" />
          </span>
          {label}
        </div>
        {loading ? (
          <Skeleton className="mt-3 h-9 w-24 rounded-lg" />
        ) : (
          <p className="mt-3 text-3xl font-bold text-slate-900 tracking-tight">{value}</p>
        )}
        {loading ? (
          <Skeleton className="mt-2 h-3 w-28 rounded-md" />
        ) : (
          <p className="text-xs font-medium text-slate-500 mt-1">{hint}</p>
        )}
      </CardContent>
    </Card>
  );
}

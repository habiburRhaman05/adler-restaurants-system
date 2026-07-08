import { TrendingUp, DollarSign, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface SnapshotCardProps {
  loading?: boolean;
  data?: any; // Accepting the snapshot object from API
}

function SnapshotSkeleton() {
  return (
    <div className="flex flex-col md:flex-row gap-8">
      <div className="flex-1 space-y-4">
        <Skeleton className="h-[250px] w-full rounded-xl" />
      </div>
      <div className="w-full md:w-64 space-y-6">
        <div>
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div>
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-xl shadow-slate-900/5">
        <p className="font-medium text-slate-600 mb-1">{label}</p>
        <p className="font-bold text-slate-900 text-lg">
          {payload[0].value} <span className="text-sm font-medium text-slate-500">hours</span>
        </p>
      </div>
    );
  }
  return null;
};

export function SnapshotCard({ loading, data }: SnapshotCardProps) {
  const chartData = [
    { name: 'Scheduled', hours: data?.scheduledHours ?? 0, fill: '#3b82f6' }, // blue-500
    { name: 'Overtime', hours: data?.overtime ?? 0, fill: '#f59e0b' },      // amber-500
    { name: 'Hours Due', hours: data?.hoursDue ?? 0, fill: '#94a3b8' }      // slate-400
  ];

  return (
    <Card className="rounded-2xl border-slate-200 shadow-sm bg-white overflow-hidden">
      <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" /> 
            Weekly Snapshot
          </CardTitle>
          <span className="text-sm font-medium text-slate-500 bg-white border border-slate-200 px-3 py-1 rounded-full shadow-sm">
            Current Week
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-6 md:p-8">
        {loading ? (
          <SnapshotSkeleton />
        ) : (
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
            
            {/* Chart Area */}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-slate-500 mb-6 uppercase tracking-wider">Hours Breakdown</h3>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 13, fontWeight: 500 }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 13 }}
                    />
                    <Tooltip cursor={{ fill: '#f8fafc' }} content={<CustomTooltip />} />
                    <Bar 
                      dataKey="hours" 
                      radius={[6, 6, 0, 0]} 
                      barSize={48}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Summary Stats Area */}
            <div className="w-full lg:w-72 flex flex-col justify-center gap-8 border-t lg:border-t-0 lg:border-l border-slate-100 pt-8 lg:pt-0 lg:pl-12">
              
              <div>
                <div className="flex items-center gap-2 text-slate-500 mb-2">
                  <DollarSign className="h-4 w-4" />
                  <h3 className="text-sm font-bold uppercase tracking-wider">Total Wage Cost</h3>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-slate-900 tracking-tight">
                    ${(data?.wageCost ?? 0).toLocaleString()}
                  </span>
                  <span className="text-slate-500 font-medium text-sm">/ week</span>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 text-slate-500 mb-2">
                  <Clock className="h-4 w-4" />
                  <h3 className="text-sm font-bold uppercase tracking-wider">Total Scheduled</h3>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-slate-800 tracking-tight">
                    {data?.scheduledHours ?? 0}
                  </span>
                  <span className="text-slate-500 font-medium text-sm">hours</span>
                </div>
              </div>

            </div>

          </div>
        )}
      </CardContent>
    </Card>
  );
}

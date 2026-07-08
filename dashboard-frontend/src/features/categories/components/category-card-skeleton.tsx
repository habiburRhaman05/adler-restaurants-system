import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function CategoryCardSkeleton() {
  return (
    <Card className="rounded-2xl border-slate-200/80 shadow-md shadow-slate-100/50 bg-white overflow-hidden">
      <CardHeader className="flex-row items-center gap-4 bg-gradient-to-r from-slate-50 to-blue-50/40 border-b border-slate-100 pb-4">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-40" />
        </div>
        <Skeleton className="h-8 w-8 rounded-lg" />
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        <Skeleton className="h-4 w-full rounded-lg" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16 rounded-lg" />
          <Skeleton className="h-6 w-20 rounded-lg" />
          <Skeleton className="h-6 w-14 rounded-lg" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <Skeleton className="h-10 w-16 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}

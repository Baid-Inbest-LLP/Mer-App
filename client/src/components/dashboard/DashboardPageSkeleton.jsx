import Skeleton from '../common/Skeleton';
import ChartSkeleton from '../common/ChartSkeleton';
import StatCardsSkeleton from '../common/StatCardsSkeleton';

export default function DashboardPageSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-5">
      <StatCardsSkeleton count={5} gridClass="dashboard-grid-5" />
      <StatCardsSkeleton count={5} gridClass="dashboard-grid-5" />

      <div className="dashboard-grid-trend-company">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>

      <ChartSkeleton />

      <div className="dashboard-grid-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>

      <div className="dashboard-grid-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>

      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="divide-y divide-gray-100">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-6 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1">
                <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-28 mb-2" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

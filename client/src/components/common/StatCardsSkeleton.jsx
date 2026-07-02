import Skeleton from './Skeleton';

export function StatCardSkeleton() {
  return (
    <div className="card w-full p-3 sm:p-4 flex items-center gap-3 relative overflow-hidden">
      <Skeleton className="h-1 w-full absolute top-0 left-0 rounded-none" />
      <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
      <div className="flex-1 min-w-0">
        <Skeleton className="h-7 w-20 mb-2" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

export default function StatCardsSkeleton({ className = '', count = 4 }) {
  return (
    <div className={`dashboard-grid-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

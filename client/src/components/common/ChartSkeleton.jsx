import Skeleton from './Skeleton';

export default function ChartSkeleton({ className = '' }) {
  return (
    <div className={`card p-4 ${className}`}>
      <Skeleton className="h-6 w-48 mb-4" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

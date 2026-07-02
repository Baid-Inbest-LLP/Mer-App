import { Suspense } from 'react';
import ChartSkeleton from '../common/ChartSkeleton';

export function withChartSuspense(LazyComponent) {
  return function ChartWithSuspense(props) {
    return (
      <Suspense fallback={<ChartSkeleton />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

export function ChartSkeletonGrid({ count = 2, className = '' }) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <ChartSkeleton key={i} />
      ))}
    </div>
  );
}

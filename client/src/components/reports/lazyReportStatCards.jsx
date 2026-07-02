import { Suspense, lazy } from 'react';
import StatCardsSkeleton from '../common/StatCardsSkeleton';

export function withStatCardsSuspense(LazyComponent) {
  return function StatCardsWithSuspense(props) {
    return (
      <Suspense fallback={<StatCardsSkeleton className={props.className} />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

export const ReportSummaryStatCards = withStatCardsSuspense(
  lazy(() => import('./ReportSummaryStatCards')),
);

export const FinancialYearReportStatCards = withStatCardsSuspense(
  lazy(() => import('./FinancialYearReportStatCards')),
);

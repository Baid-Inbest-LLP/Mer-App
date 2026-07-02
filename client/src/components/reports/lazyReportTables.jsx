import { Suspense, lazy } from 'react';
import ReportOverviewTableSkeleton from '../common/ReportOverviewTableSkeleton';
import ExpenseHeadSummarySkeleton from '../common/ExpenseHeadSummarySkeleton';

export function withReportTableSuspense(LazyComponent, SkeletonComponent = ReportOverviewTableSkeleton) {
  return function ReportTableWithSuspense(props) {
    return (
      <Suspense fallback={<SkeletonComponent className={props.className} />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

export const MonthlyExpensesTable = withReportTableSuspense(
  lazy(() => import('./MonthlyExpensesTable')),
);

export const FinancialYearExpensesTable = withReportTableSuspense(
  lazy(() => import('./FinancialYearExpensesTable')),
);

export const ExpenseHeadSummaryTable = withReportTableSuspense(
  lazy(() => import('./ExpenseHeadSummaryTable')),
  ExpenseHeadSummarySkeleton,
);

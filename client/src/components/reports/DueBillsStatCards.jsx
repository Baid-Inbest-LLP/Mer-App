import StatCard from '../common/StatCard';
import StatCardsSkeleton from '../common/StatCardsSkeleton';
import { formatCurrency } from '../../utils/format';
import { reportStatIconClass as iconClass } from './reportStatIcons';
import { BILLS_MONTHLY_INFO, BILLS_SUMMARY_INFO } from './reportStatCardInfo';

const formatCount = (value) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(value) || 0);

const MonthlyCards = ({ summary }) => {
  const overdue = Number(summary?.overdue) || 0;
  const openBalance = Number(summary?.dueAndOverdue ?? summary?.outstanding) || 0;
  const due = Math.max(0, openBalance - overdue);

  return (
    <>
      <StatCard
        label="Billing Amount"
        value={formatCurrency(summary?.grossAmount)}
        color="text-amber-700"
        iconBg="bg-amber-100"
        accent="bg-amber-500"
        info={BILLS_MONTHLY_INFO.billingAmount}
        icon={
          <svg className={`${iconClass} text-amber-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        }
      />
      <StatCard
        label="No Of Bills"
        value={formatCount(summary?.entryCount)}
        color="text-blue-700"
        iconBg="bg-blue-100"
        accent="bg-blue-500"
        info={BILLS_MONTHLY_INFO.noOfBills}
        icon={
          <svg className={`${iconClass} text-blue-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
        }
      />
      <StatCard
        label="Paid"
        value={formatCurrency(summary?.amountPaid)}
        color="text-emerald-700"
        iconBg="bg-emerald-100"
        accent="bg-emerald-500"
        info={BILLS_MONTHLY_INFO.paid}
        icon={
          <svg className={`${iconClass} text-emerald-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />
      <StatCard
        label="Overdue"
        value={formatCurrency(overdue)}
        color="text-red-700"
        iconBg="bg-red-100"
        accent="bg-red-500"
        info={BILLS_MONTHLY_INFO.overdue}
        icon={
          <svg className={`${iconClass} text-red-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        }
      />
      <StatCard
        label="Upcoming Due"
        value={formatCurrency(due)}
        color="text-orange-700"
        iconBg="bg-orange-100"
        accent="bg-orange-500"
        info={BILLS_MONTHLY_INFO.upcomingDue}
        icon={
          <svg className={`${iconClass} text-orange-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />
    </>
  );
};

const SummaryCards = ({ summary }) => {
  const gross = Number(summary?.grossAmount) || 0;
  const paid = Number(summary?.amountPaid) || 0;
  const collectionRate = gross > 0 ? (paid / gross) * 100 : 0;

  return (
    <>
      <StatCard
        label="Total Outstanding"
        value={formatCurrency(summary?.outstanding)}
        color="text-amber-700"
        iconBg="bg-amber-100"
        accent="bg-amber-500"
        info={BILLS_SUMMARY_INFO.totalOutstanding}
        icon={
          <svg className={`${iconClass} text-amber-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />
      <StatCard
        label="Overdue Amount"
        value={formatCurrency(summary?.overdue)}
        color="text-red-700"
        iconBg="bg-red-100"
        accent="bg-red-500"
        info={BILLS_SUMMARY_INFO.overdueAmount}
        icon={
          <svg className={`${iconClass} text-red-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        }
      />
      <StatCard
        label="Open Bills"
        value={formatCount(summary?.openCount)}
        color="text-blue-700"
        iconBg="bg-blue-100"
        accent="bg-blue-500"
        info={BILLS_SUMMARY_INFO.openBills}
        icon={
          <svg className={`${iconClass} text-blue-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012 2v2M7 7h10" />
          </svg>
        }
      />
      <StatCard
        label="Collection Rate"
        value={`${collectionRate.toFixed(1)}%`}
        color="text-emerald-700"
        iconBg="bg-emerald-100"
        accent="bg-emerald-500"
        info={BILLS_SUMMARY_INFO.collectionRate}
        icon={
          <svg className={`${iconClass} text-emerald-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
          </svg>
        }
      />
    </>
  );
};

export default function DueBillsStatCards({
  className = 'mb-4',
  loading,
  summary,
  variant = 'monthly',
}) {
  const isMonthly = variant !== 'summary';
  const gridClass = isMonthly ? 'dashboard-grid-5' : 'dashboard-grid-4';

  if (loading && !summary) {
    return (
      <StatCardsSkeleton
        className={className}
        count={isMonthly ? 5 : 4}
        gridClass={gridClass}
      />
    );
  }

  return (
    <div className={`${gridClass} ${className}`}>
      {isMonthly ? (
        <MonthlyCards summary={summary} />
      ) : (
        <SummaryCards summary={summary} />
      )}
    </div>
  );
}

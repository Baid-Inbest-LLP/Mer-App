import StatCard from '../common/StatCard';
import StatCardsSkeleton from '../common/StatCardsSkeleton';
import { formatCount, formatCurrency } from '../../utils/format';
import { reportStatIconClass as iconClass } from './reportStatIcons';
import { BILLS_MONTHLY_INFO } from './reportStatCardInfo';

export default function DueBillsStatCards({
  className = 'mb-4',
  loading,
  summary,
}) {
  const overdue = Number(summary?.overdue) || 0;
  const openBalance = Number(summary?.dueAndOverdue ?? summary?.outstanding) || 0;
  const due = Math.max(0, openBalance - overdue);

  if (loading && !summary) {
    return (
      <StatCardsSkeleton
        className={className}
        count={5}
        gridClass="dashboard-grid-5"
      />
    );
  }

  return (
    <div className={`dashboard-grid-5 ${className}`}>
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
    </div>
  );
}

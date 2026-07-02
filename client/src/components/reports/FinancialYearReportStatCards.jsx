import StatCard from '../common/StatCard';
import StatCardsSkeleton from '../common/StatCardsSkeleton';
import { formatCurrency, formatPercent } from '../../utils/format';
import { reportStatIconClass as iconClass } from './reportStatIcons';

export default function FinancialYearReportStatCards({
  className = 'mb-4',
  loading,
  fyTotal,
  totalEntries,
  peakQuarter,
  yoyChange,
}) {
  if (loading) {
    return <StatCardsSkeleton className={className} />;
  }

  return (
    <div className={`dashboard-grid-4 ${className}`}>
      <StatCard
        label="FY Total Expense"
        value={formatCurrency(fyTotal || 0)}
        color="text-purple-700"
        iconBg="bg-purple-100"
        accent="bg-purple-500"
        icon={
          <svg className={`${iconClass} text-purple-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        }
      />
      <StatCard
        label="Total Entries"
        value={totalEntries}
        color="text-amber-700"
        iconBg="bg-amber-100"
        accent="bg-amber-500"
        icon={
          <svg className={`${iconClass} text-amber-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />
      <StatCard
        label={peakQuarter?.name ? `Peak Quarter (${peakQuarter.name})` : 'Peak Quarter'}
        value={formatCurrency(peakQuarter?.value)}
        color="text-indigo-700"
        iconBg="bg-indigo-100"
        accent="bg-indigo-500"
        icon={
          <svg className={`${iconClass} text-indigo-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        }
      />
      <StatCard
        label="YoY Change"
        value={formatPercent(yoyChange)}
        color={yoyChange >= 0 ? 'text-red-700' : 'text-emerald-700'}
        iconBg={yoyChange >= 0 ? 'bg-red-100' : 'bg-emerald-100'}
        accent={yoyChange >= 0 ? 'bg-red-500' : 'bg-emerald-500'}
        icon={
          <svg className={`${iconClass} ${yoyChange >= 0 ? 'text-red-600' : 'text-emerald-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        }
      />
    </div>
  );
}

import StatCard from '../common/StatCard';
import StatCardsSkeleton from '../common/StatCardsSkeleton';
import { formatCount, formatCurrency, formatPercent } from '../../utils/format';
import { reportStatIconClass as iconClass } from './reportStatIcons';
import { FY_INFO } from './reportStatCardInfo';

export default function FinancialYearReportStatCards({
  className = 'mb-4',
  loading,
  fyTotal,
  totalEntries,
  peakQuarter,
  yoyChange,
  paymentRate,
  isDue = false,
}) {
  const showPaymentRate = !isDue;
  const gridClass = showPaymentRate ? 'dashboard-grid-5' : 'dashboard-grid-4';
  const totalLabel = isDue ? 'Billing Amount' : 'Total Expense';
  const entriesLabel = isDue ? 'No Of Bills' : 'No Of Expenses';

  if (loading) {
    return (
      <StatCardsSkeleton
        className={className}
        count={showPaymentRate ? 5 : 4}
        gridClass={gridClass}
      />
    );
  }

  return (
    <div className={`${gridClass} ${className}`}>
      <StatCard
        label={totalLabel}
        value={formatCurrency(fyTotal || 0)}
        color={isDue ? 'text-amber-700' : 'text-purple-700'}
        iconBg={isDue ? 'bg-amber-100' : 'bg-purple-100'}
        accent={isDue ? 'bg-amber-500' : 'bg-purple-500'}
        info={isDue ? FY_INFO.fyBillingAmount : FY_INFO.fyTotalExpense}
        icon={
          <svg className={`${iconClass} ${isDue ? 'text-amber-600' : 'text-purple-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        }
      />
      <StatCard
        label={entriesLabel}
        value={formatCount(totalEntries)}
        color="text-blue-700"
        iconBg="bg-blue-100"
        accent="bg-blue-500"
        info={isDue ? FY_INFO.totalFyBills : FY_INFO.totalEntries}
        icon={
          <svg className={`${iconClass} text-blue-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
        }
      />
      <StatCard
        label={peakQuarter?.name ? `Peak Quarter (${peakQuarter.name})` : 'Peak Quarter'}
        value={formatCurrency(peakQuarter?.value)}
        color="text-indigo-700"
        iconBg="bg-indigo-100"
        accent="bg-indigo-500"
        info={FY_INFO.peakQuarter}
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
        info={isDue ? FY_INFO.yoyChangeBills : FY_INFO.yoyChange}
        icon={
          <svg className={`${iconClass} ${yoyChange >= 0 ? 'text-red-600' : 'text-emerald-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        }
      />
      {showPaymentRate && (
        <StatCard
          label="Payment Rate"
          value={`${Number(paymentRate || 0).toFixed(1)}%`}
          color="text-emerald-700"
          iconBg="bg-emerald-100"
          accent="bg-emerald-500"
          info={FY_INFO.paymentRate}
          icon={
            <svg className={`${iconClass} text-emerald-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
            </svg>
          }
        />
      )}
    </div>
  );
}

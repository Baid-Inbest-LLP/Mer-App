import StatCard from '../common/StatCard';
import StatCardsSkeleton from '../common/StatCardsSkeleton';
import { formatCurrency } from '../../utils/format';
import { reportStatIconClass as iconClass } from './reportStatIcons';

export default function ReportSummaryStatCards({ className = 'mb-4', loading, summary }) {
  if (loading && !summary) {
    return <StatCardsSkeleton className={className} />;
  }

  return (
    <div className={`dashboard-grid-4 ${className}`}>
      <StatCard
        label="Gross Amount"
        value={formatCurrency(summary?.grossAmount)}
        color="text-indigo-700"
        iconBg="bg-indigo-100"
        accent="bg-indigo-500"
        icon={
          <svg className={`${iconClass} text-indigo-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        }
      />
      <StatCard
        label="Total Net"
        value={formatCurrency(summary?.totalNetAmount)}
        color="text-blue-700"
        iconBg="bg-blue-100"
        accent="bg-blue-500"
        icon={
          <svg className={`${iconClass} text-blue-600`} viewBox="0 0 320 512" fill="currentColor">
            <path d="M308 96c6.627 0 12-5.373 12-12V44c0-6.627-5.373-12-12-12H12C5.373 32 0 37.373 0 44v44.748c0 6.627 5.373 12 12 12h85.28c27.308 0 48.261 9.958 60.97 27.252H12c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h158.757c-6.217 36.086-36.075 58.952-72.757 58.952H12c-6.627 0-12 5.373-12 12v53.012c0 3.349 1.4 6.546 3.861 8.818l165.052 152.356a12.001 12.001 0 0 0 8.139 3.182h82.562c10.924 0 16.166-13.408 8.139-20.818L116.871 319.906c76.499-2.34 131.144-53.395 138.318-127.906H308c6.627 0 12-5.373 12-12v-40c0-6.627-5.373-12-12-12h-48.19c-3.003-11.891-7.922-23.738-14.932-34H308z" />
          </svg>
        }
      />
      <StatCard
        label="Total GST"
        value={formatCurrency(summary?.totalGST)}
        color="text-emerald-700"
        iconBg="bg-emerald-100"
        accent="bg-emerald-500"
        icon={
          <svg className={`${iconClass} text-emerald-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
          </svg>
        }
      />
      <StatCard
        label="Total TDS"
        value={formatCurrency(summary?.totalTDS)}
        color="text-orange-700"
        iconBg="bg-orange-100"
        accent="bg-orange-500"
        icon={
          <svg className={`${iconClass} text-orange-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
          </svg>
        }
      />
    </div>
  );
}

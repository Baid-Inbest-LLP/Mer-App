import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchDashboard, chartThunkByKey } from '../../store/slices/dashboardSlice';
import StatCard from '../../components/common/StatCard';
import Skeleton from '../../components/common/Skeleton';
import ExpenseTrendChart from '../../components/charts/ExpenseTrendChart';
import CompanyWiseChart from '../../components/charts/CompanyWiseChart';
import PieChartCard from '../../components/charts/PieChartCard';
import BarChartCard from '../../components/charts/BarChartCard';
import RecentMerEntries from '../../components/dashboard/RecentMerEntries';
import { formatCurrency, formatPercent } from '../../utils/format';

const iconClass =
  'w-5 h-5 sm:w-6 sm:h-6 xl:w-7 xl:h-7 max-[1660px]:w-6 max-[1660px]:h-6 max-[1536px]:w-5 max-[1536px]:h-5 max-[1366px]:w-[18px] max-[1366px]:h-[18px] max-[1280px]:w-4 max-[1280px]:h-4';

export default function DashboardPage() {
  const dispatch = useDispatch();
  const { data, loading, chartLoading } = useSelector((state) => state.dashboard);
  const kpis = data?.kpis;
  const [monthOverrides, setMonthOverrides] = useState({});

  useEffect(() => {
    dispatch(fetchDashboard());
  }, [dispatch]);

  const resolvedMonths = {
    company: monthOverrides.company ?? data?.selectedMonths?.company ?? '',
    expenseTypes: monthOverrides.expenseTypes ?? data?.selectedMonths?.expenseTypes ?? '',
    paymentMethods: monthOverrides.paymentMethods ?? data?.selectedMonths?.paymentMethods ?? '',
    head: monthOverrides.head ?? data?.selectedMonths?.head ?? '',
  };

  const handleChartMonthChange = (key, value) => {
    setMonthOverrides((prev) => ({ ...prev, [key]: value }));
    dispatch(chartThunkByKey[key]({ month: value }));
  };

  const monthOptions = data?.fyMonthOptions;
  const monthProps = (key) => ({
    fyMonthOptions: monthOptions,
    selectedMonth: resolvedMonths[key],
    onMonthChange: (val) => handleChartMonthChange(key, val),
  });

  if (loading && !data) {
    return (
      <div className="space-y-4 sm:space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4 flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="flex-1">
                <Skeleton className="h-5 w-16 mb-2" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="dashboard-grid-4">
        <StatCard
          label="FY Expense"
          value={formatCurrency(kpis?.financialYearExpense)}
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
          label="This Month Expense"
          value={formatCurrency(kpis?.thisMonthExpense)}
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
          label="Monthly Change"
          value={formatPercent(kpis?.monthlyExpenseChange)}
          color={kpis?.monthlyExpenseChange >= 0 ? 'text-red-700' : 'text-emerald-700'}
          iconBg={kpis?.monthlyExpenseChange >= 0 ? 'bg-red-100' : 'bg-emerald-100'}
          accent={kpis?.monthlyExpenseChange >= 0 ? 'bg-red-500' : 'bg-emerald-500'}
          icon={
            <svg className={`${iconClass} ${kpis?.monthlyExpenseChange >= 0 ? 'text-red-600' : 'text-emerald-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
        />
        <StatCard
          label="Pending Entries"
          value={kpis?.pendingEntries ?? 0}
          color="text-amber-700"
          iconBg="bg-amber-100"
          accent="bg-amber-500"
          icon={
            <svg className={`${iconClass} text-amber-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      <div className="dashboard-grid-trend-company">
        <ExpenseTrendChart data={data?.trends} loading={loading} />
        <CompanyWiseChart
          data={data?.companyChart}
          loading={chartLoading.company}
          {...monthProps('company')}
        />
      </div>

      <div className="dashboard-grid-2">
        <PieChartCard
          data={data?.expenseTypes}
          loading={chartLoading.expenseTypes}
          title="Revenue vs Capital"
          {...monthProps('expenseTypes')}
        />
        <PieChartCard
          data={data?.paymentMethods}
          loading={chartLoading.paymentMethods}
          title="Bank vs Cash"
          {...monthProps('paymentMethods')}
        />
      </div>

      <div className="dashboard-grid-2">
        <BarChartCard
          data={data?.headAnalytics?.slice(0, 8)}
          loading={chartLoading.head}
          title="Expense Head Distribution"
          {...monthProps('head')}
        />
        <BarChartCard
          data={data?.quarterly?.map((q) => ({ name: q.quarter, value: q.total }))}
          loading={loading}
          title="Quarterly Overview"
          xKey="name"
        />
      </div>

      <RecentMerEntries entries={data?.recentEntries} loading={loading} />
    </div>
  );
}

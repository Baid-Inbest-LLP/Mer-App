import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchDashboard, chartThunkByKey } from '../../store/slices/dashboardSlice';
import StatCard from '../../components/common/StatCard';
import DashboardPageSkeleton from '../../components/dashboard/DashboardPageSkeleton';
import {
  ExpenseTrendChart,
  CompanyWiseChart,
  DaysToClearChart,
  PieChartCard,
  BarChartCard,
} from '../../components/charts/lazyCharts';
import RecentMerEntries from '../../components/dashboard/RecentMerEntries';
import { formatCurrency, formatPercent } from '../../utils/format';
import { DASHBOARD_INFO } from '../../components/reports/reportStatCardInfo';
import { getRecentFinancialYearOptions } from '../../utils/financialYear';

const iconClass =
  'w-5 h-5 sm:w-6 sm:h-6 xl:w-7 xl:h-7 max-[1660px]:w-6 max-[1660px]:h-6 max-[1536px]:w-5 max-[1536px]:h-5 max-[1366px]:w-[18px] max-[1366px]:h-[18px] max-[1280px]:w-4 max-[1280px]:h-4';

const MONTH_CHART_KEYS = new Set(['company', 'expenseTypes', 'paymentMethods', 'head']);

const changeTone = (value) => {
  const up = Number(value) >= 0;
  return {
    color: up ? 'text-red-700' : 'text-emerald-700',
    iconBg: up ? 'bg-red-100' : 'bg-emerald-100',
    accent: up ? 'bg-red-500' : 'bg-emerald-500',
    iconColor: up ? 'text-red-600' : 'text-emerald-600',
  };
};

const trendIcon = (className) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

export default function DashboardPage() {
  const dispatch = useDispatch();
  const { data, loading, chartLoading } = useSelector((state) => state.dashboard);
  const { lookups } = useSelector((state) => state.common);
  const kpis = data?.kpis;
  const [monthOverrides, setMonthOverrides] = useState({});
  const [fyOverrides, setFyOverrides] = useState({});

  useEffect(() => {
    dispatch(fetchDashboard());
  }, [dispatch]);

  const fyOptions = useMemo(
    () => getRecentFinancialYearOptions(
      lookups?.currentFinancialYear || data?.currentFinancialYear || kpis?.currentFinancialYear,
      2,
    ),
    [lookups?.currentFinancialYear, data?.currentFinancialYear, kpis?.currentFinancialYear],
  );

  const resolvedMonths = {
    company: monthOverrides.company ?? data?.selectedMonths?.company ?? '',
    expenseTypes: monthOverrides.expenseTypes ?? data?.selectedMonths?.expenseTypes ?? '',
    paymentMethods: monthOverrides.paymentMethods ?? data?.selectedMonths?.paymentMethods ?? '',
    head: monthOverrides.head ?? data?.selectedMonths?.head ?? '',
  };

  const resolvedFys = {
    company: fyOverrides.company ?? data?.selectedFys?.company ?? '',
    expenseTypes: fyOverrides.expenseTypes ?? data?.selectedFys?.expenseTypes ?? '',
    paymentMethods: fyOverrides.paymentMethods ?? data?.selectedFys?.paymentMethods ?? '',
    head: fyOverrides.head ?? data?.selectedFys?.head ?? '',
    trends: fyOverrides.trends ?? data?.selectedFys?.trends ?? '',
    daysToClear: fyOverrides.daysToClear ?? data?.selectedFys?.daysToClear ?? '',
    quarterly: fyOverrides.quarterly ?? data?.selectedFys?.quarterly ?? '',
  };

  const handleChartMonthChange = (key, value) => {
    setMonthOverrides((prev) => ({ ...prev, [key]: value }));
    dispatch(chartThunkByKey[key]({
      month: value,
      financialYear: resolvedFys[key] || undefined,
    }));
  };

  const handleChartFyChange = (key, value) => {
    setFyOverrides((prev) => ({ ...prev, [key]: value }));
    if (MONTH_CHART_KEYS.has(key)) {
      setMonthOverrides((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      dispatch(chartThunkByKey[key]({ financialYear: value }));
      return;
    }
    dispatch(chartThunkByKey[key]({ financialYear: value }));
  };

  const monthProps = (key) => ({
    fyMonthOptions: data?.chartMonthOptions?.[key] || data?.fyMonthOptions || [],
    selectedMonth: resolvedMonths[key],
    onMonthChange: (val) => handleChartMonthChange(key, val),
    fyOptions,
    selectedFy: resolvedFys[key],
    onFyChange: (val) => handleChartFyChange(key, val),
  });

  const fyOnlyProps = (key) => ({
    fyOptions,
    selectedFy: resolvedFys[key],
    onFyChange: (val) => handleChartFyChange(key, val),
  });

  if (loading && !data) {
    return <DashboardPageSkeleton />;
  }

  const yearlyTone = changeTone(kpis?.yearlyExpenseChange);
  const monthlyTone = changeTone(kpis?.monthlyExpenseChange);

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="dashboard-grid-5">
        <StatCard
          label="FY Billing Amount"
          value={formatCurrency(kpis?.fyBillingAmount)}
          color="text-amber-700"
          iconBg="bg-amber-100"
          accent="bg-amber-500"
          info={DASHBOARD_INFO.fyBillingAmount}
          icon={
            <svg className={`${iconClass} text-amber-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
        <StatCard
          label="FY Expense"
          value={formatCurrency(kpis?.financialYearExpense)}
          color="text-purple-700"
          iconBg="bg-purple-100"
          accent="bg-purple-500"
          info={DASHBOARD_INFO.fyExpense}
          icon={
            <svg className={`${iconClass} text-purple-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />
        <StatCard
          label="Yearly Change"
          value={formatPercent(kpis?.yearlyExpenseChange)}
          color={yearlyTone.color}
          iconBg={yearlyTone.iconBg}
          accent={yearlyTone.accent}
          info={DASHBOARD_INFO.yearlyChange}
          icon={trendIcon(`${iconClass} ${yearlyTone.iconColor}`)}
        />
        <StatCard
          label="Monthly Change"
          value={formatPercent(kpis?.monthlyExpenseChange)}
          color={monthlyTone.color}
          iconBg={monthlyTone.iconBg}
          accent={monthlyTone.accent}
          info={DASHBOARD_INFO.monthlyChange}
          icon={trendIcon(`${iconClass} ${monthlyTone.iconColor}`)}
        />
        <StatCard
          label="Payment Rate"
          value={`${Number(kpis?.paymentRate || 0).toFixed(1)}%`}
          color="text-emerald-700"
          iconBg="bg-emerald-100"
          accent="bg-emerald-500"
          info={DASHBOARD_INFO.paymentRate}
          icon={
            <svg className={`${iconClass} text-emerald-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
            </svg>
          }
        />
      </div>

      <div className="dashboard-grid-5">
        <StatCard
          label="This Month Expense"
          value={formatCurrency(kpis?.thisMonthExpense)}
          color="text-blue-700"
          iconBg="bg-blue-100"
          accent="bg-blue-500"
          info={DASHBOARD_INFO.thisMonthExpense}
          icon={
            <svg className={`${iconClass} text-blue-600`} viewBox="0 0 320 512" fill="currentColor">
              <path d="M308 96c6.627 0 12-5.373 12-12V44c0-6.627-5.373-12-12-12H12C5.373 32 0 37.373 0 44v44.748c0 6.627 5.373 12 12 12h85.28c27.308 0 48.261 9.958 60.97 27.252H12c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h158.757c-6.217 36.086-36.075 58.952-72.757 58.952H12c-6.627 0-12 5.373-12 12v53.012c0 3.349 1.4 6.546 3.861 8.818l165.052 152.356a12.001 12.001 0 0 0 8.139 3.182h82.562c10.924 0 16.166-13.408 8.139-20.818L116.871 319.906c76.499-2.34 131.144-53.395 138.318-127.906H308c6.627 0 12-5.373 12-12v-40c0-6.627-5.373-12-12-12h-48.19c-3.003-11.891-7.922-23.738-14.932-34H308z" />
            </svg>
          }
        />
        <StatCard
          label="Paid This Month"
          value={formatCurrency(kpis?.paidThisMonth)}
          color="text-teal-700"
          iconBg="bg-teal-100"
          accent="bg-teal-500"
          info={DASHBOARD_INFO.paidThisMonth}
          icon={
            <svg className={`${iconClass} text-teal-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          }
        />
        <StatCard
          label="Overdue"
          value={formatCurrency(kpis?.overdue)}
          color="text-red-700"
          iconBg="bg-red-100"
          accent="bg-red-500"
          info={DASHBOARD_INFO.overdue}
          icon={
            <svg className={`${iconClass} text-red-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
        />
        <StatCard
          label="Pending Payment"
          value={new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(
            Number(kpis?.pendingPayment) || 0,
          )}
          color="text-orange-700"
          iconBg="bg-orange-100"
          accent="bg-orange-500"
          info={DASHBOARD_INFO.pendingPayment}
          icon={
            <svg className={`${iconClass} text-orange-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="Pending Approvals"
          value={new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(
            Number(kpis?.pendingApprovals ?? kpis?.pendingEntries) || 0,
          )}
          color="text-rose-700"
          iconBg="bg-rose-100"
          accent="bg-rose-500"
          info={DASHBOARD_INFO.pendingApprovals}
          icon={
            <svg className={`${iconClass} text-rose-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      <div className="dashboard-grid-trend-company">
        <ExpenseTrendChart
          data={data?.trends}
          loading={loading || chartLoading.trends}
          {...fyOnlyProps('trends')}
        />
        <CompanyWiseChart
          data={data?.companyChart}
          loading={chartLoading.company}
          {...monthProps('company')}
        />
      </div>

      <DaysToClearChart
        data={data?.daysToClear}
        loading={loading || chartLoading.daysToClear}
        {...fyOnlyProps('daysToClear')}
      />

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
          loading={loading || chartLoading.quarterly}
          title="Quarterly Overview"
          xKey="name"
          {...fyOnlyProps('quarterly')}
        />
      </div>

      <RecentMerEntries entries={data?.recentEntries} loading={loading} />
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  fetchReportSummary,
  fetchMonthlyReport,
  clearReport,
} from '../../store/slices/reportSlice';
import PageBanner from '../../components/common/PageBanner';
import { BarChartCard } from '../../components/charts/lazyCharts';
import { ChartSkeletonGrid } from '../../components/charts/LazyChartBoundary';
import { MonthlyExpensesTable } from '../../components/reports/lazyReportTables';
import { DueBillsStatCards, ReportSummaryStatCards } from '../../components/reports/lazyReportStatCards';
import { getRecentFinancialYearOptions, FY_MONTH_ORDER } from '../../utils/financialYear';
import { reportApi } from '../../api/report.api';
import {
  isDueReportScope,
  normalizeReportScope,
  reportScopeLabels,
  withReportScope,
} from '../../utils/reportScope';

const CURRENT_MONTH = new Date().toLocaleString('en-US', { month: 'long' });

const mapMonthly = (items = []) => {
  const byMonth = new Map();

  for (const item of items) {
    if (item.merType && item.merType !== 'combined') continue;
    const month = item.month || item._id;
    if (!month) continue;

    const prev = byMonth.get(month) || {
      name: month,
      value: 0,
      net: 0,
      gst: 0,
      tds: 0,
      gross: 0,
      outstanding: 0,
      amountPaid: 0,
      count: 0,
    };
    const amount = item.gross ?? item.total ?? 0;

    byMonth.set(month, {
      name: month,
      value: prev.value + amount,
      net: prev.net + (item.net ?? 0),
      gst: prev.gst + (item.gst ?? 0),
      tds: prev.tds + (item.tds ?? 0),
      gross: prev.gross + (item.gross ?? item.total ?? 0),
      outstanding: prev.outstanding + (item.outstanding ?? 0),
      amountPaid: prev.amountPaid + (item.amountPaid ?? 0),
      count: prev.count + (item.count ?? 0),
    });
  }

  return [...byMonth.values()];
};

const filterMonthlyForFy = (items, fy, currentFY) => {
  const isCurrentFY = fy === currentFY;
  const currentIdx = FY_MONTH_ORDER.indexOf(CURRENT_MONTH);
  return items
    .filter((m) => {
      const idx = FY_MONTH_ORDER.indexOf(m.name);
      if (idx === -1) return false;
      return isCurrentFY ? idx <= currentIdx : true;
    })
    .sort((a, b) => FY_MONTH_ORDER.indexOf(a.name) - FY_MONTH_ORDER.indexOf(b.name));
};

const PREV_MONTH_BAR_COLOR = '#94a3b8';
const CURRENT_MONTH_BAR_COLOR = '#3b82f6';
const DUE_PREV_MONTH_BAR_COLOR = '#fcd34d';
const DUE_CURRENT_MONTH_BAR_COLOR = '#f59e0b';

const buildMomComparison = (items = [], due = false) => {
  const byName = Object.fromEntries(items.map((item) => [item.name, item]));
  const currentIdx = FY_MONTH_ORDER.indexOf(CURRENT_MONTH);
  const prevMonth = currentIdx > 0 ? FY_MONTH_ORDER[currentIdx - 1] : null;

  const chart = [];
  if (prevMonth) {
    const previous = byName[prevMonth];
    chart.push({
      name: prevMonth,
      value: previous?.value ?? previous?.gross ?? 0,
      count: previous?.count ?? 0,
      color: due ? DUE_PREV_MONTH_BAR_COLOR : PREV_MONTH_BAR_COLOR,
    });
  }
  const current = byName[CURRENT_MONTH];
  chart.push({
    name: CURRENT_MONTH,
    value: current?.value ?? current?.gross ?? 0,
    count: current?.count ?? 0,
    color: due ? DUE_CURRENT_MONTH_BAR_COLOR : CURRENT_MONTH_BAR_COLOR,
  });
  return chart;
};

export default function MonthlyReportPage() {
  const dispatch = useDispatch();
  const { reportScope: rawScope } = useParams();
  const scope = normalizeReportScope(rawScope) || 'expenses';
  const isDue = isDueReportScope(scope);
  const labels = reportScopeLabels(scope);
  const [searchParams] = useSearchParams();
  const { lookups } = useSelector((state) => state.common);
  const currentFY = lookups?.currentFinancialYear;
  const { summary, monthlyReport, monthlyReportLoading, loading } = useSelector((state) => state.report);
  const [tableFY, setTableFY] = useState(null);
  const [monthlyFy, setMonthlyFy] = useState('');
  const [momComparisonChart, setMomComparisonChart] = useState([]);
  const [monthlyChart, setMonthlyChart] = useState([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [monthlyChartLoading, setMonthlyChartLoading] = useState(false);

  const activeTableFY = tableFY || currentFY;
  const resolvedMonthlyFy = monthlyFy || currentFY;
  const initialMonth = searchParams.get('month') || null;

  useEffect(() => {
    dispatch(clearReport());
  }, [dispatch, scope]);

  useEffect(() => {
    if (!currentFY) return;
    dispatch(fetchReportSummary(withReportScope({
      financialYear: currentFY,
      month: CURRENT_MONTH,
    }, scope)));
  }, [dispatch, scope, currentFY]);

  useEffect(() => {
    if (!activeTableFY) return;
    dispatch(fetchMonthlyReport(withReportScope({ financialYear: activeTableFY }, scope)));
  }, [dispatch, activeTableFY, scope]);

  const fyOptions = useMemo(
    () => getRecentFinancialYearOptions(lookups?.currentFinancialYear, 2),
    [lookups?.currentFinancialYear],
  );

  const momChangePercent = useMemo(() => {
    if (momComparisonChart.length < 2) return null;
    const prev = momComparisonChart[0]?.value ?? 0;
    const curr = momComparisonChart[momComparisonChart.length - 1]?.value ?? 0;
    if (prev <= 0) return 0;
    return Math.round(((curr - prev) / prev) * 1000) / 10;
  }, [momComparisonChart]);

  const visibleMonthlyRows = useMemo(() => {
    const isCurrentFY = activeTableFY === currentFY;
    const currentIdx = FY_MONTH_ORDER.indexOf(CURRENT_MONTH);
    return monthlyReport.filter((row) => {
      const idx = FY_MONTH_ORDER.indexOf(row.month);
      if (idx === -1) return false;
      return isCurrentFY ? idx <= currentIdx : true;
    });
  }, [monthlyReport, activeTableFY, currentFY]);

  const loadMonthlyChart = useCallback(async (fy) => {
    if (!fy) return;

    setMonthlyChartLoading(true);
    try {
      const { data } = await reportApi.monthly(withReportScope({ financialYear: fy }, scope));
      setMonthlyChart(filterMonthlyForFy(mapMonthly(data.data), fy, currentFY));
    } finally {
      setMonthlyChartLoading(false);
    }
  }, [currentFY, scope, isDue]);

  const fetchCharts = useCallback(async () => {
    if (!currentFY) return;

    const { data } = await reportApi.monthly(withReportScope({ financialYear: currentFY }, scope));
    const monthlyData = filterMonthlyForFy(mapMonthly(data.data), currentFY, currentFY);

    setMomComparisonChart(buildMomComparison(monthlyData, isDue));
    setMonthlyChart(monthlyData);
  }, [currentFY, scope, isDue]);

  useEffect(() => {
    if (!currentFY) return;

    let cancelled = false;

    (async () => {
      setChartLoading(true);
      try {
        await fetchCharts();
      } finally {
        if (!cancelled) setChartLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchCharts, currentFY]);

  const handleMonthlyFyChange = (fy) => {
    setMonthlyFy(fy);
    void loadMonthlyChart(fy);
  };

  return (
    <div>
      <PageBanner
        className="mb-4"
        title={labels.monthlyTitle}
        subtitle={`${lookups?.currentFinancialYear || ''} · ${CURRENT_MONTH}`}
      />

      {isDue ? (
        <DueBillsStatCards className="mb-4" loading={loading || !currentFY} summary={summary} />
      ) : (
        <ReportSummaryStatCards className="mb-4" loading={loading || !currentFY} summary={summary} showCount cashGross />
      )}

      {chartLoading ? (
        <ChartSkeletonGrid count={2} className="dashboard-grid-2 mb-4" />
      ) : (
        <div className="dashboard-grid-2 mb-4">
          <BarChartCard
            data={momComparisonChart}
            loading={false}
            title={isDue ? `Bills : ${CURRENT_MONTH} vs Previous Month` : `Expenses : ${CURRENT_MONTH} vs Previous Month`}
            xKey="name"
            color={isDue ? '#f59e0b' : '#3b82f6'}
            changePercent={momChangePercent}
          />
          <BarChartCard
            data={monthlyChart}
            loading={monthlyChartLoading}
            title={isDue ? 'Monthly Bills Comparison' : 'Monthly Expenses Comparison'}
            xKey="name"
            color={isDue ? '#f59e0b' : '#3b82f6'}
            fyOptions={fyOptions}
            selectedFy={resolvedMonthlyFy}
            onFyChange={handleMonthlyFyChange}
          />
        </div>
      )}

      <MonthlyExpensesTable
        key={`${scope}-${activeTableFY}-${initialMonth ?? 'all'}`}
        loading={monthlyReportLoading}
        monthlyRows={visibleMonthlyRows}
        activeTableFY={activeTableFY}
        fyOptions={fyOptions}
        onTableFyChange={(v) => setTableFY(v || currentFY)}
        initialMonth={initialMonth}
        reportScope={scope}
      />
    </div>
  );
}

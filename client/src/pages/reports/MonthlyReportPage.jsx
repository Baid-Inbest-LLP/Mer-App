import { useCallback, useEffect, useMemo, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchReportSummary,
  fetchMonthlyReport,
} from '../../store/slices/reportSlice';
import PageBanner from '../../components/common/PageBanner';
import { BarChartCard } from '../../components/charts/lazyCharts';
import { ChartSkeletonGrid } from '../../components/charts/LazyChartBoundary';
import { MonthlyExpensesTable } from '../../components/reports/lazyReportTables';
import { ReportSummaryStatCards } from '../../components/reports/lazyReportStatCards';
import { buildCustomizedReportFilename } from '../../utils/format';
import { getRecentFinancialYearOptions } from '../../utils/financialYear';
import { reportApi } from '../../api/report.api';
import { downloadBlob } from '../../utils/download';

const CURRENT_MONTH = new Date().toLocaleString('en-US', { month: 'long' });

const FY_MONTH_ORDER = [
  'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December', 'January', 'February', 'March',
];

const cleanParams = (params) => {
  const out = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') out[key] = value;
  });
  return out;
};

const mapMonthly = (items = []) =>
  items.map((item) => ({
    name: item._id || item.month,
    value: item.gross ?? item.total ?? 0,
    net: item.net ?? 0,
    gst: item.gst ?? 0,
    tds: item.tds ?? 0,
    gross: item.gross ?? item.total ?? 0,
    count: item.count ?? 0,
  }));

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

const buildMomComparison = (items = []) => {
  const byName = Object.fromEntries(items.map((item) => [item.name, item]));
  const currentIdx = FY_MONTH_ORDER.indexOf(CURRENT_MONTH);
  const prevMonth = currentIdx > 0 ? FY_MONTH_ORDER[currentIdx - 1] : null;

  const chart = [];
  if (prevMonth) {
    const previous = byName[prevMonth];
    chart.push({
      name: prevMonth,
      value: previous?.gross ?? previous?.value ?? 0,
      count: previous?.count ?? 0,
      color: PREV_MONTH_BAR_COLOR,
    });
  }
  const current = byName[CURRENT_MONTH];
  chart.push({
    name: CURRENT_MONTH,
    value: current?.gross ?? current?.value ?? 0,
    count: current?.count ?? 0,
    color: CURRENT_MONTH_BAR_COLOR,
  });
  return chart;
};

export default function MonthlyReportPage() {
  const dispatch = useDispatch();
  const { lookups } = useSelector((state) => state.common);
  const currentFY = lookups?.currentFinancialYear;
  const { summary, monthlyReport, monthlyReportLoading, loading } = useSelector((state) => state.report);
  const [exporting, setExporting] = useState(false);
  const [tableFY, setTableFY] = useState(null);
  const [monthlyFy, setMonthlyFy] = useState('');
  const [momComparisonChart, setMomComparisonChart] = useState([]);
  const [monthlyChart, setMonthlyChart] = useState([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [monthlyChartLoading, setMonthlyChartLoading] = useState(false);

  const activeTableFY = tableFY || currentFY;
  const resolvedMonthlyFy = monthlyFy || currentFY;

  useEffect(() => {
    dispatch(fetchReportSummary({ timeframe: 'month' }));
  }, [dispatch]);

  useEffect(() => {
    if (!activeTableFY) return;
    dispatch(fetchMonthlyReport({ financialYear: activeTableFY }));
  }, [dispatch, activeTableFY]);

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

  const visibleMonthly = useMemo(() => {
    const isCurrentFY = activeTableFY === currentFY;
    const currentIdx = FY_MONTH_ORDER.indexOf(CURRENT_MONTH);
    return monthlyReport
      .filter((m) => {
        const idx = FY_MONTH_ORDER.indexOf(m._id);
        if (idx === -1) return false;
        return isCurrentFY ? idx <= currentIdx : true;
      })
      .sort((a, b) => FY_MONTH_ORDER.indexOf(a._id) - FY_MONTH_ORDER.indexOf(b._id));
  }, [monthlyReport, activeTableFY, currentFY]);

  const loadMonthlyChart = useCallback(async (fy) => {
    if (!fy) return;

    setMonthlyChartLoading(true);
    try {
      const { data } = await reportApi.monthly({ financialYear: fy });
      setMonthlyChart(filterMonthlyForFy(mapMonthly(data.data), fy, currentFY));
    } finally {
      setMonthlyChartLoading(false);
    }
  }, [currentFY]);

  const fetchCharts = useCallback(async () => {
    if (!currentFY) return;

    const { data } = await reportApi.monthly({ financialYear: currentFY });
    const monthlyData = filterMonthlyForFy(mapMonthly(data.data), currentFY, currentFY);

    setMomComparisonChart(buildMomComparison(monthlyData));
    setMonthlyChart(monthlyData);
  }, [currentFY]);

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

  const companyCodeByName = lookups?.companyCodeByName || {};

  const runExport = async (params, filenameHint) => {
    if (exporting) return;
    setExporting(true);
    try {
      const { data } = await reportApi.exportMonthlyExcel(params);
      const filename = filenameHint
        || buildCustomizedReportFilename(params, companyCodeByName);
      downloadBlob(data, filename);
      notifications.show({ message: 'Excel download started', color: 'green' });
    } catch {
      notifications.show({ message: 'Failed to download Excel', color: 'red' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <PageBanner
        className="mb-4"
        title={`Monthly Report`}
        subtitle={`${lookups?.currentFinancialYear || ''} · ${CURRENT_MONTH}`}
        action={{ to: `/reports/monthly/detail?fy=${encodeURIComponent(activeTableFY || '')}&month=${encodeURIComponent(CURRENT_MONTH)}`, label: 'View Monthly Report', icon: false }}
      />

      <ReportSummaryStatCards className="mb-4" loading={loading} summary={summary} />

      {chartLoading ? (
        <ChartSkeletonGrid count={2} className="dashboard-grid-2 mb-4" />
      ) : (
        <div className="dashboard-grid-2 mb-4">
          <BarChartCard
            data={momComparisonChart}
            loading={false}
            title={`${CURRENT_MONTH} vs Previous Month`}
            xKey="name"
            color="#3b82f6"
            changePercent={momChangePercent}
          />
          <BarChartCard
            data={monthlyChart}
            loading={monthlyChartLoading}
            title="Monthly Comparison"
            xKey="name"
            fyOptions={fyOptions}
            selectedFy={resolvedMonthlyFy}
            onFyChange={handleMonthlyFyChange}
          />
        </div>
      )}

      <MonthlyExpensesTable
        loading={monthlyReportLoading}
        visibleMonthly={visibleMonthly}
        activeTableFY={activeTableFY}
        fyOptions={fyOptions}
        onTableFyChange={(v) => setTableFY(v || currentFY)}
        exporting={exporting}
        onExport={runExport}
        companyCodeByName={companyCodeByName}
      />
    </div>
  );
}

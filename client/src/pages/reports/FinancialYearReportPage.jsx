import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { analyticsApi } from '../../api/dashboard.api';
import { reportApi } from '../../api/report.api';
import PageBanner from '../../components/common/PageBanner';
import { BarChartCard } from '../../components/charts/lazyCharts';
import { ChartSkeletonGrid } from '../../components/charts/LazyChartBoundary';
import { FinancialYearExpensesTable } from '../../components/reports/lazyReportTables';
import { FinancialYearReportStatCards } from '../../components/reports/lazyReportStatCards';
import { buildCustomizedReportFilename, buildCustomizedReportNo } from '../../utils/format';
import { downloadBlob } from '../../utils/download';
import { notifications } from '@mantine/notifications';

const TABLE_YEAR_OPTIONS = [
  { value: '2', label: 'Last 2 years' },
  { value: '3', label: 'Last 3 years' },
  { value: '5', label: 'Last 5 years' },
];

const cleanParams = (params) => {
  const out = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') out[key] = value;
  });
  return out;
};

const mapQuarterly = (items = []) =>
  items.map((item) => ({
    name: item.quarter || item._id,
    value: item.total,
    count: item.count ?? 0,
  }));

const mapFyComparison = (items = []) =>
  items.map((item) => ({
    name: item.year || item._id,
    value: item.gross ?? item.total ?? 0,
    net: item.net ?? 0,
    gst: item.gst ?? 0,
    tds: item.tds ?? 0,
    gross: item.gross ?? item.total ?? 0,
    count: item.count ?? 0,
  }));

export default function FinancialYearReportPage() {
  const { lookups } = useSelector((state) => state.common);
  const currentFY = lookups?.currentFinancialYear || '';
  const companyCodeByName = useMemo(
    () => lookups?.companyCodeByName || {},
    [lookups?.companyCodeByName],
  );
  const [quarterlyFy, setQuarterlyFy] = useState('');
  const [quarterly, setQuarterly] = useState([]);
  const [fyOverview, setFyOverview] = useState([]);
  const [quarterlyChart, setQuarterlyChart] = useState([]);
  const [fyComparisonChart, setFyComparisonChart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quarterlyChartLoading, setQuarterlyChartLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [tableYearLimit, setTableYearLimit] = useState('2');

  const resolvedQuarterlyFy = quarterlyFy || currentFY;

  const availableFyYears = useMemo(
    () => fyOverview
      .filter((row) => row.count > 0)
      .sort((a, b) => b.name.localeCompare(a.name)),
    [fyOverview],
  );

  const fyOptions = useMemo(
    () => availableFyYears.map((row) => ({ value: row.name, label: row.name })),
    [availableFyYears],
  );

  const tableYearOptions = useMemo(() => {
    const count = availableFyYears.length;
    if (count <= 1) return [];
    return TABLE_YEAR_OPTIONS.filter((opt) => parseInt(opt.value, 10) <= count);
  }, [availableFyYears.length]);

  const effectiveTableYearLimit = useMemo(() => {
    const requested = parseInt(tableYearLimit, 10) || 2;
    const maxAvailable = availableFyYears.length;
    if (!maxAvailable) return 0;
    const maxOption = tableYearOptions.length
      ? parseInt(tableYearOptions[tableYearOptions.length - 1].value, 10)
      : maxAvailable;
    return Math.min(requested, maxOption, maxAvailable);
  }, [tableYearLimit, availableFyYears.length, tableYearOptions]);

  const visibleFyYears = useMemo(() => {
    return availableFyYears.slice(0, effectiveTableYearLimit).map((row) => ({
      name: row.name,
      reportNo: buildCustomizedReportNo({ financialYear: row.name }, companyCodeByName),
      net: row.net,
      gst: row.gst,
      tds: row.tds,
      gross: row.gross,
      count: row.count,
    }));
  }, [availableFyYears, effectiveTableYearLimit, companyCodeByName]);

  const loadQuarterlyChart = useCallback(async (fy) => {
    if (!fy) return;

    setQuarterlyChartLoading(true);
    try {
      const { data } = await analyticsApi.quarterly({ financialYear: fy });
      setQuarterlyChart(mapQuarterly(data.data));
    } finally {
      setQuarterlyChartLoading(false);
    }
  }, []);

  const fetchReport = useCallback(async () => {
    if (!currentFY) return;

    const [qRes, fyRes] = await Promise.all([
      analyticsApi.quarterly({ financialYear: currentFY }),
      analyticsApi.fyComparison({ limit: 20 }),
    ]);

    const quarterlyData = mapQuarterly(qRes.data.data);
    const comparisonData = mapFyComparison(fyRes.data.data);

    setQuarterly(quarterlyData);
    setFyOverview(comparisonData);
    setQuarterlyChart(quarterlyData);
    setFyComparisonChart(
      comparisonData.filter((row) => row.count > 0).slice(0, 2),
    );
  }, [currentFY]);

  useEffect(() => {
    if (!currentFY) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        await fetchReport();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchReport, currentFY]);

  const handleQuarterlyFyChange = (fy) => {
    setQuarterlyFy(fy);
    void loadQuarterlyChart(fy);
  };

  const runExport = async (financialYear) => {
    if (exporting || !financialYear) return;
    setExporting(true);
    try {
      const params = cleanParams({ financialYear });
      const { data } = await reportApi.exportMonthlyExcel(params);
      downloadBlob(
        data,
        buildCustomizedReportFilename(params, companyCodeByName),
      );
      notifications.show({ message: 'Excel download started', color: 'green' });
    } catch {
      notifications.show({ message: 'Failed to download Excel', color: 'red' });
    } finally {
      setExporting(false);
    }
  };

  const { fyTotal, totalEntries, peakQuarter, yoyChange } = useMemo(() => {
    const total = quarterly.reduce((sum, q) => sum + (q.value || 0), 0);
    const entries = quarterly.reduce((sum, q) => sum + (q.count || 0), 0);
    const peak = quarterly.reduce(
      (max, q) => ((q.value || 0) > (max?.value || 0) ? q : max),
      null,
    );
    const currentIndex = fyComparisonChart.findIndex((f) => f.name === currentFY);
    const currentFy = currentIndex >= 0 ? fyComparisonChart[currentIndex] : null;
    const previousFy = currentIndex >= 0 ? fyComparisonChart[currentIndex + 1] : null;
    const currentTotal = currentFy?.value ?? total;
    const change =
      previousFy?.value > 0
        ? ((currentTotal - previousFy.value) / previousFy.value) * 100
        : 0;

    return {
      fyTotal: currentTotal,
      totalEntries: currentFy?.count ?? entries,
      peakQuarter: peak,
      yoyChange: change,
    };
  }, [quarterly, fyComparisonChart, currentFY]);

  return (
    <div>
      <PageBanner
        className="mb-4"
        title={`FY Report`}
        subtitle={`FY Overview ${currentFY}`}
        action={{ to: `/reports/financial-year/detail?fy=${encodeURIComponent(currentFY)}`, label: 'View FY Report', icon: false }}
      />
      <FinancialYearReportStatCards
        className="mb-4"
        loading={loading}
        fyTotal={fyTotal}
        totalEntries={totalEntries}
        peakQuarter={peakQuarter}
        yoyChange={yoyChange}
      />
      {loading ? (
        <ChartSkeletonGrid count={2} className="dashboard-grid-2" />
      ) : (
        <div className="dashboard-grid-2">
          <BarChartCard
            data={fyComparisonChart}
            loading={false}
            title="Financial Year Comparison"
            xKey="name"
            color="#8b5cf6"
          />
          <BarChartCard
            data={quarterlyChart}
            loading={quarterlyChartLoading}
            title="Quarterly Comparison"
            xKey="name"
            fyOptions={fyOptions}
            selectedFy={resolvedQuarterlyFy}
            onFyChange={handleQuarterlyFyChange}
          />
        </div>
      )}

      <FinancialYearExpensesTable
        className="mt-4"
        loading={loading}
        visibleFyYears={visibleFyYears}
        tableYearOptions={tableYearOptions}
        tableYearLimit={tableYearLimit}
        onTableYearLimitChange={(v) => setTableYearLimit(v || tableYearOptions[0]?.value || '2')}
        exporting={exporting}
        onExport={runExport}
      />
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { analyticsApi } from '../../api/dashboard.api';
import { reportApi } from '../../api/report.api';
import PageBanner from '../../components/common/PageBanner';
import { BarChartCard } from '../../components/charts/lazyCharts';
import { ChartSkeletonGrid } from '../../components/charts/LazyChartBoundary';
import { FinancialYearExpensesTable } from '../../components/reports/lazyReportTables';
import { FinancialYearReportStatCards } from '../../components/reports/lazyReportStatCards';
import {
  isDueReportScope,
  normalizeReportScope,
  reportScopeLabels,
  withReportScope,
} from '../../utils/reportScope';
import { getPreviousFinancialYear } from '../../utils/financialYear';

const TABLE_YEAR_OPTIONS = [
  { value: '2', label: 'Last 2 years' },
  { value: '3', label: 'Last 3 years' },
  { value: '5', label: 'Last 5 years' },
];

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
    outstanding: item.outstanding ?? 0,
    count: item.count ?? 0,
  }));

export default function FinancialYearReportPage() {
  const { reportScope: rawScope } = useParams();
  const scope = normalizeReportScope(rawScope) || 'expenses';
  const isDue = isDueReportScope(scope);
  const labels = reportScopeLabels(scope);
  const [searchParams] = useSearchParams();
  const { lookups } = useSelector((state) => state.common);
  const currentFY = lookups?.currentFinancialYear || '';
  const [quarterlyFy, setQuarterlyFy] = useState('');
  const [quarterly, setQuarterly] = useState([]);
  const [fyOverview, setFyOverview] = useState([]);
  const [fyRows, setFyRows] = useState([]);
  const [fyRowsLoading, setFyRowsLoading] = useState(true);
  const [quarterlyChart, setQuarterlyChart] = useState([]);
  const [fyComparisonChart, setFyComparisonChart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quarterlyChartLoading, setQuarterlyChartLoading] = useState(false);
  const [tableYearLimit, setTableYearLimit] = useState('2');

  const initialFy = searchParams.get('fy') || null;
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

  const loadFyRows = useCallback(async () => {
    setFyRowsLoading(true);
    try {
      const { data } = await reportApi.financialYear(withReportScope({}, scope));
      setFyRows(data.data || []);
    } catch {
      setFyRows([]);
    } finally {
      setFyRowsLoading(false);
    }
  }, [scope]);

  const loadQuarterlyChart = useCallback(async (fy) => {
    if (!fy) return;

    setQuarterlyChartLoading(true);
    try {
      const { data } = await analyticsApi.quarterly(withReportScope({ financialYear: fy }, scope));
      setQuarterlyChart(mapQuarterly(data.data));
    } finally {
      setQuarterlyChartLoading(false);
    }
  }, [scope]);

  const fetchReport = useCallback(async () => {
    if (!currentFY) return;

    const [qRes, fyRes] = await Promise.all([
      analyticsApi.quarterly(withReportScope({ financialYear: currentFY }, scope)),
      analyticsApi.fyComparison(withReportScope({ limit: 20 }, scope)),
    ]);

    const quarterlyData = mapQuarterly(qRes.data.data);
    const comparisonData = mapFyComparison(fyRes.data.data);

    setQuarterly(quarterlyData);
    setFyOverview(comparisonData);
    setQuarterlyChart(quarterlyData);
    setFyComparisonChart(
      comparisonData.filter((row) => row.count > 0).slice(0, 2),
    );
  }, [currentFY, scope]);

  useEffect(() => {
    if (!currentFY) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        await Promise.all([fetchReport(), loadFyRows()]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchReport, loadFyRows, currentFY]);

  const handleQuarterlyFyChange = (fy) => {
    setQuarterlyFy(fy);
    void loadQuarterlyChart(fy);
  };

  const { fyTotal, totalEntries, peakQuarter, yoyChange } = useMemo(() => {
    const currentFyCombined = fyRows.filter(
      (row) => row.financialYear === currentFY && row.merType === 'combined',
    );
    const tableGross = currentFyCombined.reduce((sum, row) => sum + (row.gross || 0), 0);
    const tableCount = currentFyCombined.reduce((sum, row) => sum + (row.count || 0), 0);
    const quarterlyGross = quarterly.reduce((sum, q) => sum + (q.value || 0), 0);
    const quarterlyCount = quarterly.reduce((sum, q) => sum + (q.count || 0), 0);
    const peak = quarterly.reduce(
      (max, q) => ((q.value || 0) > (max?.value || 0) ? q : max),
      null,
    );

    const byYear = Object.fromEntries(fyOverview.map((row) => [row.name, row]));
    const currentYear = byYear[currentFY];
    const previousYear = byYear[getPreviousFinancialYear(currentFY)];
    const hasTableTotals = currentFyCombined.length > 0;
    const currentTotal = hasTableTotals
      ? tableGross
      : (currentYear?.value || quarterlyGross);
    const previousTotal = previousYear?.value ?? 0;
    const change =
      previousTotal > 0
        ? ((currentTotal - previousTotal) / previousTotal) * 100
        : 0;

    return {
      fyTotal: currentTotal,
      totalEntries: hasTableTotals
        ? tableCount
        : (currentYear?.count || quarterlyCount),
      peakQuarter: peak,
      yoyChange: change,
    };
  }, [fyRows, quarterly, fyOverview, currentFY]);

  return (
    <div>
      <PageBanner
        className="mb-4"
        title={labels.fyTitle}
        subtitle={`FY Overview ${currentFY}`}
      />
      <FinancialYearReportStatCards
        className="mb-4"
        loading={loading}
        fyTotal={fyTotal}
        totalEntries={totalEntries}
        peakQuarter={peakQuarter}
        yoyChange={yoyChange}
        totalLabel={isDue ? 'Total FY Billing Amount' : labels.fyTotalLabel}
        entriesLabel={isDue ? 'Total No Of FY Bills' : 'Total Entries'}
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
            color={isDue ? '#f59e0b' : '#8b5cf6'}
          />
          <BarChartCard
            data={quarterlyChart}
            loading={quarterlyChartLoading}
            title="Quarterly Comparison"
            xKey="name"
            color={isDue ? '#f59e0b' : '#3b82f6'}
            fyOptions={fyOptions}
            selectedFy={resolvedQuarterlyFy}
            onFyChange={handleQuarterlyFyChange}
          />
        </div>
      )}

      <FinancialYearExpensesTable
        key={`${scope}-${initialFy ?? 'all'}`}
        className="mt-4"
        loading={loading || fyRowsLoading}
        fyRows={fyRows}
        tableYearOptions={tableYearOptions}
        tableYearLimit={tableYearLimit}
        onTableYearLimitChange={(v) => setTableYearLimit(v || tableYearOptions[0]?.value || '2')}
        initialFy={initialFy}
        reportScope={scope}
      />
    </div>
  );
}

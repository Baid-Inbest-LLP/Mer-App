import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader, Center } from '@mantine/core';
import { useSelector } from 'react-redux';
import { analyticsApi } from '../../api/dashboard.api';
import { reportApi } from '../../api/report.api';
import PageBanner from '../../components/common/PageBanner';
import FilterSelect from '../../components/common/FilterSelect';
import StatCard from '../../components/common/StatCard';
import BarChartCard from '../../components/charts/BarChartCard';
import EmptyState from '../../components/common/EmptyState';
import { formatCurrency, formatPercent, buildCustomizedReportFilename, buildCustomizedReportNo } from '../../utils/format';
import { downloadBlob } from '../../utils/download';
import { notifications } from '@mantine/notifications';

const iconClass =
  'w-5 h-5 sm:w-6 sm:h-6 xl:w-7 xl:h-7 max-[1660px]:w-6 max-[1660px]:h-6 max-[1536px]:w-5 max-[1536px]:h-5 max-[1366px]:w-[18px] max-[1366px]:h-[18px] max-[1280px]:w-4 max-[1280px]:h-4';

const TABLE_YEAR_OPTIONS = [
  { value: '2', label: 'Last 2 years' },
  { value: '3', label: 'Last 3 years' },
  { value: '5', label: 'Last 5 years' },
];

const downloadIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

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
        action={{ to: `/reports/financial-year/detail?fy=${encodeURIComponent(currentFY)}`, label: 'View FY Report' }}
      />
      <div className="dashboard-grid-4 mb-4">
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
      {loading ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : (
        <>
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

          <div className="card mt-4">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
                Overall Expenses by Financial Year
              </h3>
              {tableYearOptions.length > 0 && (
                <div className="w-44">
                  <FilterSelect
                    placeholder="Show years"
                    searchable={false}
                    data={tableYearOptions}
                    value={tableYearLimit}
                    onChange={(v) => setTableYearLimit(v || tableYearOptions[0]?.value || '2')}
                  />
                </div>
              )}
            </div>
            {visibleFyYears.length === 0 ? (
              <EmptyState
                title="No data"
                description="No completed entries are available for any financial year yet."
              />
            ) : (
              <div className="table-wrapper mt-3">
                <table>
                  <thead>
                    <tr>
                      <th className="text-center">MER No</th>
                      <th className="text-center">Financial Year</th>
                      <th className="text-right">Net</th>
                      <th className="text-right">GST</th>
                      <th className="text-right">TDS</th>
                      <th className="text-right">Gross</th>
                      <th className="text-center">Entries</th>
                      <th className="text-center">Download</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleFyYears.map((row) => (
                      <tr key={row.name}>
                        <td className="text-center font-semibold whitespace-nowrap">
                          <Link
                            to={`/reports/financial-year/detail?fy=${encodeURIComponent(row.name)}`}
                            className="text-primary-700 hover:text-primary-900 hover:underline"
                            title={`View ${row.name} expense report`}
                          >
                            {row.reportNo || '—'}
                          </Link>
                        </td>
                        <td className="text-center">{row.name}</td>
                        <td className="text-right">{formatCurrency(row.net)}</td>
                        <td className="text-right text-emerald-700">{formatCurrency(row.gst)}</td>
                        <td className="text-right text-orange-700">{formatCurrency(row.tds)}</td>
                        <td className="text-right font-semibold">{formatCurrency(row.gross)}</td>
                        <td className="text-center">
                          <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 text-xs font-bold border border-primary-200">
                            {row.count}
                          </span>
                        </td>
                        <td className="text-center">
                          <button
                            type="button"
                            disabled={exporting}
                            onClick={() => runExport(row.name)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-primary-700 border border-primary-200 bg-white hover:bg-primary-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title={`Download ${row.name} report`}
                          >
                            {downloadIcon}
                            Excel
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

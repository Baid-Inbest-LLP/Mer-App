import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader, Center } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchReportSummary,
  fetchMonthlyReport,
} from '../../store/slices/reportSlice';
import PageBanner from '../../components/common/PageBanner';
import FilterSelect from '../../components/common/FilterSelect';
import StatCard from '../../components/common/StatCard';
import BarChartCard from '../../components/charts/BarChartCard';
import EmptyState from '../../components/common/EmptyState';
import { formatCurrency, buildMonthlyReportNo, buildCustomizedReportFilename } from '../../utils/format';
import { getRecentFinancialYearOptions } from '../../utils/financialYear';
import { reportApi } from '../../api/report.api';
import { downloadBlob } from '../../utils/download';

const iconClass =
  'w-5 h-5 sm:w-6 sm:h-6 xl:w-7 xl:h-7 max-[1660px]:w-6 max-[1660px]:h-6 max-[1536px]:w-5 max-[1536px]:h-5 max-[1366px]:w-[18px] max-[1366px]:h-[18px] max-[1280px]:w-4 max-[1280px]:h-4';

const CURRENT_MONTH = new Date().toLocaleString('en-US', { month: 'long' });

const FY_MONTH_ORDER = [
  'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December', 'January', 'February', 'March',
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
  const { summary, monthlyReport, loading } = useSelector((state) => state.report);
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
        action={{ to: `/reports/monthly/detail?fy=${encodeURIComponent(activeTableFY || '')}&month=${encodeURIComponent(CURRENT_MONTH)}`, label: 'View Monthly Report' }}
      />

      <div className="dashboard-grid-4 mb-4">
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

      {chartLoading ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : (
        <>
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

          <div className="card">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
                Overall Expenses Monthly
              </h3>
              <div className="w-44">
                <FilterSelect
                  placeholder="Financial year"
                  searchable
                  data={fyOptions}
                  value={activeTableFY || ''}
                  onChange={(v) => setTableFY(v || currentFY)}
                />
              </div>
            </div>
            {loading && !visibleMonthly.length ? (
              <Center py="xl"><Loader /></Center>
            ) : visibleMonthly.length === 0 ? (
              <EmptyState
                title="No data"
                description="No completed entries are available for this financial year yet."
              />
            ) : (
              <div className="table-wrapper mt-3">
                <table>
                  <thead>
                    <tr>
                      <th className="text-center">MER No</th>
                      <th className="text-center">Month</th>
                      <th className="text-right">Net</th>
                      <th className="text-right">GST</th>
                      <th className="text-right">TDS</th>
                      <th className="text-right">Gross</th>
                      <th className="text-center">Entries</th>
                      <th className="text-center">Download</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleMonthly.map((m) => (
                      <tr key={m._id}>
                        <td className="text-center font-semibold whitespace-nowrap">
                          <Link
                            to={`/reports/monthly/detail?fy=${encodeURIComponent(activeTableFY || '')}&month=${encodeURIComponent(m._id)}`}
                            className="text-primary-700 hover:text-primary-900 hover:underline"
                            title={`View ${m._id} expense report`}
                          >
                            {m.reportNo || buildMonthlyReportNo(activeTableFY, m._id) || '—'}
                          </Link>
                        </td>
                        <td className="text-center">{m._id}</td>
                        <td className="text-right">{formatCurrency(m.net)}</td>
                        <td className="text-right text-emerald-700">{formatCurrency(m.gst)}</td>
                        <td className="text-right text-orange-700">{formatCurrency(m.tds)}</td>
                        <td className="text-right font-semibold">{formatCurrency(m.gross)}</td>
                        <td className="text-center">
                          <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 text-xs font-bold border border-primary-200">
                            {m.count}
                          </span>
                        </td>
                        <td className="text-center">
                          <button
                            type="button"
                            disabled={exporting}
                            onClick={() => runExport(
                              cleanParams({ financialYear: activeTableFY, month: m._id }),
                              buildCustomizedReportFilename(
                                { financialYear: activeTableFY, month: m._id },
                                companyCodeByName,
                              ),
                            )}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-primary-700 border border-primary-200 bg-white hover:bg-primary-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title={`Download ${m._id} report`}
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

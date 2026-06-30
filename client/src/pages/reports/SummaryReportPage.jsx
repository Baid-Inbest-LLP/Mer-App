import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader, Center } from '@mantine/core';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchReportSummary,
  fetchHeadSummary,
} from '../../store/slices/reportSlice';
import PageBanner from '../../components/common/PageBanner';
import FilterPanel from '../../components/common/FilterPanel';
import StatCard from '../../components/common/StatCard';
import EmptyState from '../../components/common/EmptyState';
import { formatCurrency } from '../../utils/format';
import { omitPaymentFilters, cleanFilterParams, stripSummaryReportHiddenFilters } from '../../utils/filters';

const iconClass =
  'w-5 h-5 sm:w-6 sm:h-6 xl:w-7 xl:h-7 max-[1660px]:w-6 max-[1660px]:h-6 max-[1536px]:w-5 max-[1536px]:h-5 max-[1366px]:w-[18px] max-[1366px]:h-[18px] max-[1280px]:w-4 max-[1280px]:h-4';

export default function SummaryReportPage() {
  const dispatch = useDispatch();
  const { summary, headSummary, loading } = useSelector((state) => state.report);
  const [filters, setFilters] = useState({});

  const load = useCallback((f) => {
    const params = cleanFilterParams(stripSummaryReportHiddenFilters(omitPaymentFilters(f ?? filters)));
    dispatch(fetchReportSummary(params));
    dispatch(fetchHeadSummary(params));
  }, [dispatch, filters]);

  useEffect(() => {
    dispatch(fetchReportSummary(cleanFilterParams(omitPaymentFilters({}))));
    dispatch(fetchHeadSummary(cleanFilterParams(omitPaymentFilters({}))));
  }, [dispatch]);

  const headTotals = useMemo(
    () => headSummary.reduce(
      (acc, row) => ({
        net: acc.net + (row.net || 0),
        gst: acc.gst + (row.gst || 0),
        tds: acc.tds + (row.tds || 0),
        gross: acc.gross + (row.gross || 0),
        count: acc.count + (row.count || 0),
      }),
      { net: 0, gst: 0, tds: 0, gross: 0, count: 0 },
    ),
    [headSummary],
  );

  const grossBase = summary?.grossAmount || headTotals.gross || 0;

  return (
    <div>
      <PageBanner
        className="mb-4"
        title="Summary Report"
        subtitle={`Total Entries · ${summary?.entryCount ?? 0}`}
        action={{ to: '/reports/customized', label: 'Customized Report', icon: 'arrow' }}
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
      <FilterPanel
        filters={filters}
        onChange={setFilters}
        onApply={() => load()}
        onClear={() => {
          setFilters({});
          load({});
        }}
        hide={['search', 'approvalStatus', 'coNames', 'timeframe']}
      />
      {loading && !summary ? (
        <Center py="xl"><Loader /></Center>
      ) : (
        <div className="card overflow-hidden mb-4 summary-head-report">
          <div className="summary-head-report-header px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 bg-gray-50 chart-card-header flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="expense-summary-icon w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h3 className="report-table-title text-sm font-bold text-gray-800 uppercase tracking-wide">
                  Expense Head Summary
                </h3>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="summary-head-report-pill text-xs font-semibold text-primary-700 bg-primary-50 border border-primary-200 px-2.5 py-1 rounded-full">
                Gross {formatCurrency(grossBase)}
              </span>
              <span className="summary-head-report-pill-muted text-xs font-semibold text-gray-600 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full">
                {headTotals.count} line items
              </span>
            </div>
          </div>

          {headSummary.length === 0 ? (
            <EmptyState
              title="No head summary"
              description="No completed entries match the selected filters."
            />
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th className="text-center w-14">#</th>
                    <th className="text-left">Expense Head</th>
                    <th className="text-right">Net</th>
                    <th className="text-right">GST</th>
                    <th className="text-right">TDS</th>
                    <th className="text-right">Gross</th>
                    <th className="text-center w-20">Share</th>
                    <th className="text-center w-16">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {headSummary.map((h, index) => {
                    const sharePercent = grossBase > 0 ? (h.gross / grossBase) * 100 : 0;
                    return (
                      <tr key={h._id}>
                        <td className="text-center summary-head-report-index font-semibold">{index + 1}</td>
                        <td className="text-left">
                          <p className="summary-head-report-name font-semibold">{h._id}</p>
                        </td>
                        <td className="text-right">{formatCurrency(h.net)}</td>
                        <td className="text-right summary-head-report-value-gst">{formatCurrency(h.gst)}</td>
                        <td className="text-right summary-head-report-value-tds">{formatCurrency(h.tds)}</td>
                        <td className="text-right font-semibold">{formatCurrency(h.gross)}</td>
                        <td className="text-center">
                          <span className="summary-head-share-label text-xs font-semibold">
                            {sharePercent.toFixed(1)}%
                          </span>
                        </td>
                        <td className="text-center">
                          <span className="summary-head-report-count-badge inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 text-xs font-bold border border-primary-200">
                            {h.count}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="summary-head-report-total-row">
                    <td colSpan={2} className="text-left font-bold uppercase tracking-wide text-xs">
                      Total
                    </td>
                    <td className="text-right font-bold">{formatCurrency(headTotals.net)}</td>
                    <td className="text-right font-bold summary-head-report-value-gst">{formatCurrency(headTotals.gst)}</td>
                    <td className="text-right font-bold summary-head-report-value-tds">{formatCurrency(headTotals.tds)}</td>
                    <td className="text-right font-bold">{formatCurrency(headTotals.gross)}</td>
                    <td className="text-center font-bold">100%</td>
                    <td className="text-center font-bold">{headTotals.count}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

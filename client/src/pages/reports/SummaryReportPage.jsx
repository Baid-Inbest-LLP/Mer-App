import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import {
  fetchReportSummary,
  fetchHeadSummary,
  clearReport,
} from '../../store/slices/reportSlice';
import PageBanner from '../../components/common/PageBanner';
import FilterPanel from '../../components/common/FilterPanel';
import { ExpenseHeadSummaryTable } from '../../components/reports/lazyReportTables';
import { omitPaymentFilters, cleanFilterParams, stripSummaryReportHiddenFilters } from '../../utils/filters';
import {
  isDueReportScope,
  normalizeReportScope,
  reportScopeLabels,
  withReportScope,
} from '../../utils/reportScope';

export default function SummaryReportPage() {
  const dispatch = useDispatch();
  const { reportScope: rawScope } = useParams();
  const scope = normalizeReportScope(rawScope) || 'expenses';
  const isDue = isDueReportScope(scope);
  const labels = reportScopeLabels(scope);
  const { summary, headSummary, headSummaryLoading, loading, error } = useSelector((state) => state.report);
  const headRows = Array.isArray(headSummary) ? headSummary : [];
  const [filters, setFilters] = useState({});

  const load = useCallback((f) => {
    const params = withReportScope(
      cleanFilterParams(stripSummaryReportHiddenFilters(omitPaymentFilters(f ?? filters))),
      scope,
    );
    dispatch(fetchReportSummary(params));
    dispatch(fetchHeadSummary(params));
  }, [dispatch, filters, scope]);

  useEffect(() => {
    setFilters({});
    dispatch(clearReport());
    const params = withReportScope(cleanFilterParams(omitPaymentFilters({})), scope);
    dispatch(fetchReportSummary(params));
    dispatch(fetchHeadSummary(params));
  }, [dispatch, scope]);

  const headTotals = useMemo(
    () => headRows.reduce(
      (acc, row) => ({
        net: acc.net + (row.net || 0),
        gst: acc.gst + (row.gst || 0),
        tds: acc.tds + (row.tds || 0),
        gross: acc.gross + (row.gross || 0),
        outstanding: acc.outstanding + (row.outstanding || 0),
        amountPaid: acc.amountPaid + (row.amountPaid || 0),
        count: acc.count + (row.count || 0),
      }),
      { net: 0, gst: 0, tds: 0, gross: 0, outstanding: 0, amountPaid: 0, count: 0 },
    ),
    [headRows],
  );

  const grossBase = summary?.grossAmount || headTotals.gross || 0;

  return (
    <div>
      <PageBanner
        className="mb-4"
        title={labels.summaryTitle}
        subtitle={`${isDue ? 'Due Bills' : 'Total Entries'} · ${summary?.entryCount ?? 0}`}
        action={{ to: `/reports/customized/${scope}`, label: 'Customized Report', icon: 'arrow' }}
      />
      {error && !loading ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

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
      <ExpenseHeadSummaryTable
        loading={headSummaryLoading}
        headSummary={headRows}
        headTotals={headTotals}
        grossBase={grossBase}
        reportScope={scope}
      />
    </div>
  );
}

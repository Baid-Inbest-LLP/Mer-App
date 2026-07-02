import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchReportSummary,
  fetchHeadSummary,
} from '../../store/slices/reportSlice';
import PageBanner from '../../components/common/PageBanner';
import FilterPanel from '../../components/common/FilterPanel';
import { ExpenseHeadSummaryTable } from '../../components/reports/lazyReportTables';
import { ReportSummaryStatCards } from '../../components/reports/lazyReportStatCards';
import { omitPaymentFilters, cleanFilterParams, stripSummaryReportHiddenFilters } from '../../utils/filters';

export default function SummaryReportPage() {
  const dispatch = useDispatch();
  const { summary, headSummary, headSummaryLoading, loading } = useSelector((state) => state.report);
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
      <ReportSummaryStatCards className="mb-4" loading={loading} summary={summary} />
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
        headSummary={headSummary}
        headTotals={headTotals}
        grossBase={grossBase}
      />
    </div>
  );
}

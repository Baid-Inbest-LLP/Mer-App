import EmptyState from '../common/EmptyState';
import ExpenseHeadSummarySkeleton from '../common/ExpenseHeadSummarySkeleton';
import { formatCurrency } from '../../utils/format';
import { isDueReportScope } from '../../utils/reportScope';

export default function ExpenseHeadSummaryTable({
  className = '',
  loading,
  headSummary,
  headTotals,
  grossBase,
  reportScope = 'expenses',
}) {
  const isDue = isDueReportScope(reportScope);
  if (loading && !headSummary.length) {
    return <ExpenseHeadSummarySkeleton className={className} />;
  }

  return (
    <div className={`card overflow-hidden mb-4 summary-head-report ${className}`}>
      <div className="summary-head-report-header px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 bg-gray-50 chart-card-header flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="expense-summary-icon w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h3 className="report-table-title text-sm font-bold text-gray-800 uppercase tracking-wide">
              {isDue ? 'Due Bills by Expense Head' : 'Expense Head Summary'}
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
          description={isDue
            ? 'No due bills match the selected filters.'
            : 'No completed entries match the selected filters.'}
        />
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th className="text-center w-14">#</th>
                <th className="text-center">Expense Head</th>
                {isDue ? (
                  <>
                    <th className="text-right">Paid</th>
                    <th className="text-right">Unpaid</th>
                    <th className="text-right">Gross</th>
                  </>
                ) : (
                  <>
                    <th className="text-right">Net</th>
                    <th className="text-right">GST</th>
                    <th className="text-right">TDS</th>
                    <th className="text-right">Gross</th>
                  </>
                )}
                <th className="text-center w-20">Share</th>
                <th className="text-center w-16">Count</th>
              </tr>
            </thead>
            <tbody>
              {headSummary.map((h, index) => {
                const shareValue = h.gross || 0;
                const sharePercent = grossBase > 0 ? (shareValue / grossBase) * 100 : 0;
                return (
                  <tr key={h._id}>
                    <td className="text-center summary-head-report-index font-semibold">{index + 1}</td>
                    <td className="text-center">
                      <p className="summary-head-report-name font-semibold">{h._id}</p>
                    </td>
                    {isDue ? (
                      <>
                        <td className="text-right text-emerald-700">{formatCurrency(h.amountPaid)}</td>
                        <td className="text-right font-semibold text-orange-700">{formatCurrency(h.outstanding)}</td>
                        <td className="text-right">{formatCurrency(h.gross)}</td>
                      </>
                    ) : (
                      <>
                        <td className="text-right">{formatCurrency(h.net)}</td>
                        <td className="text-right summary-head-report-value-gst">{formatCurrency(h.gst)}</td>
                        <td className="text-right summary-head-report-value-tds">{formatCurrency(h.tds)}</td>
                        <td className="text-right font-semibold">{formatCurrency(h.gross)}</td>
                      </>
                    )}
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
                {isDue ? (
                  <>
                    <td className="text-right font-bold text-emerald-700">{formatCurrency(headTotals.amountPaid)}</td>
                    <td className="text-right font-bold text-orange-700">{formatCurrency(headTotals.outstanding)}</td>
                    <td className="text-right font-bold">{formatCurrency(headTotals.gross)}</td>
                  </>
                ) : (
                  <>
                    <td className="text-right font-bold">{formatCurrency(headTotals.net)}</td>
                    <td className="text-right font-bold summary-head-report-value-gst">{formatCurrency(headTotals.gst)}</td>
                    <td className="text-right font-bold summary-head-report-value-tds">{formatCurrency(headTotals.tds)}</td>
                    <td className="text-right font-bold">{formatCurrency(headTotals.gross)}</td>
                  </>
                )}
                <td className="text-center font-bold">100%</td>
                <td className="text-center font-bold">{headTotals.count}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

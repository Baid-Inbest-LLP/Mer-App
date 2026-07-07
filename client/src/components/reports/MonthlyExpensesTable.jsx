import { Link } from 'react-router-dom';
import FilterSelect from '../common/FilterSelect';
import EmptyState from '../common/EmptyState';
import ReportOverviewTableSkeleton from '../common/ReportOverviewTableSkeleton';
import { formatCurrency, buildMonthlyReportNo, buildMonthlyReportFilename } from '../../utils/format';

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

export default function MonthlyExpensesTable({
  className = '',
  loading,
  visibleMonthly,
  activeTableFY,
  fyOptions,
  onTableFyChange,
  exporting,
  onExport,
}) {
  if (loading && !visibleMonthly.length) {
    return <ReportOverviewTableSkeleton className={className} />;
  }

  return (
    <div className={`card ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
        <h3 className="report-table-title text-sm font-bold text-gray-800 uppercase tracking-wide">
          Overall Expenses Monthly
        </h3>
        <div className="w-44">
          <FilterSelect
            placeholder="Financial year"
            searchable
            data={fyOptions}
            value={activeTableFY || ''}
            onChange={onTableFyChange}
          />
        </div>
      </div>
      {visibleMonthly.length === 0 ? (
        <EmptyState
          title="No data"
          description="No completed entries are available for this financial year yet."
        />
      ) : (
        <div className="table-wrapper mt-3">
          <table>
            <thead>
              <tr>
                <th className="text-center w-14">S.No</th>
                <th className="text-center">MER No</th>
                <th className="text-center">Company</th>
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
              {visibleMonthly.map((m, index) => {
                const reportNo = m.reportNo || buildMonthlyReportNo({
                  companyCode: m.companyCode,
                  month: m.month,
                  financialYear: activeTableFY,
                  merType: 'combined',
                });
                const exportParams = cleanParams({
                  financialYear: activeTableFY,
                  month: m.month,
                  company: m.company,
                  merType: 'combined',
                });

                return (
                  <tr key={`${m.company}-${m.month}`}>
                    <td className="text-center summary-head-report-index font-semibold">{index + 1}</td>
                    <td className="text-center font-semibold whitespace-nowrap">
                      <Link
                        to={`/reports/monthly/detail?fy=${encodeURIComponent(activeTableFY || '')}&month=${encodeURIComponent(m.month)}&company=${encodeURIComponent(m.company || '')}`}
                        className="table-serial-link text-primary-700 hover:text-primary-900 hover:underline"
                        title={`View ${m.companyCode || m.company} ${m.month} report`}
                      >
                        {reportNo || '—'}
                      </Link>
                    </td>
                    <td className="text-center font-medium">{m.companyCode || '—'}</td>
                    <td className="text-center">{m.month}</td>
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
                        onClick={() => onExport(
                          exportParams,
                          buildMonthlyReportFilename({
                            companyCode: m.companyCode,
                            month: m.month,
                            financialYear: activeTableFY,
                            merType: 'combined',
                          }),
                        )}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-primary-700 border border-primary-200 bg-white hover:bg-primary-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={`Download ${m.companyCode || m.company} ${m.month} report`}
                      >
                        {downloadIcon}
                        Excel
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

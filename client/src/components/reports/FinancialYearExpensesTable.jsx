import { Link } from 'react-router-dom';
import FilterSelect from '../common/FilterSelect';
import EmptyState from '../common/EmptyState';
import ReportOverviewTableSkeleton from '../common/ReportOverviewTableSkeleton';
import { formatCurrency } from '../../utils/format';

const downloadIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

export default function FinancialYearExpensesTable({
  className = '',
  loading,
  visibleFyYears,
  tableYearOptions,
  tableYearLimit,
  onTableYearLimitChange,
  exporting,
  onExport,
}) {
  if (loading && !visibleFyYears.length) {
    return <ReportOverviewTableSkeleton className={className} titleWidth="w-72" />;
  }

  return (
    <div className={`card ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
        <h3 className="report-table-title text-sm font-bold text-gray-800 uppercase tracking-wide">
          Overall Expenses by Financial Year
        </h3>
        {tableYearOptions.length > 0 && (
          <div className="w-44">
            <FilterSelect
              placeholder="Show years"
              searchable={false}
              data={tableYearOptions}
              value={tableYearLimit}
              onChange={onTableYearLimitChange}
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
                <th className="text-center w-14">S.No</th>
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
              {visibleFyYears.map((row, index) => (
                <tr key={row.name}>
                  <td className="text-center summary-head-report-index font-semibold">{index + 1}</td>
                  <td className="text-center font-semibold whitespace-nowrap">
                    <Link
                      to={`/reports/financial-year/detail?fy=${encodeURIComponent(row.name)}`}
                      className="table-serial-link text-primary-700 hover:text-primary-900 hover:underline"
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
                      onClick={() => onExport(row.name)}
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
  );
}

import Skeleton from './Skeleton';

const COLUMNS = ['#', 'Expense Head', 'Net', 'GST', 'TDS', 'Gross', 'Share', 'Count'];

export default function ExpenseHeadSummarySkeleton({ className = '' }) {
  return (
    <div className={`card overflow-hidden mb-4 summary-head-report ${className}`}>
      <div className="summary-head-report-header px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 bg-gray-50 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
          <Skeleton className="h-4 w-44" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-7 w-28 rounded-full" />
          <Skeleton className="h-7 w-24 rounded-full" />
        </div>
      </div>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th key={col} className="text-center">
                  <Skeleton className="h-3 w-12 mx-auto" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, row) => (
              <tr key={row}>
                {COLUMNS.map((col) => (
                  <td key={col} className="text-center">
                    <Skeleton className="h-4 w-16 mx-auto" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

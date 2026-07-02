import Skeleton from './Skeleton';

const DEFAULT_COLUMNS = [
  'S.No',
  'MER No',
  'Period',
  'Net',
  'GST',
  'TDS',
  'Gross',
  'Entries',
  'Download',
];

export default function ReportOverviewTableSkeleton({
  titleWidth = 'w-56',
  columns = DEFAULT_COLUMNS,
  rows = 6,
  className = '',
}) {
  return (
    <div className={`card ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
        <Skeleton className={`h-4 ${titleWidth}`} />
        <Skeleton className="h-9 w-44 rounded-lg" />
      </div>
      <div className="table-wrapper mt-3">
        <table>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col} className="text-center">
                  <Skeleton className="h-3 w-12 mx-auto" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, row) => (
              <tr key={row}>
                {columns.map((col) => (
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

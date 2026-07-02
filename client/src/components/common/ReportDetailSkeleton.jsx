import Skeleton from './Skeleton';

export default function ReportDetailSkeleton() {
  return (
    <div className="w-full max-w-[90rem] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <Skeleton className="h-9 w-44 rounded-lg" />
        <Skeleton className="h-10 w-40 rounded-lg" />
      </div>

      <div className="card p-5 mb-4">
        <Skeleton className="h-7 w-64 mb-2" />
        <Skeleton className="h-4 w-48" />
      </div>

      <div className="dashboard-grid-4 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-4 flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-24" />
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="px-4 pt-4">
          <Skeleton className="h-4 w-36" />
        </div>
        <div className="table-wrapper mt-3">
          <table>
            <thead>
              <tr>
                {Array.from({ length: 13 }).map((_, i) => (
                  <th key={i} className="text-center">
                    <Skeleton className="h-3 w-12 mx-auto" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }).map((_, row) => (
                <tr key={row}>
                  {Array.from({ length: 13 }).map((__, col) => (
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
    </div>
  );
}

import Skeleton, { SkeletonText } from './Skeleton';

export default function ExpenseViewSkeleton() {
  return (
    <div className="expense-view-page w-full max-w-[90rem] mx-auto space-y-6">
      <Skeleton className="h-9 w-44 rounded-lg" />

      <div className="expense-view-layout">
        <div className="min-w-0 space-y-3">
          <div className="card overflow-hidden">
            <Skeleton className="h-1.5 w-full rounded-none" />

            <div className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
                <div className="flex flex-wrap items-center gap-3">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-9 w-28 rounded-lg" />
                  <Skeleton className="h-9 w-20 rounded-lg" />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Skeleton className="w-8 h-8 rounded-lg" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((__, j) => (
                    <div key={j} className="flex justify-between gap-4 py-1">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-4 w-36" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-2 mb-6">
              <Skeleton className="w-8 h-8 rounded-lg" />
              <Skeleton className="h-4 w-36" />
            </div>
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex justify-between gap-4 py-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                ))}
                <Skeleton className="h-20 w-full rounded-lg mt-4" />
              </div>
              <div className="w-full lg:w-1/3 space-y-3 rounded-2xl border border-gray-200 p-5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
                <Skeleton className="h-8 w-full mt-4" />
              </div>
            </div>
          </div>
        </div>

        <aside className="card p-5 w-full">
          <div className="flex items-center gap-2.5 pb-4 mb-1">
            <Skeleton className="w-9 h-9 rounded-lg" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="space-y-5 ml-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="pl-6 space-y-2">
                <Skeleton className="w-7 h-7 rounded-md" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
                <SkeletonText lines={1} />
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse rounded-md bg-slate-200/80 ${className}`} />
);

export const SkeletonText = ({ lines = 1 }) => (
  <div className="space-y-2">
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} className={i === lines - 1 ? 'h-3 w-2/3' : 'h-3 w-full'} />
    ))}
  </div>
);

export default Skeleton;

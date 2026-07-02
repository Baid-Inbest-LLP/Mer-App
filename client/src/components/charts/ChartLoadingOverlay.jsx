export default function ChartLoadingOverlay({ show }) {
  if (!show) return null;

  return (
    <div className="absolute inset-0 z-10 rounded-lg bg-white/80 backdrop-blur-[1px] p-4">
      <div className="h-full w-full animate-pulse rounded-md bg-slate-200/70" />
    </div>
  );
}

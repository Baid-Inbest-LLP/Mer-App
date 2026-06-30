import { Loader } from '@mantine/core';

export default function ChartLoadingOverlay({ show }) {
  if (!show) return null;
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 rounded-lg">
      <Loader size="sm" color="blue" />
    </div>
  );
}

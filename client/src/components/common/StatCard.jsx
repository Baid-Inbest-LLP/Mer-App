import { Tooltip } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

function StatCardInfoTip({ label, info }) {
  if (!info) return null;

  const text = typeof info === 'string' ? info : info.what;
  if (!text) return null;

  return (
    <Tooltip
      label={text.toUpperCase()}
      multiline
      maw={260}
      withArrow
      position="top"
      openDelay={150}
      events={{ hover: true, focus: true, touch: true }}
      styles={{
        tooltip: {
          textTransform: 'uppercase',
          letterSpacing: '0.02em',
          fontSize: '11px',
          fontWeight: 600,
          lineHeight: 1.35,
          textAlign: 'left',
        },
      }}
    >
      <button
        type="button"
        className="inline-flex shrink-0 items-center justify-center rounded-full text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        aria-label={`About ${label}`}
        onClick={(e) => e.preventDefault()}
      >
        <IconInfoCircle size={14} stroke={1.75} />
      </button>
    </Tooltip>
  );
}

export default function StatCard({ label, value, color, iconBg, icon, accent, info }) {
  return (
    <div className="card w-full p-3 sm:p-4 flex items-center gap-3 group hover:shadow-md transition-shadow duration-200 relative overflow-hidden">
      <div className={`absolute top-0 left-0 w-full h-1 ${accent}`} />
      <div className={`stat-icon-box ${iconBg}`}>{icon}</div>
      <div className="min-w-0">
        <p className={`text-2xl sm:text-3xl font-bold tracking-tight leading-none ${color}`}>{value}</p>
        <p className="text-sm sm:text-base text-gray-500 font-semibold mt-1 leading-snug inline-flex items-center gap-1 max-w-full">
          <span className="min-w-0">{label}</span>
          <StatCardInfoTip label={label} info={info} />
        </p>
      </div>
    </div>
  );
}

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import ChartCard from '../common/ChartCard';
import ChartSkeleton from '../common/ChartSkeleton';

const formatDays = (value) => {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  const rounded = Math.abs(n - Math.round(n)) < 0.05 ? Math.round(n) : Math.round(n * 10) / 10;
  if (rounded === 1 || rounded === -1) return `${rounded} day`;
  return `${rounded} days`;
};

export default function DaysToClearChart({ data, loading }) {
  if (loading) {
    return <ChartSkeleton />;
  }

  const chartData = (data || []).map((row) => ({
    ...row,
    avgDays: row.avgDays == null ? 0 : row.avgDays,
    hasData: row.count > 0 && row.avgDays != null,
  }));

  const hasAny = chartData.some((row) => row.hasData);

  return (
    <ChartCard
      title="Avg Days to Clear Bills"
      iconBg="bg-indigo-100"
      icon={
        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      }
      bodyClassName="p-4"
    >
      <div style={{ height: 300 }}>
        {!hasAny ? (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">
            No fully paid bills in the last 12 months yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `${v}d`}
                tick={{ fontSize: 12, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                allowDecimals
              />
              <Tooltip
                contentStyle={{
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.75rem',
                  fontSize: '14px',
                }}
                formatter={(value, _name, props) => {
                  const count = props?.payload?.count || 0;
                  if (!count) return ['No paid bills', 'Avg days'];
                  return [formatDays(value), 'Avg days'];
                }}
                labelFormatter={(label, payload) => {
                  const count = payload?.[0]?.payload?.count || 0;
                  return count ? `${label} · ${count} bill${count === 1 ? '' : 's'}` : label;
                }}
              />
              <Bar
                dataKey="avgDays"
                name="Avg days"
                fill="#6366f1"
                radius={[6, 6, 0, 0]}
                maxBarSize={36}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartCard>
  );
}

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import ChartCard from '../common/ChartCard';
import ChartSkeleton from '../common/ChartSkeleton';
import ChartMonthSelect from './ChartMonthSelect';
import ChartLoadingOverlay from './ChartLoadingOverlay';
import { formatCurrency } from '../../utils/format';

const COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#ec4899', '#f97316'];

export default function PieChartCard({
  data,
  loading,
  title,
  dataKey = 'value',
  nameKey = 'name',
  fyMonthOptions,
  selectedMonth,
  onMonthChange,
}) {
  if (loading && !(data || []).length) {
    return <ChartSkeleton />;
  }

  const chartData = (data || []).map((d) => ({
    name: d[nameKey] || d.name,
    value: d[dataKey] ?? d.value,
  }));

  return (
    <ChartCard
      title={title}
      iconBg="bg-purple-100"
      icon={
        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-purple-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
        </svg>
      }
      bodyClassName="p-4"
      headerRight={
        fyMonthOptions?.length ? (
          <ChartMonthSelect
            fyMonthOptions={fyMonthOptions}
            selectedMonth={selectedMonth}
            onMonthChange={onMonthChange}
          />
        ) : null
      }
    >
      <div className="relative" style={{ height: 300 }}>
        <ChartLoadingOverlay show={loading} />
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">No data available</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                isAnimationActive={false}
              >
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartCard>
  );
}

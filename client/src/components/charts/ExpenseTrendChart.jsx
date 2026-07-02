import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import ChartCard from '../common/ChartCard';
import ChartSkeleton from '../common/ChartSkeleton';
import { formatCurrency } from '../../utils/format';

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'];

export default function ExpenseTrendChart({ data, loading, title = 'Monthly Expense Trend' }) {
  if (loading) {
    return <ChartSkeleton />;
  }

  return (
    <ChartCard
      title={title}
      iconBg="bg-blue-100"
      icon={
        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      }
      bodyClassName="p-4"
    >
      <div style={{ height: 300 }}>
        {(data || []).length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">
            No expense data available yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 12, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.75rem',
                  fontSize: '14px',
                }}
                formatter={(v) => formatCurrency(v)}
              />
              <Area
                type="monotone"
                dataKey="total"
                name="Gross Expense"
                stroke={PIE_COLORS[0]}
                fill={PIE_COLORS[0]}
                fillOpacity={0.15}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartCard>
  );
}

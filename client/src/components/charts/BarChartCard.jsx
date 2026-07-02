import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import ChartCard from '../common/ChartCard';
import ChartSkeleton from '../common/ChartSkeleton';
import ChartMonthSelect from './ChartMonthSelect';
import ChartFySelect from './ChartFySelect';
import ChartLoadingOverlay from './ChartLoadingOverlay';
import { formatCurrency, formatPercent } from '../../utils/format';

export default function BarChartCard({
  data,
  loading,
  title,
  dataKey = 'value',
  xKey = 'name',
  color = '#3b82f6',
  changePercent,
  fyMonthOptions,
  selectedMonth,
  onMonthChange,
  fyOptions,
  selectedFy,
  onFyChange,
}) {
  if (loading && !(data || []).length) {
    return <ChartSkeleton />;
  }

  return (
    <ChartCard
      title={title}
      iconBg="bg-emerald-100"
      icon={
        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      }
      bodyClassName="p-4"
      headerRight={
        fyOptions?.length || fyMonthOptions?.length ? (
          <div className="flex items-center gap-2 shrink-0">
            {fyOptions?.length ? (
              <ChartFySelect
                fyOptions={fyOptions}
                selectedFy={selectedFy}
                onFyChange={onFyChange}
              />
            ) : null}
            {fyMonthOptions?.length ? (
              <ChartMonthSelect
                fyMonthOptions={fyMonthOptions}
                selectedMonth={selectedMonth}
                onMonthChange={onMonthChange}
              />
            ) : null}
          </div>
        ) : null
      }
    >
      <div className="relative" style={{ height: 300 }}>
        <ChartLoadingOverlay show={loading} />
        {(data || []).length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">No data available</div>
        ) : (
          <>
            {changePercent != null && (
              <div className="absolute top-1 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                <span
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-bold shadow-sm border bg-white/95 ${
                    changePercent >= 0
                      ? 'text-red-700 border-red-200'
                      : 'text-emerald-700 border-emerald-200'
                  }`}
                >
                  {changePercent >= 0 ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  )}
                  {formatPercent(changePercent)} vs prev. month
                </span>
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data || []} margin={{ top: changePercent != null ? 36 : 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey={xKey}
                tick={{ fontSize: 10, fill: '#64748b' }}
                interval={0}
                angle={-25}
                textAnchor="end"
                height={70}
                axisLine={false}
                tickLine={false}
              />
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
              <Bar dataKey={dataKey} name="Amount" fill={color} radius={[6, 6, 0, 0]} maxBarSize={40} isAnimationActive={false}>
                {(data || []).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color || color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          </>
        )}
      </div>
    </ChartCard>
  );
}

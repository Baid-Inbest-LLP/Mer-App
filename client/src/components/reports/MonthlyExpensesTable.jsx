import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import FilterSelect from '../common/FilterSelect';
import EmptyState from '../common/EmptyState';
import ReportOverviewTableSkeleton from '../common/ReportOverviewTableSkeleton';
import { formatCurrency, buildMonthlyReportNo, buildMonthlyReportFilename, formatMonthFyPeriodLabel } from '../../utils/format';

const FY_MONTH_ORDER = [
  'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December', 'January', 'February', 'March',
];

const REPORT_TYPES = [
  { key: 'bank', label: 'Bank' },
  { key: 'cash', label: 'Cash' },
  { key: 'combined', label: 'Combined' },
];

const downloadIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const backIcon = (
  <svg className="w-4 h-4 transition-transform duration-150 group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);

const cleanParams = (params) => {
  const out = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') out[key] = value;
  });
  return out;
};

const buildDetailUrl = ({ activeTableFY, month, company, merType }) => {
  const params = new URLSearchParams();
  if (activeTableFY) params.set('fy', activeTableFY);
  if (month) params.set('month', month);
  if (company) params.set('company', company);
  if (merType) params.set('merType', merType);
  return `/reports/monthly/detail?${params.toString()}`;
};

const aggregateMonthTotals = (rows = []) => {
  const byMonth = new Map();

  for (const row of rows) {
    if (row.merType !== 'combined') continue;
    const prev = byMonth.get(row.month) || {
      month: row.month,
      net: 0,
      gst: 0,
      tds: 0,
      gross: 0,
      count: 0,
      companyCount: 0,
    };
    byMonth.set(row.month, {
      month: row.month,
      net: prev.net + (row.net || 0),
      gst: prev.gst + (row.gst || 0),
      tds: prev.tds + (row.tds || 0),
      gross: prev.gross + (row.gross || 0),
      count: prev.count + (row.count || 0),
      companyCount: prev.companyCount + 1,
    });
  }

  return [...byMonth.values()].sort(
    (a, b) => FY_MONTH_ORDER.indexOf(a.month) - FY_MONTH_ORDER.indexOf(b.month),
  );
};

const groupCompaniesForMonth = (rows = [], month) => {
  const combinedRows = rows.filter((row) => row.month === month && row.merType === 'combined');
  const byCompany = new Map();

  for (const row of rows) {
    if (row.month !== month) continue;
    if (!byCompany.has(row.company)) {
      byCompany.set(row.company, {
        company: row.company,
        companyCode: row.companyCode,
        reports: {},
      });
    }
    byCompany.get(row.company).reports[row.merType] = row;
  }

  return combinedRows
    .map((row) => {
      const entry = byCompany.get(row.company) || {
        company: row.company,
        companyCode: row.companyCode,
        reports: {},
      };
      return {
        company: row.company,
        companyCode: row.companyCode,
        combined: entry.reports.combined || row,
        reports: {
          bank: entry.reports.bank || null,
          cash: entry.reports.cash || null,
          combined: entry.reports.combined || row,
        },
      };
    })
    .sort((a, b) => String(a.companyCode || a.company).localeCompare(String(b.companyCode || b.company)));
};

export default function MonthlyExpensesTable({
  className = '',
  loading,
  monthlyRows,
  activeTableFY,
  fyOptions,
  onTableFyChange,
  initialMonth = null,
  exporting,
  onExport,
}) {
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);

  const monthTotals = useMemo(
    () => aggregateMonthTotals(monthlyRows),
    [monthlyRows],
  );

  const companiesForMonth = useMemo(
    () => (selectedMonth ? groupCompaniesForMonth(monthlyRows, selectedMonth) : []),
    [monthlyRows, selectedMonth],
  );

  if (loading && !monthlyRows.length) {
    return <ReportOverviewTableSkeleton className={className} />;
  }

  const renderReportCell = (report, company, merType) => {
    if (!report || report.count === 0) {
      return (
        <div className="monthly-report-cell monthly-report-cell--empty">
          <span className="text-gray-400">—</span>
        </div>
      );
    }

    const reportNo = report.reportNo || buildMonthlyReportNo({
      companyCode: report.companyCode,
      month: selectedMonth,
      financialYear: activeTableFY,
      merType,
    });

    const exportParams = cleanParams({
      financialYear: activeTableFY,
      month: selectedMonth,
      company,
      merType,
    });

    return (
      <div className="monthly-report-cell">
        <Link
          to={buildDetailUrl({
            activeTableFY,
            month: selectedMonth,
            company,
            merType,
          })}
          className="monthly-report-link table-serial-link text-primary-700 hover:text-primary-900 hover:underline"
          title={`View ${merType} report`}
        >
          {reportNo || '—'}
        </Link>
        <button
          type="button"
          disabled={exporting}
          onClick={() => onExport(
            exportParams,
            buildMonthlyReportFilename({
              companyCode: report.companyCode,
              month: selectedMonth,
              financialYear: activeTableFY,
              merType,
            }),
          )}
          className="monthly-report-download"
          title={`Download ${merType} report`}
        >
          {downloadIcon}
        </button>
      </div>
    );
  };

  return (
    <div className={`card ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
        <div className="flex flex-wrap items-center gap-3">
          {selectedMonth && (
            <button
              type="button"
              onClick={() => setSelectedMonth(null)}
              className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-primary-700 bg-primary-50 border border-primary-200 hover:bg-primary-100 transition-colors"
            >
              {backIcon}
              All months
            </button>
          )}
          <h3 className="report-table-title text-sm font-bold text-gray-800 uppercase tracking-wide">
            {selectedMonth
              ? `Company Reports ${formatMonthFyPeriodLabel(selectedMonth, activeTableFY)}`
              : 'Expenses Monthly'}
          </h3>
        </div>
        <div className="w-44">
          <FilterSelect
            placeholder="Financial year"
            searchable
            data={fyOptions}
            value={activeTableFY || ''}
            onChange={onTableFyChange}
          />
        </div>
      </div>

      {!selectedMonth ? (
        monthTotals.length === 0 ? (
          <EmptyState
            title="No data"
            description="No completed entries are available for this financial year yet."
          />
        ) : (
          <div className="table-wrapper mt-3">
            <table>
              <thead>
                <tr>
                  <th className="text-center w-14">S.No</th>
                  <th className="text-center">Month</th>
                  <th className="text-center">Companies</th>
                  <th className="text-right">Net</th>
                  <th className="text-right">GST</th>
                  <th className="text-right">TDS</th>
                  <th className="text-right">Gross</th>
                  <th className="text-center">Entries</th>
                  
                </tr>
              </thead>
              <tbody>
                {monthTotals.map((m, index) => (
                  <tr key={m.month}>
                    <td className="text-center summary-head-report-index font-semibold">{index + 1}</td>
                    <td className="text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedMonth(m.month)}
                        className="table-serial-link font-semibold text-primary-700 hover:text-primary-900 hover:underline"
                      >
                        {m.month}
                      </button>
                    </td>
                    <td className="text-center">{m.companyCount}</td>
                    <td className="text-right">{formatCurrency(m.net)}</td>
                    <td className="text-right text-emerald-700">{formatCurrency(m.gst)}</td>
                    <td className="text-right text-orange-700">{formatCurrency(m.tds)}</td>
                    <td className="text-right font-semibold">{formatCurrency(m.gross)}</td>
                    <td className="text-center">
                      <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 text-xs font-bold border border-primary-200">
                        {m.count}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : companiesForMonth.length === 0 ? (
        <EmptyState
          title="No company reports"
          description={`No completed entries are available for ${selectedMonth}.`}
        />
      ) : (
        <div className="table-wrapper mt-3">
          <table>
            <thead>
              <tr>
                <th className="text-center w-14">S.No</th>
                <th className="text-center">Company</th>
                {REPORT_TYPES.map((type) => (
                  <th key={type.key} className="text-center min-w-[15.5rem]">{type.label} MER</th>
                ))}
                <th className="text-right">Net</th>
                <th className="text-right">GST</th>
                <th className="text-right">TDS</th>
                <th className="text-right">Gross</th>
                <th className="text-center">Entries</th>
              </tr>
            </thead>
            <tbody>
              {companiesForMonth.map((row, index) => {
                const combined = row.combined || row.reports.combined;

                return (
                  <tr key={row.company}>
                    <td className="text-center summary-head-report-index font-semibold">{index + 1}</td>
                    <td className="text-center font-medium">{row.companyCode || '—'}</td>
                    {REPORT_TYPES.map((type) => (
                      <td key={type.key} className="text-center align-middle text-xs sm:text-sm">
                        {renderReportCell(row.reports[type.key], row.company, type.key)}
                      </td>
                    ))}
                    <td className="text-right">{formatCurrency(combined?.net)}</td>
                    <td className="text-right text-emerald-700">{formatCurrency(combined?.gst)}</td>
                    <td className="text-right text-orange-700">{formatCurrency(combined?.tds)}</td>
                    <td className="text-right font-semibold">{formatCurrency(combined?.gross)}</td>
                    <td className="text-center">
                      <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 text-xs font-bold border border-primary-200">
                        {combined?.count || 0}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

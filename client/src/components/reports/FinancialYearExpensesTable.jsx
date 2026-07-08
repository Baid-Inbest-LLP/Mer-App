import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import FilterSelect from '../common/FilterSelect';
import EmptyState from '../common/EmptyState';
import ReportOverviewTableSkeleton from '../common/ReportOverviewTableSkeleton';
import {
  formatCurrency,
  buildFyReportNo,
  buildFyReportFilename,
  formatFyShortLabel,
} from '../../utils/format';

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

const buildDetailUrl = ({ financialYear, company, merType }) => {
  const params = new URLSearchParams();
  if (financialYear) params.set('fy', financialYear);
  if (company) params.set('company', company);
  if (merType) params.set('merType', merType);
  return `/reports/financial-year/detail?${params.toString()}`;
};

const aggregateFyTotals = (rows = []) => {
  const byFy = new Map();

  for (const row of rows) {
    if (row.merType !== 'combined') continue;
    const prev = byFy.get(row.financialYear) || {
      financialYear: row.financialYear,
      net: 0,
      gst: 0,
      tds: 0,
      gross: 0,
      count: 0,
      companyCount: 0,
    };
    byFy.set(row.financialYear, {
      financialYear: row.financialYear,
      net: prev.net + (row.net || 0),
      gst: prev.gst + (row.gst || 0),
      tds: prev.tds + (row.tds || 0),
      gross: prev.gross + (row.gross || 0),
      count: prev.count + (row.count || 0),
      companyCount: prev.companyCount + 1,
    });
  }

  return [...byFy.values()].sort(
    (a, b) => String(b.financialYear).localeCompare(String(a.financialYear)),
  );
};

const groupCompaniesForFy = (rows = [], financialYear) => {
  const combinedRows = rows.filter(
    (row) => row.financialYear === financialYear && row.merType === 'combined',
  );
  const byCompany = new Map();

  for (const row of rows) {
    if (row.financialYear !== financialYear) continue;
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

export default function FinancialYearExpensesTable({
  className = '',
  loading,
  fyRows,
  tableYearOptions,
  tableYearLimit,
  onTableYearLimitChange,
  initialFy = null,
  exporting,
  onExport,
}) {
  const [selectedFy, setSelectedFy] = useState(initialFy);

  const yearLimit = parseInt(tableYearLimit, 10) || 2;

  const fyTotals = useMemo(() => {
    const totals = aggregateFyTotals(fyRows);
    return totals.slice(0, yearLimit);
  }, [fyRows, yearLimit]);

  const companiesForFy = useMemo(
    () => (selectedFy ? groupCompaniesForFy(fyRows, selectedFy) : []),
    [fyRows, selectedFy],
  );

  if (loading && !fyRows.length) {
    return <ReportOverviewTableSkeleton className={className} titleWidth="w-72" />;
  }

  const renderReportCell = (report, company, merType) => {
    if (!report || report.count === 0) {
      return (
        <div className="monthly-report-cell monthly-report-cell--empty">
          <span className="text-gray-400">—</span>
        </div>
      );
    }

    const reportNo = report.reportNo || buildFyReportNo({
      companyCode: report.companyCode,
      financialYear: selectedFy,
      merType,
    });

    const exportParams = cleanParams({
      financialYear: selectedFy,
      company,
      merType,
    });

    return (
      <div className="monthly-report-cell">
        <Link
          to={buildDetailUrl({
            financialYear: selectedFy,
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
            buildFyReportFilename({
              companyCode: report.companyCode,
              financialYear: selectedFy,
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
          {selectedFy && (
            <button
              type="button"
              onClick={() => setSelectedFy(null)}
              className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-primary-700 bg-primary-50 border border-primary-200 hover:bg-primary-100 transition-colors"
            >
              {backIcon}
              All years
            </button>
          )}
          <h3 className="report-table-title text-sm font-bold text-gray-800 uppercase tracking-wide">
            {selectedFy
              ? `Company Reports FY ${formatFyShortLabel(selectedFy)}`
              : 'Expenses by Financial Year'}
          </h3>
        </div>
        {!selectedFy && tableYearOptions.length > 0 && (
          <div className="w-44">
            <FilterSelect
              placeholder="Show years"
              searchable={false}
              data={tableYearOptions}
              value={tableYearLimit}
              onChange={onTableYearLimitChange}
            />
          </div>
        )}
      </div>

      {!selectedFy ? (
        fyTotals.length === 0 ? (
          <EmptyState
            title="No data"
            description="No completed entries are available for any financial year yet."
          />
        ) : (
          <div className="table-wrapper mt-3">
            <table>
              <thead>
                <tr>
                  <th className="text-center w-14">S.No</th>
                  <th className="text-center">Financial Year</th>
                  <th className="text-center">Companies</th>
                  <th className="text-right">Net</th>
                  <th className="text-right">GST</th>
                  <th className="text-right">TDS</th>
                  <th className="text-right">Gross</th>
                  <th className="text-center">Entries</th>
                </tr>
              </thead>
              <tbody>
                {fyTotals.map((row, index) => (
                  <tr key={row.financialYear}>
                    <td className="text-center summary-head-report-index font-semibold">{index + 1}</td>
                    <td className="text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedFy(row.financialYear)}
                        className="table-serial-link font-semibold text-primary-700 hover:text-primary-900 hover:underline"
                      >
                        {row.financialYear}
                      </button>
                    </td>
                    <td className="text-center">{row.companyCount}</td>
                    <td className="text-right">{formatCurrency(row.net)}</td>
                    <td className="text-right text-emerald-700">{formatCurrency(row.gst)}</td>
                    <td className="text-right text-orange-700">{formatCurrency(row.tds)}</td>
                    <td className="text-right font-semibold">{formatCurrency(row.gross)}</td>
                    <td className="text-center">
                      <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 text-xs font-bold border border-primary-200">
                        {row.count}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : companiesForFy.length === 0 ? (
        <EmptyState
          title="No company reports"
          description={`No completed entries are available for ${selectedFy}.`}
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
              {companiesForFy.map((row, index) => {
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

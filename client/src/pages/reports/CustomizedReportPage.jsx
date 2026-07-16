import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SimpleGrid, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useSelector } from 'react-redux';
import PageBanner from '../../components/common/PageBanner';
import FilterSelect from '../../components/common/FilterSelect';
import EmptyState from '../../components/common/EmptyState';
import { formatCurrency, formatDate, buildCustomizedReportFilename } from '../../utils/format';
import { buildCompanySelectOptions } from '../../utils/companySelect';
import { getRecentFinancialYearOptions } from '../../utils/financialYear';
import { MER_ENTRY_TYPE_OPTIONS } from '../../utils/paymentMethods';
import { reportApi } from '../../api/report.api';
import { downloadBlob, withExtension } from '../../utils/download';
import excelIconSrc from '../../assets/excel.svg';
import pdfIconSrc from '../../assets/pdf.svg';

const FILTER_LABELS = {
  financialYear: 'FY',
  month: 'Month',
  company: 'Company',
  coNames: 'Co Name',
  location: 'Location',
  expenseType: 'Expense Type',
  merType: 'MER Type',
};

const filterChipValue = (key, value, companyCodeByName = {}) => {
  if (key === 'company') return companyCodeByName[value] || value;
  return value;
};

const cleanParams = (params) => {
  const out = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') out[key] = value;
  });
  return out;
};

export default function CustomizedReportPage() {
  const navigate = useNavigate();
  const { lookups } = useSelector((state) => state.common);
  const [downloadFilters, setDownloadFilters] = useState({});
  const [exportingReport, setExportingReport] = useState({ pdf: false, excel: false });
  const [filtersKey, setFiltersKey] = useState(0);
  const [preview, setPreview] = useState(null);
  const [generating, setGenerating] = useState(false);

  const companyCodeByName = lookups?.companyCodeByName || {};
  const companyCode = (name) => companyCodeByName[name] || name || '—';
  const hasSelectedFY = Boolean(downloadFilters.financialYear);
  const optionalFiltersEnabled = hasSelectedFY;
  const hasSelectedCompany = Boolean(downloadFilters.company);
  const locationEnabled = optionalFiltersEnabled && hasSelectedCompany;

  const monthOptions = useMemo(
    () => (lookups?.months || []).map((m) => ({ value: m, label: m })),
    [lookups?.months],
  );
  const companyOptions = useMemo(
    () => buildCompanySelectOptions(lookups?.companies, companyCodeByName),
    [lookups?.companies, companyCodeByName],
  );
  const fyOptions = useMemo(
    () => getRecentFinancialYearOptions(lookups?.currentFinancialYear, 2),
    [lookups?.currentFinancialYear],
  );
  const companyLocations = lookups?.companyLocations;
  const locationOptions = useMemo(() => {
    if (!downloadFilters.company) return [];
    const scoped = companyLocations?.[downloadFilters.company] || [];
    return scoped.map((l) => ({ value: l, label: l }));
  }, [downloadFilters.company, companyLocations]);
  const expenseTypeOptions = useMemo(
    () => (lookups?.expenseTypes || []).map((t) => ({ value: t, label: t })),
    [lookups?.expenseTypes],
  );

  const updateFilter = (key, value) => {
    setDownloadFilters((prev) => {
      const next = { ...prev, [key]: value || undefined };
      if (key === 'company' && value !== prev.company) {
        next.location = undefined;
      }
      return next;
    });
  };

  const resetFilters = () => {
    setDownloadFilters({});
    setFiltersKey((k) => k + 1);
    setPreview(null);
  };

  const runExport = async (params, filenameHint, format = 'excel') => {
    if (exportingReport[format]) return;
    setExportingReport((prev) => ({ ...prev, [format]: true }));
    const isPdf = format === 'pdf';
    try {
      const { data } = isPdf
        ? await reportApi.exportMonthlyPdf(params)
        : await reportApi.exportMonthlyExcel(params);
      const filename = filenameHint
        || buildCustomizedReportFilename(params, companyCodeByName);
      downloadBlob(data, isPdf ? withExtension(filename, 'pdf') : filename);
      notifications.show({ message: `${isPdf ? 'PDF' : 'Excel'} download started`, color: 'green' });
    } catch {
      notifications.show({ message: `Failed to download ${isPdf ? 'PDF' : 'Excel'}`, color: 'red' });
    } finally {
      setExportingReport((prev) => ({ ...prev, [format]: false }));
    }
  };

  const generatePreview = async () => {
    if (generating || !downloadFilters.financialYear) return;
    setGenerating(true);
    try {
      const params = cleanParams({ ...downloadFilters });
      const { data } = await reportApi.monthlyDetailed(params);
      setPreview({ ...data.data, params });
    } catch {
      notifications.show({ message: 'Failed to generate report', color: 'red' });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate('/reports/summary')}
        className="expense-view-back-btn group mb-4"
      >
        <svg
          className="w-4 h-4 transition-transform duration-150 group-hover:-translate-x-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Summary Report
      </button>

      <PageBanner
        className="mb-4"
        title="Customized Report"
        subtitle="Build Expense Reports with Flexible Filters"
      />

      <div className="card p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <div>
            <p className="summary-head-report-subtitle text-sm text-gray-700">
              Select a Financial Year (required), then optionally filter by Month, Company, Co Name, Expense Type, or MER Type. Location / Branch unlocks after you select a Company.
            </p>
          </div>
        </div>
        <SimpleGrid key={filtersKey} cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="sm">
          <FilterSelect
            placeholder="Financial year *"
            searchable
            data={fyOptions}
            value={downloadFilters.financialYear || ''}
            onChange={(v) => updateFilter('financialYear', v)}
          />
          <FilterSelect
            placeholder="Month"
            clearable
            searchable
            disabled={!optionalFiltersEnabled}
            data={monthOptions}
            value={downloadFilters.month || ''}
            onChange={(v) => updateFilter('month', v)}
          />
          <FilterSelect
            placeholder="Company"
            clearable
            searchable
            disabled={!optionalFiltersEnabled}
            data={companyOptions}
            value={downloadFilters.company || ''}
            onChange={(v) => updateFilter('company', v)}
          />
          <TextInput
            placeholder="Co name"
            disabled={!optionalFiltersEnabled}
            value={downloadFilters.coNames || ''}
            onChange={(e) => updateFilter('coNames', e.target.value)}
          />
          <FilterSelect
            placeholder={hasSelectedCompany ? 'Location / Branch' : 'Select company first'}
            clearable
            searchable
            disabled={!locationEnabled}
            data={locationOptions}
            value={downloadFilters.location || ''}
            onChange={(v) => updateFilter('location', v)}
          />
          <FilterSelect
            placeholder="Expense type"
            clearable
            disabled={!optionalFiltersEnabled}
            data={expenseTypeOptions}
            value={downloadFilters.expenseType || ''}
            onChange={(v) => updateFilter('expenseType', v)}
          />
          <FilterSelect
            placeholder="MER type"
            clearable
            disabled={!optionalFiltersEnabled}
            data={MER_ENTRY_TYPE_OPTIONS}
            value={downloadFilters.merType || ''}
            onChange={(v) => updateFilter('merType', v)}
          />
        </SimpleGrid>
        <div className="flex items-center justify-end gap-2 mt-4">
          <button
            type="button"
            disabled={generating || (!hasSelectedFY && !preview)}
            onClick={resetFilters}
            title="Clear filters"
            className="btn-secondary text-sm"
          >
            Clear
          </button>
          <button
            type="button"
            disabled={generating || !hasSelectedFY}
            onClick={generatePreview}
            className="btn-primary inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            {generating ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {preview && (
        <div className="card p-0 overflow-hidden report-preview">
          <div className="report-preview-header flex flex-wrap items-center justify-between gap-3 px-5 py-4 bg-gradient-to-r from-primary-50 via-blue-50 to-indigo-50 border-b border-gray-100">
            <div className="min-w-0">
              <h3 className="report-table-title text-md font-bold text-gray-800">Report Preview</h3>
              {preview.reportNo && (
                <p className="report-preview-report-no text-sm font-semibold text-primary-700 mt-0.5">{preview.reportNo}</p>
              )}
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                {Object.entries(preview.params)
                  .filter(([key]) => FILTER_LABELS[key])
                  .map(([key, value]) => (
                    <span
                      key={key}
                      className="summary-head-report-pill inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                    >
                      {FILTER_LABELS[key]}: {filterChipValue(key, value, companyCodeByName)}
                    </span>
                  ))}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                disabled={exportingReport.pdf || preview.count === 0}
                onClick={() => runExport(preview.params, preview.filename, 'pdf')}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-red-800 bg-red-50 border border-red-200 hover:bg-red-100 hover:border-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exportingReport.pdf ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <img src={pdfIconSrc} alt="" className="w-5 h-5" aria-hidden />
                )}
                PDF
              </button>
              <button
                type="button"
                disabled={exportingReport.excel || preview.count === 0}
                onClick={() => runExport(preview.params, preview.filename, 'excel')}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-green-800 bg-green-50 border border-green-200 hover:bg-green-100 hover:border-green-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exportingReport.excel ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <img src={excelIconSrc} alt="" className="w-5 h-5" aria-hidden />
                )}
                Excel
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-5">
            {[
              { label: 'Net Expense', value: preview.totals?.net, tone: 'net' },
              { label: 'GST Paid', value: preview.totals?.gst, tone: 'gst' },
              { label: 'TDS Deducted', value: preview.totals?.tds, tone: 'tds' },
              { label: 'Gross Expense', value: preview.totals?.gross, tone: 'gross' },
            ].map((tile) => (
              <div
                key={tile.label}
                className={`report-preview-stat-tile report-preview-stat-tile-${tile.tone} rounded-xl border border-gray-100 px-4 py-3`}
              >
                <p className={`report-preview-stat-value report-preview-stat-value-${tile.tone} text-xl font-bold tracking-tight`}>
                  {formatCurrency(tile.value)}
                </p>
                <p className="summary-head-report-subtitle text-xs font-semibold mt-0.5">{tile.label}</p>
              </div>
            ))}
          </div>

          {preview.count === 0 ? (
            <EmptyState
              title="No matching entries"
              description="No completed entries match the selected filters. Try adjusting them."
            />
          ) : (
            <div className="report-preview-table-divider table-wrapper max-h-[460px] overflow-auto border-t border-gray-100">
              <table>
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th className="text-center w-14">S.No</th>
                    <th className="text-center">Expense No</th>
                    <th className="text-center">Date</th>
                    <th className="text-center">Company</th>
                    <th className="text-center">Co Name</th>
                    <th className="text-center">Head</th>
                    <th className="text-center">Particulars</th>
                    <th className="text-center">Type</th>
                    <th className="text-right">Net</th>
                    <th className="text-right">GST</th>
                    <th className="text-right">TDS</th>
                    <th className="text-right">Gross</th>
                    <th className="text-center">Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.entries.map((e, index) => (
                    <tr key={e._id}>
                      <td className="text-center summary-head-report-index font-semibold">{index + 1}</td>
                      <td className="text-center table-serial-link font-medium text-primary-700">{e.slNo || '—'}</td>
                      <td className="text-center whitespace-nowrap">{formatDate(e.invoiceDate)}</td>
                      <td className="text-center">{companyCode(e.company)}</td>
                      <td className="text-center">{e.coNames || '—'}</td>
                      <td className="text-center">{e.headOfExpense || '—'}</td>
                      <td className="text-center max-w-[220px] truncate" title={e.particulars}>{e.particulars || '—'}</td>
                      <td className="text-center">{e.expenseType || '—'}</td>
                      <td className="text-right">{formatCurrency(e.netAmount)}</td>
                      <td className="text-right text-emerald-700">{formatCurrency(e.totalGST)}</td>
                      <td className="text-right text-orange-700">{formatCurrency(e.tds)}</td>
                      <td className="text-right font-semibold">{formatCurrency(e.grossAmount)}</td>
                      <td className="text-center">{e.paymentMethod || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

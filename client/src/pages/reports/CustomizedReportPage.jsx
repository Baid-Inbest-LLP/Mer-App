import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { SimpleGrid, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useSelector } from 'react-redux';
import PageBanner from '../../components/common/PageBanner';
import FilterSelect from '../../components/common/FilterSelect';
import FilterMultiSelect from '../../components/common/FilterMultiSelect';
import EmptyState from '../../components/common/EmptyState';
import {
  formatCurrency,
  formatDate,
  buildCustomizedReportFilename,
  formatMerSerial,
  getSerialLabel,
  getPaymentStatusLabel,
} from '../../utils/format';
import { buildCompanySelectOptions } from '../../utils/companySelect';
import { FY_MONTH_ORDER, getRecentFinancialYearOptions } from '../../utils/financialYear';
import { MER_ENTRY_TYPE_OPTIONS } from '../../utils/paymentMethods';
import { reportApi } from '../../api/report.api';
import { downloadBlob, readBlobError, withExtension } from '../../utils/download';
import excelIconSrc from '../../assets/excel.svg';
import pdfIconSrc from '../../assets/pdf.svg';
import { isDueReportScope, normalizeReportScope, reportScopeLabels, withReportScope } from '../../utils/reportScope';
import { DueBillsStatCards, FinancialYearReportStatCards, ReportSummaryStatCards } from '../../components/reports/lazyReportStatCards';

const FILTER_LABELS = {
  financialYear: 'FY',
  month: 'Month',
  company: 'Company',
  coNames: 'Co Name',
  location: 'Location',
  expenseType: 'Expense Type',
  merType: 'Payment Type',
};

const filterChipValue = (key, value, companyCodeByName = {}) => {
  if (key === 'company') return companyCodeByName[value] || value;
  if (key === 'month') {
    if (Array.isArray(value)) return value.join(', ');
    return String(value).split(',').join(', ');
  }
  return value;
};

const cleanParams = (params) => {
  const out = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (key === 'month') {
      const items = (Array.isArray(value) ? value : String(value).split(','))
        .map((item) => String(item).trim())
        .filter(Boolean)
        .sort((a, b) => FY_MONTH_ORDER.indexOf(a) - FY_MONTH_ORDER.indexOf(b));
      if (items.length) out.month = items.join(',');
      return;
    }
    if (Array.isArray(value)) {
      const items = value.filter(Boolean);
      if (items.length) out[key] = items.join(',');
      return;
    }
    out[key] = value;
  });
  return out;
};

export default function CustomizedReportPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { reportScope: rawScope } = useParams();
  const scope = normalizeReportScope(rawScope) || 'expenses';
  const isDue = isDueReportScope(scope);
  const labels = reportScopeLabels(scope);
  const returnTo = `${location.pathname}${location.search}`;
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
    () => FY_MONTH_ORDER.map((m) => ({ value: m, label: m })),
    [],
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
      if (key === 'financialYear' && value !== prev.financialYear) {
        next.month = undefined;
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
    const scopedParams = withReportScope(params, scope);
    try {
      const { data } = isPdf
        ? await reportApi.exportMonthlyPdf(scopedParams)
        : await reportApi.exportMonthlyExcel(scopedParams);
      if (isPdf && data instanceof Blob && data.type && data.type.includes('json')) {
        throw Object.assign(new Error('PDF export failed'), { response: { data } });
      }
      const filename = filenameHint
        || buildCustomizedReportFilename(params, companyCodeByName);
      downloadBlob(data, isPdf ? withExtension(filename, 'pdf') : filename);
      notifications.show({ message: `${isPdf ? 'PDF' : 'Excel'} download started`, color: 'green' });
    } catch (err) {
      notifications.show({
        message: await readBlobError(err) || `Failed to download ${isPdf ? 'PDF' : 'Excel'}`,
        color: 'red',
      });
    } finally {
      setExportingReport((prev) => ({ ...prev, [format]: false }));
    }
  };

  useEffect(() => {
    setPreview(null);
    setDownloadFilters({});
    setFiltersKey((k) => k + 1);
  }, [scope]);

  const generatePreview = async () => {
    if (generating || !downloadFilters.financialYear) return;
    setGenerating(true);
    try {
      const params = withReportScope(cleanParams({ ...downloadFilters }), scope);
      const { data } = await reportApi.monthlyDetailed(params);
      setPreview({ ...data.data, params });
    } catch {
      notifications.show({ message: 'Failed to generate report', color: 'red' });
    } finally {
      setGenerating(false);
    }
  };

  const selectedMonthCount = String(preview?.params?.month || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean).length;
  const isMonthlyBillsPreview = isDue && selectedMonthCount === 1;
  const dueSummary = {
    grossAmount: preview?.totals?.gross,
    entryCount: preview?.count ?? 0,
    amountPaid: preview?.totals?.amountPaid,
    overdue: preview?.totals?.overdue,
    dueAndOverdue: (preview?.totals?.due || 0) + (preview?.totals?.overdue || 0),
  };
  const byQuarter = preview?.totals?.byQuarter || {};
  const peakQuarter = Object.entries(byQuarter).reduce(
    (max, [name, value]) => ((value || 0) > (max?.value || 0) ? { name, value } : max),
    null,
  );
  const previousYearGross = preview?.previousYearGross || 0;
  const yoyChange = previousYearGross > 0
    ? ((preview?.totals?.gross - previousYearGross) / previousYearGross) * 100
    : 0;

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate(`/reports/summary/${scope}`)}
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
        title={labels.customizedTitle}
        subtitle={labels.customizedSubtitle}
      />

      <div className="card p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <div>
            <p className="summary-head-report-subtitle text-sm text-gray-700">
              Select a Financial Year (required), then optionally filter by months (one, several, or a range), Company, Co Name, Expense Type, or Payment Type. Location / Branch unlocks after you select a Company.
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
          <FilterMultiSelect
            placeholder="Months (one, several, or a range)"
            clearable
            searchable
            hidePickedOptions
            disabled={!optionalFiltersEnabled}
            data={monthOptions}
            value={downloadFilters.month || []}
            onChange={(v) => updateFilter('month', v?.length ? v : undefined)}
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
            placeholder="Payment type"
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
        <div className="w-full">
          <div className="card p-0 overflow-hidden mb-4 report-preview">
            <div className="report-preview-header flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-4">
              <div className="min-w-0">
                <h3 className="report-table-title text-sm font-bold text-gray-800 uppercase tracking-wide">
                  Report Preview
                </h3>
                {preview.reportNo && (
                  <p className="report-preview-report-no text-sm font-semibold mt-0.5">{preview.reportNo}</p>
                )}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
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
                  <span className="summary-head-report-pill-muted inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold">
                    {preview.count} {preview.count === 1 ? 'entry' : 'entries'}
                  </span>
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
          </div>

          {isDue ? (
            isMonthlyBillsPreview ? (
              <DueBillsStatCards className="mb-4" summary={dueSummary} variant="monthly" />
            ) : (
              <FinancialYearReportStatCards
                className="mb-4"
                fyTotal={preview.totals?.gross}
                totalEntries={preview.count}
                peakQuarter={peakQuarter}
                yoyChange={yoyChange}
                totalLabel="Total FY Billing Amount"
                entriesLabel="Total No Of FY Bills"
              />
            )
          ) : (
            <ReportSummaryStatCards
              className="mb-4"
              summary={{
                totalNetAmount: preview.totals?.net,
                totalGST: preview.totals?.gst,
                totalTDS: preview.totals?.tds,
                grossAmount: preview.totals?.gross,
                entryCount: preview.count,
              }}
            />
          )}

          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
              <h3 className="report-table-title text-sm font-bold text-gray-800 uppercase tracking-wide">
                {labels.entriesHeading}
              </h3>
            </div>
            {preview.count === 0 ? (
              <EmptyState
                title="No matching entries"
                description={isDue
                  ? 'No due bills match the selected filters. Try adjusting them.'
                  : 'No completed entries match the selected filters. Try adjusting them.'}
              />
            ) : (
              <div className="table-wrapper mt-3 max-h-[600px] overflow-auto">
                <table>
                  <thead className="sticky top-0 z-10">
                    <tr>
                      {isDue ? (
                        <>
                          <th className="text-center w-14">S.No</th>
                          <th className="text-center">Bill Nature</th>
                          <th className="text-center">Bill Type</th>
                          <th className="text-left">Bill / EXP No</th>
                          <th className="text-center">INV Date</th>
                          <th className="text-center">Company</th>
                          <th className="text-center">Co Name</th>
                          <th className="text-center">Head</th>
                          <th className="text-center">Particulars</th>
                          <th className="text-right">Net</th>
                          <th className="text-right">GST</th>
                          <th className="text-right">TDS</th>
                          <th className="text-right">Gross</th>
                          <th className="text-center whitespace-nowrap min-w-[120px]">DUE Date</th>
                          <th className="text-center">Payment Status</th>
                        </>
                      ) : (
                        <>
                          <th className="text-center w-14">S.No</th>
                          <th className="text-center">Bill Nature</th>
                          <th className="text-center">EXP Type</th>
                          <th className="text-left">EXP No</th>
                          <th className="text-center whitespace-nowrap">INV Date</th>
                          <th className="text-center">Company</th>
                          <th className="text-center">Co Name</th>
                          <th className="text-center">Head</th>
                          <th className="text-center">Particulars</th>
                          <th className="text-center">Type</th>
                          <th className="text-right">Net</th>
                          <th className="text-right">GST</th>
                          <th className="text-right">TDS</th>
                          <th className="text-right">Gross</th>
                          <th className="text-center whitespace-nowrap">Payment Method</th>
                          <th className="text-center whitespace-nowrap">Payment Date</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {(preview.entries || []).map((e, index) => (
                      <tr key={e._id}>
                        {isDue ? (
                          <>
                            <td className="text-center summary-head-report-index font-semibold">{index + 1}</td>
                            <td className="text-center">{e.expenseNature || '—'}</td>
                            <td className="text-center">{e.expenseType || '—'}</td>
                            <td className="text-left">
                              <Link
                                to={`/entries/${e._id}`}
                                state={{ from: returnTo }}
                                className="table-serial-link font-medium text-primary-700 hover:text-primary-900 hover:underline"
                                title={`View ${getSerialLabel(e.slNo).toLowerCase()} details`}
                              >
                                {formatMerSerial(e.slNo) || '—'}
                              </Link>
                            </td>
                            <td className="text-center whitespace-nowrap">{formatDate(e.invoiceDate)}</td>
                            <td className="text-center">{companyCode(e.company)}</td>
                            <td className="text-center">{e.coNames || '—'}</td>
                            <td className="text-center">{e.headOfExpense || '—'}</td>
                            <td className="text-center max-w-[220px] truncate" title={e.particulars}>{e.particulars || '—'}</td>
                            <td className="text-right">{formatCurrency(e.netAmount)}</td>
                            <td className="text-right text-emerald-700">{formatCurrency(e.totalGST)}</td>
                            <td className="text-right text-orange-700">{formatCurrency(e.tds)}</td>
                            <td className="text-right font-semibold">{formatCurrency(e.grossAmount)}</td>
                            <td className="text-center whitespace-nowrap">{formatDate(e.dueDate)}</td>
                            <td className="text-center">{getPaymentStatusLabel(e.status)}</td>
                          </>
                        ) : (
                          <>
                            <td className="text-center summary-head-report-index font-semibold">{index + 1}</td>
                            <td className="text-center">{e.expenseNature || '—'}</td>
                            <td className="text-center">{e.expenseType || '—'}</td>
                            <td className="text-left">
                              <Link
                                to={`/entries/${e._id}`}
                                state={{ from: returnTo }}
                                className="table-serial-link font-medium text-primary-700 hover:text-primary-900 hover:underline"
                                title={`View ${getSerialLabel(e.slNo).toLowerCase()} details`}
                              >
                                {formatMerSerial(e.slNo) || '—'}
                              </Link>
                            </td>
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
                            <td className="text-center whitespace-nowrap">{e.paymentMethod || '—'}</td>
                            <td className="text-center whitespace-nowrap">{formatDate(e.paymentDate)}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

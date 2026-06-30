import { useCallback, useEffect, useMemo, useState } from 'react';
import { Paper, Text, Table, Loader, Center, SimpleGrid } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchReportSummary,
  fetchHeadSummary,
} from '../../store/slices/reportSlice';
import PageBanner from '../../components/common/PageBanner';
import FilterPanel from '../../components/common/FilterPanel';
import FilterSelect from '../../components/common/FilterSelect';
import StatCard from '../../components/common/StatCard';
import EmptyState from '../../components/common/EmptyState';
import { formatCurrency, formatDate, buildCustomizedReportFilename } from '../../utils/format';
import { getRecentFinancialYearOptions } from '../../utils/financialYear';
import { omitPaymentFilters } from '../../utils/filters';
import { reportApi } from '../../api/report.api';
import { downloadBlob } from '../../utils/download';

const iconClass =
  'w-5 h-5 sm:w-6 sm:h-6 xl:w-7 xl:h-7 max-[1660px]:w-6 max-[1660px]:h-6 max-[1536px]:w-5 max-[1536px]:h-5 max-[1366px]:w-[18px] max-[1366px]:h-[18px] max-[1280px]:w-4 max-[1280px]:h-4';

const MER_TYPE_OPTIONS = [
  { value: 'BANK', label: 'Bank' },
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CARD', label: 'Debit/Credit Card' },
];

const MER_TYPE_LABEL = { BANK: 'Bank', CASH: 'Cash', UPI: 'UPI', CARD: 'Debit/Credit Card' };

const FILTER_LABELS = {
  financialYear: 'FY',
  month: 'Month',
  company: 'Company',
  location: 'Location',
  expenseType: 'Expense Type',
  merType: 'MER Type',
};

const filterChipValue = (key, value) => (key === 'merType' ? MER_TYPE_LABEL[value] || value : value);

const downloadIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const cleanParams = (params) => {
  const out = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') out[key] = value;
  });
  return out;
};

export default function SummaryReportPage() {
  const dispatch = useDispatch();
  const { lookups } = useSelector((state) => state.common);
  const { summary, headSummary, loading } = useSelector((state) => state.report);
  const [filters, setFilters] = useState({});
  const [exportingSummary, setExportingSummary] = useState(false);
  const [downloadFilters, setDownloadFilters] = useState({});
  const [exportingReport, setExportingReport] = useState(false);
  const [filtersKey, setFiltersKey] = useState(0);
  const [preview, setPreview] = useState(null);
  const [generating, setGenerating] = useState(false);

  const companyCodeByName = lookups?.companyCodeByName || {};
  const hasSelectedFY = Boolean(downloadFilters.financialYear);
  const optionalFiltersEnabled = hasSelectedFY;

  const load = useCallback((f) => {
    const params = omitPaymentFilters(f ?? filters);
    dispatch(fetchReportSummary(params));
    dispatch(fetchHeadSummary(params));
  }, [dispatch, filters]);

  useEffect(() => {
    dispatch(fetchReportSummary(omitPaymentFilters({})));
    dispatch(fetchHeadSummary(omitPaymentFilters({})));
  }, [dispatch]);

  const monthOptions = useMemo(
    () => (lookups?.months || []).map((m) => ({ value: m, label: m })),
    [lookups?.months],
  );
  const companyOptions = useMemo(
    () => (lookups?.companies || []).map((c) => ({ value: c, label: c })),
    [lookups?.companies],
  );
  const fyOptions = useMemo(
    () => getRecentFinancialYearOptions(lookups?.currentFinancialYear, 2),
    [lookups?.currentFinancialYear],
  );
  const companyLocations = lookups?.companyLocations;
  const allLocations = lookups?.locations;
  const locationOptions = useMemo(() => {
    const scoped = downloadFilters.company && companyLocations?.[downloadFilters.company];
    const list = scoped || allLocations;
    return (list || []).map((l) => ({ value: l, label: l }));
  }, [downloadFilters.company, companyLocations, allLocations]);
  const expenseTypeOptions = useMemo(
    () => (lookups?.expenseTypes || []).map((t) => ({ value: t, label: t })),
    [lookups?.expenseTypes],
  );

  const updateFilter = (key, value) => {
    setDownloadFilters((prev) => {
      const next = { ...prev, [key]: value || undefined };
      if (key === 'company' && value !== prev.company) {
        const valid = lookups?.companyLocations?.[value];
        if (valid && prev.location && !valid.includes(prev.location)) {
          next.location = undefined;
        }
      }
      return next;
    });
  };

  const resetFilters = () => {
    setDownloadFilters({});
    setFiltersKey((k) => k + 1);
    setPreview(null);
  };

  const exportExcel = async () => {
    if (exportingSummary) return;
    setExportingSummary(true);
    try {
      const { data } = await reportApi.exportSummaryExcel(omitPaymentFilters(filters));
      downloadBlob(data, 'mer-summary-report.xlsx');
      notifications.show({ message: 'Excel download started', color: 'green' });
    } catch {
      notifications.show({ message: 'Failed to download Excel', color: 'red' });
    } finally {
      setExportingSummary(false);
    }
  };

  const runExport = async (params, filenameHint) => {
    if (exportingReport) return;
    setExportingReport(true);
    try {
      const { data } = await reportApi.exportMonthlyExcel(params);
      const filename = filenameHint
        || buildCustomizedReportFilename(params, companyCodeByName);
      downloadBlob(data, filename);
      notifications.show({ message: 'Excel download started', color: 'green' });
    } catch {
      notifications.show({ message: 'Failed to download Excel', color: 'red' });
    } finally {
      setExportingReport(false);
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
      <PageBanner
        className="mb-4"
        title="Summary Report"
        subtitle={`Total Entries · ${summary?.entryCount ?? 0}`}
        action={{ onClick: exportExcel, label: 'Download Excel' }}
      />
      <div className="dashboard-grid-4 mb-4">
        <StatCard
          label="Gross Amount"
          value={formatCurrency(summary?.grossAmount)}
          color="text-indigo-700"
          iconBg="bg-indigo-100"
          accent="bg-indigo-500"
          icon={
            <svg className={`${iconClass} text-indigo-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          }
        />
        <StatCard
          label="Total Net"
          value={formatCurrency(summary?.totalNetAmount)}
          color="text-blue-700"
          iconBg="bg-blue-100"
          accent="bg-blue-500"
          icon={
            <svg className={`${iconClass} text-blue-600`} viewBox="0 0 320 512" fill="currentColor">
              <path d="M308 96c6.627 0 12-5.373 12-12V44c0-6.627-5.373-12-12-12H12C5.373 32 0 37.373 0 44v44.748c0 6.627 5.373 12 12 12h85.28c27.308 0 48.261 9.958 60.97 27.252H12c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h158.757c-6.217 36.086-36.075 58.952-72.757 58.952H12c-6.627 0-12 5.373-12 12v53.012c0 3.349 1.4 6.546 3.861 8.818l165.052 152.356a12.001 12.001 0 0 0 8.139 3.182h82.562c10.924 0 16.166-13.408 8.139-20.818L116.871 319.906c76.499-2.34 131.144-53.395 138.318-127.906H308c6.627 0 12-5.373 12-12v-40c0-6.627-5.373-12-12-12h-48.19c-3.003-11.891-7.922-23.738-14.932-34H308z" />
            </svg>
          }
        />
        <StatCard
          label="Total GST"
          value={formatCurrency(summary?.totalGST)}
          color="text-emerald-700"
          iconBg="bg-emerald-100"
          accent="bg-emerald-500"
          icon={
            <svg className={`${iconClass} text-emerald-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
            </svg>
          }
        />
        <StatCard
          label="Total TDS"
          value={formatCurrency(summary?.totalTDS)}
          color="text-orange-700"
          iconBg="bg-orange-100"
          accent="bg-orange-500"
          icon={
            <svg className={`${iconClass} text-orange-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
            </svg>
          }
        />
      </div>
      <FilterPanel filters={filters} onChange={setFilters} onApply={() => load()} onClear={() => { setFilters({}); load({}); }} hide={['search', 'approvalStatus', 'coNames']} />
      {loading && !summary ? (
        <Center py="xl"><Loader /></Center>
      ) : (
        <>
          <Paper withBorder p="md" radius="md" mb="lg">
            <Text fw={600} mb="md">Expense Summary</Text>
            <Table size="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th ta="left">SL No</Table.Th>
                  <Table.Th ta="center">Head</Table.Th>
                  <Table.Th ta="right">Net</Table.Th>
                  <Table.Th ta="right">GST</Table.Th>
                  <Table.Th ta="right">TDS</Table.Th>
                  <Table.Th ta="right">Gross</Table.Th>
                  <Table.Th ta="center">Count</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {headSummary.map((h, index) => (
                  <Table.Tr key={h._id}>
                    <Table.Td ta="left">{index + 1}</Table.Td>
                    <Table.Td ta="center">{h._id}</Table.Td>
                    <Table.Td ta="right">{formatCurrency(h.net)}</Table.Td>
                    <Table.Td ta="right">{formatCurrency(h.gst)}</Table.Td>
                    <Table.Td ta="right">{formatCurrency(h.tds)}</Table.Td>
                    <Table.Td ta="right">{formatCurrency(h.gross)}</Table.Td>
                    <Table.Td ta="center">{h.count}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>

          <div className="card p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <div>
                <h3 className="text-md font-bold text-gray-800">Month-wise Customized Reports</h3>
                <p className="text-sm text-gray-500">
                  Select a financial year (required), then optionally filter by month, company, location, expense type, or MER type.
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
              <FilterSelect
                placeholder="Location / Branch"
                clearable
                searchable
                disabled={!optionalFiltersEnabled}
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
                data={MER_TYPE_OPTIONS}
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
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
            <div className="card p-0 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 bg-gradient-to-r from-primary-50 via-blue-50 to-indigo-50 border-b border-gray-100">
                <div className="min-w-0">
                  <h3 className="text-md font-bold text-gray-800">Report Preview</h3>
                  {preview.reportNo && (
                    <p className="text-sm font-semibold text-primary-700 mt-0.5">{preview.reportNo}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {Object.entries(preview.params)
                      .filter(([key]) => FILTER_LABELS[key])
                      .map(([key, value]) => (
                        <span
                          key={key}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-primary-200 text-primary-700 text-[11px] font-semibold"
                        >
                          {FILTER_LABELS[key]}: {filterChipValue(key, value)}
                        </span>
                      ))}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={exportingReport || preview.count === 0}
                  onClick={() => runExport(preview.params, preview.filename)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {downloadIcon}
                  {exportingReport ? 'Preparing...' : 'Download Report'}
                </button>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-5">
                {[
                  { label: 'Total Net', value: preview.totals?.net, color: 'text-blue-700', bg: 'bg-blue-50' },
                  { label: 'Total GST', value: preview.totals?.gst, color: 'text-emerald-700', bg: 'bg-emerald-50' },
                  { label: 'Total TDS', value: preview.totals?.tds, color: 'text-orange-700', bg: 'bg-orange-50' },
                  { label: 'Gross Amount', value: preview.totals?.gross, color: 'text-indigo-700', bg: 'bg-indigo-50' },
                ].map((tile) => (
                  <div key={tile.label} className={`rounded-xl border border-gray-100 ${tile.bg} px-4 py-3`}>
                    <p className={`text-xl font-bold tracking-tight ${tile.color}`}>{formatCurrency(tile.value)}</p>
                    <p className="text-xs text-gray-500 font-semibold mt-0.5">{tile.label}</p>
                  </div>
                ))}
              </div>

              {preview.count === 0 ? (
                <EmptyState
                  title="No matching entries"
                  description="No completed entries match the selected filters. Try adjusting them."
                />
              ) : (
                <div className="table-wrapper max-h-[460px] overflow-auto border-t border-gray-100">
                  <table>
                    <thead className="sticky top-0 z-10">
                      <tr>
                        <th className="text-left">Expense No</th>
                        <th className="text-center">Date</th>
                        <th className="text-left">Company</th>
                        <th className="text-left">Co Name</th>
                        <th className="text-left">Head</th>
                        <th className="text-left">Particulars</th>
                        <th className="text-center">Type</th>
                        <th className="text-right">Net</th>
                        <th className="text-right">GST</th>
                        <th className="text-right">TDS</th>
                        <th className="text-right">Gross</th>
                        <th className="text-center">Payment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.entries.map((e) => (
                        <tr key={e._id}>
                          <td className="text-left font-medium text-gray-700">{e.slNo || '—'}</td>
                          <td className="text-center whitespace-nowrap">{formatDate(e.invoiceDate)}</td>
                          <td className="text-left">{e.company || '—'}</td>
                          <td className="text-left">{e.coNames || '—'}</td>
                          <td className="text-left">{e.headOfExpense || '—'}</td>
                          <td className="text-left max-w-[220px] truncate" title={e.particulars}>{e.particulars || '—'}</td>
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
        </>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { notifications } from '@mantine/notifications';
import PageBanner from '../../components/common/PageBanner';
import StatCard from '../../components/common/StatCard';
import EmptyState from '../../components/common/EmptyState';
import ReportDetailSkeleton from '../../components/common/ReportDetailSkeleton';
import {
  formatCurrency,
  formatDate,
  buildCustomizedReportFilename,
  buildCustomizedReportNo,
} from '../../utils/format';
import { reportApi } from '../../api/report.api';
import { downloadBlob } from '../../utils/download';

const iconClass =
  'w-5 h-5 sm:w-6 sm:h-6 xl:w-7 xl:h-7 max-[1660px]:w-6 max-[1660px]:h-6 max-[1536px]:w-5 max-[1536px]:h-5 max-[1366px]:w-[18px] max-[1366px]:h-[18px] max-[1280px]:w-4 max-[1280px]:h-4';

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

export default function FinancialYearDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const returnTo = `${location.pathname}${location.search}`;
  const { lookups } = useSelector((state) => state.common);
  const companyCodeByName = lookups?.companyCodeByName || {};
  const companyCode = (name) => companyCodeByName[name] || name || '—';
  const financialYear = searchParams.get('fy') || '';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const params = cleanParams({ financialYear });
        const res = await reportApi.monthlyDetailed(params);
        if (active) setData(res.data.data);
      } catch {
        if (active) {
          setData(null);
          notifications.show({ message: 'Failed to load financial year report', color: 'red' });
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [financialYear]);

  const runExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const params = cleanParams({ financialYear });
      const res = await reportApi.exportMonthlyExcel(params);
      downloadBlob(
        res.data,
        buildCustomizedReportFilename(params, companyCodeByName),
      );
      notifications.show({ message: 'Excel download started', color: 'green' });
    } catch {
      notifications.show({ message: 'Failed to download Excel', color: 'red' });
    } finally {
      setExporting(false);
    }
  };

  const totals = data?.totals || {};
  const entries = data?.entries || [];
  const count = data?.count ?? 0;
  const reportNo = data?.reportNo || buildCustomizedReportNo({ financialYear }, companyCodeByName);

  if (loading && !data) {
    return <ReportDetailSkeleton />;
  }

  return (
    <div className="w-full max-w-[90rem] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate('/reports/financial-year')}
          className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-primary-700 bg-primary-50 border border-primary-200 hover:bg-primary-100 hover:border-primary-400 hover:text-primary-900 active:scale-95 transition-all duration-150"
        >
          {backIcon}
          Back to FY Report
        </button>
        <button
          type="button"
          disabled={exporting || loading || count === 0}
          onClick={runExport}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {downloadIcon}
          {exporting ? 'Preparing...' : 'Download Report'}
        </button>
      </div>

      <PageBanner
        className="mb-4"
        title={reportNo || `${financialYear || 'Financial Year'} Report`}
        subtitle={`${financialYear || 'Financial Year'} · ${count} ${count === 1 ? 'entry' : 'entries'}`}
      />

      <div className="dashboard-grid-4 mb-4">
        <StatCard
          label="Gross Amount"
          value={formatCurrency(totals.gross)}
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
          value={formatCurrency(totals.net)}
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
          value={formatCurrency(totals.gst)}
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
          value={formatCurrency(totals.tds)}
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

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
          <h3 className="report-table-title text-sm font-bold text-gray-800 uppercase tracking-wide">
            Expense Entries
          </h3>
        </div>

        {count === 0 ? (
          <EmptyState
            title="No entries"
            description="No completed entries are available for this financial year."
          />
        ) : (
          <div className="table-wrapper mt-3 max-h-[600px] overflow-auto">
            <table>
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="text-center w-14">S.No</th>
                  <th className="text-left">Expense No</th>
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
                {entries.map((e, index) => (
                  <tr key={e._id}>
                    <td className="text-center summary-head-report-index font-semibold">{index + 1}</td>
                    <td className="text-left">
                      <Link
                        to={`/entries/${e._id}`}
                        state={{ from: returnTo }}
                        className="table-serial-link font-medium text-primary-700 hover:text-primary-900 hover:underline"
                        title="View expense details"
                      >
                        {e.slNo || '—'}
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
                    <td className="text-center">{e.paymentMethod || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

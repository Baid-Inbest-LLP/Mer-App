import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Skeleton from '../common/Skeleton';
import {
  formatCurrency,
  formatDate,
  formatMerSerial,
  getApprovalStatusBadge,
} from '../../utils/format';

export default function RecentMerEntries({ entries = [], loading }) {
  const { lookups } = useSelector((state) => state.common);
  const companyCode = (name) => lookups?.companyCodeByName?.[name] || name || '—';
  const recent = (entries || []).slice(0, 5);

  if (loading && !recent.length) {
    return (
      <div className="card overflow-hidden recent-entries">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 chart-card-header">
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="recent-entries-list">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="recent-entries-row">
              <div className="flex items-center gap-3 flex-1">
                <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-28 mb-2" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden recent-entries">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between chart-card-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-100 recent-entries-header-icon flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-indigo-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-sm sm:text-base lg:text-lg xl:text-xl font-semibold text-gray-700 tracking-tight">
            Recent Expense Entries
          </h3>
        </div>
        <Link to="/entries" className="recent-entries-view-all text-base font-semibold hover:underline">
          View all
        </Link>
      </div>
      <div className="recent-entries-list">
        {recent.length === 0 && (
          <div className="px-6 py-10 text-center">
            <svg className="recent-entries-empty-icon w-10 h-10 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="recent-entries-empty-text text-sm">No expense entries yet</p>
          </div>
        )}
        {recent.map((entry) => (
          <Link
            key={entry._id}
            to={`/entries/${entry._id}`}
            className="recent-entries-row group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="recent-entries-row-icon">
                <svg className="w-4 h-4 text-gray-500 group-hover:text-primary-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="recent-entries-row-title">
                  {entry.slNo ? formatMerSerial(entry.slNo) : '—'}
                </p>
                <p className="recent-entries-row-meta">
                  {companyCode(entry.company)} · {entry.coNames || '—'} · {formatDate(entry.invoiceDate)}
                </p>
              </div>
            </div>
            <div className="text-right flex items-center gap-3 shrink-0 ml-3">
              <div>
                <p className="recent-entries-amount">{formatCurrency(entry.grossAmount)}</p>
                <span className={`${getApprovalStatusBadge(entry.approvalStatus)} !text-[10px]`}>
                  {entry.approvalStatus || 'Pending'}
                </span>
              </div>
              <svg className="recent-entries-chevron" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

import { useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchExpense, clearCurrent } from '../../store/slices/expenseSlice';
import ApprovalActions from '../../components/expenses/ApprovalActions';
import ExpenseViewSkeleton from '../../components/common/ExpenseViewSkeleton';
import {
  formatAmountInWords,
  formatCurrency,
  formatDate,
  formatMerSerial,
  getEntryApprovalBadge,
  getEntryApprovalLabel,
  getApprovalStatusGradient,
} from '../../utils/format';
import { canEditExpense } from '../../utils/permissions';
import { getPaymentMethodRules } from '../../utils/paymentMethods';
import { isAdmin } from '../../constants/roles';

function StatItem({ iconBg, iconColor, icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`detail-stat-icon detail-stat-icon-lg w-12 h-12 rounded-xl ${iconBg} ${iconColor}`}>{icon}</div>
      <div>
        <p className="expense-stat-label text-[11px] uppercase font-semibold tracking-wider">{label}</p>
        <p className="expense-stat-value text-sm font-semibold mt-0.5">{value ?? '—'}</p>
      </div>
    </div>
  );
}

function DetailCard({ title, iconBg, iconColor, icon, children }) {
  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center`}>
          <div className={iconColor}>{icon}</div>
        </div>
        <h3 className="detail-card-title text-sm font-bold uppercase tracking-wide">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="detail-row flex justify-between gap-4 py-2 last:border-0">
      <span className="detail-row-label text-sm">{label}</span>
      <span className="detail-row-value text-sm font-medium text-right">{value ?? '—'}</span>
    </div>
  );
}

const TIMELINE_EVENT_META = {
  created: {
    label: 'Created',
    dotClass: 'bg-blue-500',
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  approved: {
    label: 'Approved',
    dotClass: 'bg-emerald-500',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  completed: {
    label: 'Completed',
    dotClass: 'bg-indigo-500',
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
};

function buildTimelineEvents(expense) {
  const events = [];

  if (expense.createdAt) {
    events.push({
      key: 'created',
      ...TIMELINE_EVENT_META.created,
      date: expense.createdAt,
      actor: expense.createdBy?.name,
    });
  }
  if (expense.approvedAt) {
    events.push({
      key: 'approved',
      ...TIMELINE_EVENT_META.approved,
      date: expense.approvedAt,
      actor: expense.approvedBy?.name,
    });
  }
  if (expense.completedAt) {
    events.push({
      key: 'completed',
      ...TIMELINE_EVENT_META.completed,
      date: expense.completedAt,
      actor: expense.completedBy?.name,
    });
  }

  return events;
}

function ActivityTimelineSidebar({ expense }) {
  const events = buildTimelineEvents(expense);

  if (events.length === 0) return null;

  return (
    <aside className="expense-timeline-sidebar card p-5 w-full">
      <div className="expense-timeline-header flex items-center justify-between gap-2 pb-4 mb-1">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="expense-timeline-header-icon w-9 h-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h2 className="expense-timeline-title text-sm font-bold">Activity</h2>
          </div>
        </div>
      </div>

      <ol className="expense-timeline-line relative ml-3 border-l-2">
        {events.map((event, index) => (
          <li key={event.key} className={`relative pl-6 ${index < events.length - 1 ? 'pb-5' : ''}`}>
            <span
              className={`expense-timeline-dot absolute -left-[7px] top-1 h-3 w-3 rounded-full ring-4 ${event.dotClass}`}
              aria-hidden="true"
            />
            <div
              className={`w-7 h-7 rounded-md flex items-center justify-center mb-2 ${event.iconBg} ${event.iconColor}`}
            >
              {event.icon}
            </div>
            <p className="expense-timeline-event-title text-sm font-semibold leading-tight">{event.label}</p>
            <p className="expense-timeline-event-date text-xs mt-1">{formatDate(event.date)}</p>
            <p className="expense-timeline-event-by text-xs mt-1.5 leading-snug">
              <span className="expense-timeline-event-actor-label">By</span>{' '}
              <span className="expense-timeline-event-actor font-medium">{event.actor || '—'}</span>
            </p>
          </li>
        ))}
      </ol>
    </aside>
  );
}

const isSafeInternalPath = (path) =>
  typeof path === 'string' && path.startsWith('/') && !path.startsWith('//');

const getBackNav = (from) => {
  if (!isSafeInternalPath(from)) {
    return { to: '/entries', label: 'Back to Expense Entries' };
  }
  if (from.startsWith('/reports/monthly/detail')) {
    const params = new URLSearchParams(from.split('?')[1] || '');
    const month = params.get('month');
    return {
      to: from,
      label: month ? `Back to ${month} Report` : 'Back to Monthly Report',
    };
  }
  return { to: from, label: 'Back' };
};

export default function ExpenseViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const backNav = getBackNav(location.state?.from);
  const { current, loading } = useSelector((state) => state.expense);
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    dispatch(fetchExpense(id));
    return () => dispatch(clearCurrent());
  }, [dispatch, id]);

  if (loading || !current) {
    return <ExpenseViewSkeleton />;
  }

  const e = current;
  const paymentRules = getPaymentMethodRules(e.paymentMethod);
  const editable = canEditExpense(e, user);
  const serial = e.isDraft ? 'Draft Entry' : formatMerSerial(e.slNo);
  const gradient = e.isDraft ? 'from-slate-400 to-slate-600' : getApprovalStatusGradient(e.approvalStatus);

  return (
    <div className="expense-view-page w-full max-w-[90rem] mx-auto space-y-6">
      <button
        type="button"
        onClick={() => navigate(backNav.to)}
        className="expense-view-back-btn group"
      >
        <svg
          className="w-4 h-4 transition-transform duration-150 group-hover:-translate-x-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {backNav.label}
      </button>

      <div className="expense-view-layout">
        <div className="min-w-0 space-y-3">
          <div className="card overflow-hidden">
            <div className={`h-1.5 bg-gradient-to-r ${gradient}`} />

            <div className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
                <div>
                  <div className="flex flex-wrap items-center gap-3 mb-1">
                    <h1 className="expense-view-title text-2xl font-bold tracking-tight">{serial || 'Expense Entry'}</h1>
                    <span className={`${getEntryApprovalBadge(e)} !text-xs`}>
                      {getEntryApprovalLabel(e)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {isAdmin(user?.role) && (
                    <ApprovalActions expense={e} onSuccess={() => dispatch(fetchExpense(id))} />
                  )}
                  {editable && (
                    <button
                      type="button"
                      onClick={() => navigate(`/entries/${id}/edit`)}
                      className="btn-secondary text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                      {e.isDraft ? 'Continue Draft' : 'Edit'}
                    </button>
                  )}
                </div>
              </div>

              <div className="expense-section-divider">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
                  <StatItem
                    iconBg="bg-blue-50"
                    iconColor="text-blue-600"
                    label="Month"
                    value={e.month}
                    icon={
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    }
                  />
                  <StatItem
                    iconBg="bg-purple-50"
                    iconColor="text-purple-600"
                    label="Invoice Date"
                    value={formatDate(e.invoiceDate)}
                    icon={
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    }
                  />
                  <StatItem
                    iconBg="bg-amber-50"
                    iconColor="text-amber-600"
                    label="Expense Type"
                    value={e.expenseType}
                    icon={
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                    }
                  />
                  <StatItem
                    iconBg="bg-emerald-50"
                    iconColor="text-emerald-600"
                    label="Gross Amount"
                    value={formatCurrency(e.grossAmount)}
                    icon={
                      <svg className="w-5 h-5" viewBox="0 0 320 512" fill="currentColor">
                        <path d="M308 96c6.627 0 12-5.373 12-12V44c0-6.627-5.373-12-12-12H12C5.373 32 0 37.373 0 44v44.748c0 6.627 5.373 12 12 12h85.28c27.308 0 48.261 9.958 60.97 27.252H12c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h158.757c-6.217 36.086-36.075 58.952-72.757 58.952H12c-6.627 0-12 5.373-12 12v53.012c0 3.349 1.4 6.546 3.861 8.818l165.052 152.356a12.001 12.001 0 0 0 8.139 3.182h82.562c10.924 0 16.166-13.408 8.139-20.818L116.871 319.906c76.499-2.34 131.144-53.395 138.318-127.906H308c6.627 0 12-5.373 12-12v-40c0-6.627-5.373-12-12-12h-48.19c-3.003-11.891-7.922-23.738-14.932-34H308z" />
                      </svg>
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <DetailCard
              title="Expense Details"
              iconBg="bg-indigo-100"
              iconColor="text-indigo-600"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              }
            >
              <DetailRow label="Invoice No" value={e.invoiceNo} />
              <DetailRow label="Company" value={e.company} />
              <DetailRow label="Location" value={e.location} />
              <DetailRow label="Head of Expense" value={e.headOfExpense} />
              <DetailRow label="Particulars" value={e.particulars} />
              <DetailRow label="Co Name" value={e.coNames} />
              <DetailRow label="MER Type" value={e.merType || e.paymentMethod} />
              <DetailRow label="Payment Method" value={e.paymentMethod} />
            </DetailCard>

            <DetailCard
              title="Payment & Tax"
              iconBg="bg-teal-100"
              iconColor="text-teal-600"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }
            >
              <DetailRow label="Net Amount" value={formatCurrency(e.netAmount)} />
              <DetailRow label="GST %" value={`${e.gstPercent}%`} />
              <DetailRow label="Total GST" value={formatCurrency(e.totalGST)} />
              <DetailRow label="TDS" value={formatCurrency(e.tds)} />
              <DetailRow label="Gross Amount" value={formatCurrency(e.grossAmount)} />
              <DetailRow label="Payment Date" value={formatDate(e.paymentDate)} />
              {e.bankAccountNumber ? (
                <DetailRow label="Bank Account" value={e.bankAccountNumber} />
              ) : null}
              <DetailRow
                label={paymentRules.paymentRefLabel || 'Payment Ref'}
                value={e.paymentRefNumber}
              />
            </DetailCard>
          </div>

          <div className="card overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <div className="expense-summary-icon detail-stat-icon w-8 h-8 rounded-lg bg-primary-100 text-primary-700">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <h3 className="expense-summary-title text-sm font-bold text-gray-800 uppercase tracking-wide">Expense Summary</h3>
              </div>

              <div className="flex gap-4">
                <div className="flex lg:flex-col items-stretch gap-4 w-full">
                  <div className="flex-1 min-w-0">
                    <div className="px-4 py-2 relative overflow-hidden rounded-lg">
                      <div className="absolute -top-8 -right-8 w-28 h-28 bg-primary-100/40 rounded-full expense-summary-decor" />
                      <div className="relative">
                        <ul className="divide-y divide-primary-100/70 expense-summary-list">
                          <li className="flex items-center justify-between gap-4 py-2.5">
                            <span className="expense-summary-list-label text-sm text-gray-500 capitalize font-semibold tracking-wider whitespace-nowrap">
                              Head of Expense:
                            </span>
                            <span className="expense-summary-list-value text-gray-700 text-md capitalize font-semibold">{e.headOfExpense ? e.headOfExpense : '—'}</span>
                          </li>
                          <li className="flex items-center justify-between gap-4 py-2.5">
                            <span className="expense-summary-list-label text-sm text-gray-500 capitalize font-semibold tracking-wider whitespace-nowrap">
                              Particulars:
                            </span>
                            <span className="expense-summary-list-value text-gray-700 text-md capitalize font-semibold">{e.particulars ? e.particulars : '—'}</span>
                          </li>
                          <li className="flex items-center justify-between gap-4 py-2.5">
                            <span className="expense-summary-list-label text-sm text-gray-500 capitalize font-semibold tracking-wider whitespace-nowrap">
                              Co / Payee Name:
                            </span>
                            <span className="expense-summary-list-value text-gray-700 text-md capitalize font-semibold">{e.coNames ? e.coNames : '—'}</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="expense-amount-words-box rounded-lg border border-gray-200 bg-gray-50/80 p-2">
                    <p className="expense-amount-words-label text-[14px] text-gray-500 uppercase font-semibold tracking-wider">
                      Amount in Words
                    </p>
                    <p className="expense-amount-words-value text-lg text-primary-700 font-bold leading-relaxed mt-1">
                      {formatAmountInWords(e.grossAmount)}
                    </p>
                  </div>
                </div>
                <div className="expense-totals-box w-full lg:w-1/3 flex-shrink-0 rounded-2xl border border-gray-200 bg-gray-50/80 p-5 space-y-3">
                  <div className="flex justify-between items-center text-sm py-1">
                    <span className="expense-totals-row-label text-gray-500 font-medium">Net Amount</span>
                    <span className="expense-totals-row-value font-bold text-gray-800 text-base">{formatCurrency(e.netAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm py-1">
                    <span className="expense-totals-row-label text-gray-500 font-medium">Total GST</span>
                    <span className="expense-totals-row-value-gst font-bold text-emerald-700 text-base">{formatCurrency(e.totalGST)}</span>
                  </div>
                  {Number(e.tds) > 0 && (
                    <div className="flex justify-between items-center text-sm py-1">
                      <span className="expense-totals-row-label text-gray-500 font-medium">TDS</span>
                      <span className="expense-totals-row-value-tds font-bold text-red-700 text-base">{formatCurrency(e.tds)}</span>
                    </div>
                  )}
                  <div className="expense-totals-gross-divider border-t-2 border-gray-900 pt-4 mt-2 flex justify-between items-baseline">
                    <span className="expense-totals-gross-label font-bold text-gray-900 text-lg">Gross Total</span>
                    <span className="expense-totals-gross-value text-2xl font-bold text-primary-700 tracking-tight">
                      {formatCurrency(e.grossAmount)}
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
        <ActivityTimelineSidebar expense={e} />
      </div>
    </div>
  );
}

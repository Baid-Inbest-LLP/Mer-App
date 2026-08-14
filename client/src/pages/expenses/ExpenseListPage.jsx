import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { notifications } from '@mantine/notifications';
import { fetchExpenses, deleteExpense, setQueryParams } from '../../store/slices/expenseSlice';
import PageBanner from '../../components/common/PageBanner';
import FilterPanel from '../../components/common/FilterPanel';
import EmptyState from '../../components/common/EmptyState';
import ConfirmModal from '../../components/common/ConfirmModal';
import Pagination from '../../components/common/Pagination';
import Skeleton from '../../components/common/Skeleton';
import {
  formatCurrency,
  formatDate,
  formatDaysToClear,
  formatMerSerial,
  getEntryApprovalBadge,
  getEntryApprovalLabel,
  getPaymentStatusBadge,
  getPaymentStatusLabel,
  resolveDaysToClear,
} from '../../utils/format';
import { canDeleteExpense, canEditExpense } from '../../utils/permissions';
import { omitPaymentFilters, cleanFilterParams, stripExpenseListHiddenFilters } from '../../utils/filters';
import WhatsAppShareButton from '../../components/expenses/WhatsAppShareButton';
import { useShareBill } from '../../components/expenses/ShareBillModal';

const PAGE_SIZE = 6;

export default function ExpenseListPage({ embedded = false, statusFilter = null, variant = 'all' }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { list, pagination, loading, queryParams, summary } = useSelector((state) => state.expense);
  const { user } = useSelector((state) => state.auth);
  const { lookups } = useSelector((state) => state.common);

  const isPaidView = variant === 'paid';
  const companyCode = (name) => lookups?.companyCodeByName?.[name] || name || '—';
  const [filters, setFilters] = useState(queryParams);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const { openShare, shareModal } = useShareBill();
  const totals = summary?.totals || {};

  const load = (params = queryParams) => {
    const base = omitPaymentFilters({
      limit: PAGE_SIZE,
      includeDrafts: !isPaidView,
      ...params,
    });
    if (statusFilter) base.status = statusFilter;
    else delete base.status;
    const cleaned = cleanFilterParams(base);
    dispatch(setQueryParams(cleaned));
    dispatch(fetchExpenses(cleaned));
  };

  useEffect(() => {
    load({ page: 1, limit: PAGE_SIZE });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, variant]);

  const handleApply = () =>
    load({ ...stripExpenseListHiddenFilters(omitPaymentFilters(filters)), page: 1 });
  const handleClear = () => {
    setFilters({});
    load({ page: 1, limit: PAGE_SIZE });
  };

  const handleDelete = async () => {
    setDeleting(true);
    const result = await dispatch(deleteExpense(deleteId));
    setDeleting(false);
    setDeleteId(null);
    if (deleteExpense.fulfilled.match(result)) {
      notifications.show({ message: 'Entry deleted', color: 'green' });
      load();
    }
  };

  return (
    <div>
      {!embedded && (
        <PageBanner
          className="mb-4"
          title={isPaidView ? 'Expenses (Paid)' : 'Bills'}
          subtitle={
            isPaidView
              ? `Paid bills · ${pagination.total || list.length}`
              : `Total bills · ${pagination.total || list.length}`
          }
          action={{ onClick: () => navigate('/entries/new'), label: 'Add Bill' }}
        />
      )}

      {isPaidView && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="bill-summary-card bill-summary-card--blue">
            <p className="bill-summary-card__label">Paid Bills</p>
            <p className="bill-summary-card__value">{totals.count || 0}</p>
          </div>
          <div className="bill-summary-card bill-summary-card--emerald">
            <p className="bill-summary-card__label">Total Paid</p>
            <p className="bill-summary-card__value">{formatCurrency(totals.amountPaid || 0)}</p>
          </div>
          <div className="bill-summary-card bill-summary-card--violet">
            <p className="bill-summary-card__label">Gross Amount</p>
            <p className="bill-summary-card__value">{formatCurrency(totals.grossAmount || 0)}</p>
          </div>
        </div>
      )}

      <FilterPanel
        filters={filters}
        onChange={setFilters}
        onApply={handleApply}
        onClear={handleClear}
        compact
        hide={[
          'timeframe',
          'quarter',
          'coNames',
          ...(isPaidView ? ['paymentMethod'] : []),
        ]}
      />

      <div className="card overflow-hidden">
        {loading ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th className="text-center">Expense No</th>
                  <th className="text-center">Month</th>
                  <th className="text-center">Invoice Date</th>
                  <th className="text-center">Due Date</th>
                  <th className="text-center">Company</th>
                  <th className="text-center">Co Name</th>
                  <th className="text-center">Head</th>
                  <th className="text-right">Gross</th>
                  {isPaidView && <th className="text-center">Paid Date</th>}
                  {isPaidView && <th className="text-right">Amount Paid</th>}
                  {isPaidView && <th className="text-center">Days to Clear</th>}
                  <th className="text-center">Payment Status</th>
                  <th className="text-center">Approval Status</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="text-center"><Skeleton className="h-4 w-24 mx-auto" /></td>
                    <td className="text-center"><Skeleton className="h-4 w-16 mx-auto" /></td>
                    <td className="text-center"><Skeleton className="h-4 w-20 mx-auto" /></td>
                    <td className="text-center"><Skeleton className="h-4 w-20 mx-auto" /></td>
                    <td className="text-center"><Skeleton className="h-4 w-16 mx-auto" /></td>
                    <td className="text-center"><Skeleton className="h-4 w-20 mx-auto" /></td>
                    <td className="text-center"><Skeleton className="h-4 w-24 mx-auto" /></td>
                    <td className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                    {isPaidView && <td className="text-center"><Skeleton className="h-4 w-20 mx-auto" /></td>}
                    {isPaidView && <td className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>}
                    {isPaidView && <td className="text-center"><Skeleton className="h-4 w-16 mx-auto" /></td>}
                    <td className="text-center"><Skeleton className="h-5 w-20 mx-auto rounded-full" /></td>
                    <td className="text-center"><Skeleton className="h-5 w-20 mx-auto rounded-full" /></td>
                    <td className="text-center"><Skeleton className="h-4 w-16 mx-auto" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            title={isPaidView ? 'No paid bills yet' : 'No bills'}
            description={isPaidView ? 'Bills appear here once fully paid' : 'Create your first bill'}
            actionLabel={isPaidView ? undefined : 'Add Bill'}
            onAction={isPaidView ? undefined : () => navigate('/entries/new')}
          />
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th className="text-center">Expense No</th>
                  <th className="text-center">Month</th>
                  <th className="text-center">Invoice Date</th>
                  <th className="text-center">Due Date</th>
                  <th className="text-center">Company</th>
                  <th className="text-center">Co Name</th>
                  <th className="text-center">Head</th>
                  <th className="text-right">Gross</th>
                  {isPaidView && <th className="text-center">Paid Date</th>}
                  {isPaidView && <th className="text-right">Amount Paid</th>}
                  {isPaidView && <th className="text-center">Days to Clear</th>}
                  <th className="text-center">Payment Status</th>
                  <th className="text-center">Approval Status</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((e) => {
                  const editable = canEditExpense(e, user);
                  const deletable = canDeleteExpense(e, user);
                  return (
                    <tr key={e._id}>
                      <td className="text-center">
                        {e.isDraft ? (
                          <Link
                            to={`/entries/${e._id}/edit`}
                            className="expense-list-draft-link font-semibold text-slate-600 hover:underline"
                          >
                            Draft
                          </Link>
                        ) : e.slNo ? (
                          <Link
                            to={`/entries/${e._id}`}
                            className="table-serial-link font-semibold text-primary-700 hover:underline"
                          >
                            {formatMerSerial(e.slNo)}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="text-center">{e.month}</td>
                      <td className="text-center">{formatDate(e.invoiceDate)}</td>
                      <td className="text-center">{formatDate(e.dueDate)}</td>
                      <td className="text-center">
                        <span className="font-mono text-xs bg-primary-50 text-primary-700 border border-primary-200 px-2 py-0.5 rounded-md">
                          {companyCode(e.company)}
                        </span>
                      </td>
                      <td className="text-center">{e.coNames || '—'}</td>
                      <td className="text-center">{e.headOfExpense}</td>
                      <td className="text-right font-medium">{formatCurrency(e.grossAmount)}</td>
                      {isPaidView && <td className="text-center">{formatDate(e.paymentDate)}</td>}
                      {isPaidView && (
                        <td className="text-right text-emerald-700">{formatCurrency(e.amountPaid)}</td>
                      )}
                      {isPaidView && (
                        <td className="text-center font-medium text-indigo-700">
                          {formatDaysToClear(resolveDaysToClear(e))}
                        </td>
                      )}
                      <td className="text-center">
                        <span className={getPaymentStatusBadge(e.status)}>
                          {getPaymentStatusLabel(e.status)}
                        </span>
                      </td>
                      <td className="text-center">
                        <span className={getEntryApprovalBadge(e)}>
                          {getEntryApprovalLabel(e)}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => navigate(`/entries/${e._id}`)}
                            className="p-1.5 rounded text-primary-600 hover:bg-primary-50 transition-colors"
                            title="View"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          {editable && (
                            <button
                              type="button"
                              onClick={() => navigate(`/entries/${e._id}/edit`)}
                              className="p-1.5 rounded text-gray-600 hover:bg-gray-100 transition-colors"
                              title="Edit"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          )}
                          {deletable && (
                            <button
                              type="button"
                              onClick={() => setDeleteId(e._id)}
                              className="p-1.5 rounded text-red-500 hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                          {!e.isDraft && (
                            <WhatsAppShareButton onClick={() => openShare(e)} />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          page={pagination.page}
          pages={pagination.totalPages}
          total={pagination.total}
          pageSize={pagination.limit || PAGE_SIZE}
          loading={loading}
          onPageChange={(page) => load({ ...queryParams, page })}
        />
      </div>

      {shareModal}

      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onCancel={() => setDeleteId(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete entry"
        message="Delete this bill permanently?"
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

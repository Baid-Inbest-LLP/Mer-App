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
  formatMerSerial,
  getEntryApprovalBadge,
  getEntryApprovalLabel,
} from '../../utils/format';
import { canDeleteExpense, canEditExpense } from '../../utils/permissions';
import { omitPaymentFilters, cleanFilterParams, stripExpenseListHiddenFilters } from '../../utils/filters';

const PAGE_SIZE = 6;

export default function ExpenseListPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { list, pagination, loading, queryParams } = useSelector((state) => state.expense);
  const { user } = useSelector((state) => state.auth);
  const { lookups } = useSelector((state) => state.common);

  const companyCode = (name) => lookups?.companyCodeByName?.[name] || name || '—';
  const [filters, setFilters] = useState(queryParams);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = (params = queryParams) => {
    const cleaned = cleanFilterParams(
      omitPaymentFilters({ limit: PAGE_SIZE, includeDrafts: true, ...params }),
    );
    dispatch(setQueryParams(cleaned));
    dispatch(fetchExpenses(cleaned));
  };

  useEffect(() => {
    load();
  }, []);

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
      <PageBanner
        className="mb-4"
        title="Expense Entries"
        subtitle={`Total Entries · ${pagination.total || list.length}`}
        action={{ onClick: () => navigate('/entries/new'), label: 'Add Entry' }}
      />

      <FilterPanel
        filters={filters}
        onChange={setFilters}
        onApply={handleApply}
        onClear={handleClear}
        compact
        hide={['timeframe', 'quarter', 'coNames']}
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
                  <th className="text-center">Company</th>
                  <th className="text-center">Co Name</th>
                  <th className="text-center">Head</th>
                  <th className="text-right">Gross</th>
                  <th className="text-center">Approval</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="text-center"><Skeleton className="h-4 w-24 mx-auto" /></td>
                    <td className="text-center"><Skeleton className="h-4 w-16 mx-auto" /></td>
                    <td className="text-center"><Skeleton className="h-4 w-20 mx-auto" /></td>
                    <td className="text-center"><Skeleton className="h-4 w-16 mx-auto" /></td>
                    <td className="text-center"><Skeleton className="h-4 w-20 mx-auto" /></td>
                    <td className="text-center"><Skeleton className="h-4 w-24 mx-auto" /></td>
                    <td className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                    <td className="text-center"><Skeleton className="h-5 w-20 mx-auto rounded-full" /></td>
                    <td className="text-center"><Skeleton className="h-4 w-16 mx-auto" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            title="No entries"
            description="Create your first expense entry"
            actionLabel="Add entry"
            onAction={() => navigate('/entries/new')}
          />
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th className="text-center">Expense No</th>
                  <th className="text-center">Month</th>
                  <th className="text-center">Invoice Date</th>
                  <th className="text-center">Company</th>
                  <th className="text-center">Co Name</th>
                  <th className="text-center">Head</th>
                  <th className="text-right">Gross</th>
                  <th className="text-center">Approval</th>
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
                      <td className="text-center">
                        <span className="font-mono text-xs bg-primary-50 text-primary-700 border border-primary-200 px-2 py-0.5 rounded-md">
                          {companyCode(e.company)}
                        </span>
                      </td>
                      <td className="text-center">{e.coNames || '—'}</td>
                      <td className="text-center">{e.headOfExpense}</td>
                      <td className="text-right font-medium">{formatCurrency(e.grossAmount)}</td>
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

      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onCancel={() => setDeleteId(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete entry"
        message="Delete this expense entry permanently?"
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { expenseApi } from '../../api/expense.api';
import PageBanner from '../../components/common/PageBanner';
import EmptyState from '../../components/common/EmptyState';
import Pagination from '../../components/common/Pagination';
import Skeleton from '../../components/common/Skeleton';
import FilterPanel from '../../components/common/FilterPanel';
import {
  formatCurrency,
  formatDate,
  formatMerSerial,
  getPaymentStatusBadge,
  getPaymentStatusLabel,
} from '../../utils/format';
import { cleanFilterParams } from '../../utils/filters';
import { useSelector } from 'react-redux';
import WhatsAppShareButton from '../../components/expenses/WhatsAppShareButton';
import { useShareBill } from '../../components/expenses/ShareBillModal';

const PAGE_SIZE = 10;

const DEFAULT_FILTERS = { bucket: 'all' };

const BUCKETS = [
  { value: 'all', label: 'All open' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'due_today', label: 'Due today' },
  { value: 'due_7', label: 'Due in 7 days' },
  { value: 'due_month', label: 'Due this month' },
  { value: 'partial', label: 'Partially paid' },
  { value: 'hold', label: 'On hold' },
];

export default function DueExpensesPage({ embedded = false }) {
  const navigate = useNavigate();
  const { lookups } = useSelector((state) => state.common);
  const companyCode = (name) => lookups?.companyCodeByName?.[name] || name || '—';
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 0, total: 0, limit: PAGE_SIZE });
  const [summary, setSummary] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const { openShare, shareModal } = useShareBill();

  const load = async (nextPage = page, filterParams = appliedFilters) => {
    setLoading(true);
    try {
      const cleaned = cleanFilterParams(filterParams);
      const res = await expenseApi.due({
        page: nextPage,
        limit: PAGE_SIZE,
        bucket: cleaned.bucket || 'all',
        ...cleaned,
        sortBy: 'dueDate',
        sortOrder: 'asc',
      });
      setRows(res.data?.data || []);
      setPagination(res.data?.pagination || { page: 1, totalPages: 0, total: 0, limit: PAGE_SIZE });
      setSummary(res.data?.summary || null);
    } catch (err) {
      notifications.show({
        message: err?.response?.data?.message || 'Failed to load due bills',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1, DEFAULT_FILTERS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApply = () => {
    setAppliedFilters(filters);
    setPage(1);
    load(1, filters);
  };

  const handleClear = () => {
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setPage(1);
    load(1, DEFAULT_FILTERS);
  };

  const totals = summary?.totals || {};

  return (
    <div>
      {!embedded && (
        <PageBanner
          className="mb-4"
          title="Due Bills"
          subtitle="Track unpaid, partially paid, and held bills"
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="bill-summary-card bill-summary-card--blue">
          <p className="bill-summary-card__label">Unpaid Bills</p>
          <p className="bill-summary-card__value">{totals.count || 0}</p>
        </div>
        <div className="bill-summary-card bill-summary-card--amber">
          <p className="bill-summary-card__label">Balance due</p>
          <p className="bill-summary-card__value">{formatCurrency(totals.balanceDue || 0)}</p>
        </div>
        <div className="bill-summary-card bill-summary-card--emerald">
          <p className="bill-summary-card__label">Already paid</p>
          <p className="bill-summary-card__value">{formatCurrency(totals.amountPaid || 0)}</p>
        </div>
      </div>

      <FilterPanel
        filters={filters}
        onChange={setFilters}
        onApply={handleApply}
        onClear={handleClear}
        compact
        hide={['timeframe', 'quarter', 'coNames', 'approvalStatus', 'paymentMethod']}
        dueBucketOptions={BUCKETS}
      />

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No due bills"
            description="Open obligations appear here once bills are unpaid or partially paid"
            actionLabel="Add Bill"
            onAction={() => navigate('/entries/new')}
          />
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th className="text-center">Expense No</th>
                  <th className="text-center">Invoice Date</th>
                  <th className="text-center">Due Date</th>
                  <th className="text-center">Nature</th>
                  <th className="text-center">Company</th>
                  <th className="text-center">Head</th>
                  <th className="text-right">Gross</th>
                  <th className="text-right">Paid</th>
                  <th className="text-right">Balance</th>
                  <th className="text-center">Payment Status</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => {
                  const overdue = e.dueDate && new Date(e.dueDate) < new Date(new Date().setHours(0, 0, 0, 0));
                  return (
                    <tr key={e._id}>
                      <td className="text-center">
                        <Link
                          to={`/entries/${e._id}`}
                          state={{ from: '/due-expenses' }}
                          className="table-serial-link font-semibold text-primary-700 hover:underline"
                        >
                          {formatMerSerial(e.slNo) || '—'}
                        </Link>
                      </td>
                      <td className="text-center">{formatDate(e.invoiceDate)}</td>
                      <td className={`text-center ${overdue ? 'text-red-600 font-semibold' : ''}`}>
                        {formatDate(e.dueDate)}
                      </td>
                      <td className="text-center">{e.expenseNature || 'Variable'}</td>
                      <td className="text-center">
                        <span className="font-mono text-xs bg-primary-50 text-primary-700 border border-primary-200 px-2 py-0.5 rounded-md">
                          {companyCode(e.company)}
                        </span>
                      </td>
                      <td className="text-center">{e.headOfExpense}</td>
                      <td className="text-right">{formatCurrency(e.grossAmount)}</td>
                      <td className="text-right text-emerald-700">{formatCurrency(e.amountPaid)}</td>
                      <td className="text-right font-semibold text-amber-800">{formatCurrency(e.balanceDue)}</td>
                      <td className="text-center">
                        <span className={getPaymentStatusBadge(e.status)}>
                          {getPaymentStatusLabel(e.status)}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="inline-flex items-center justify-center gap-1">
                          <button
                            type="button"
                            className="btn-primary text-xs px-3 py-1.5 whitespace-nowrap"
                            onClick={() =>
                              navigate(`/entries/${e._id}#payments`, {
                                state: { from: '/due-expenses', openPayment: true },
                              })
                            }
                          >
                            Make Payment
                          </button>
                          <WhatsAppShareButton onClick={() => openShare(e)} />
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
          onPageChange={(p) => {
            setPage(p);
            load(p);
          }}
        />
      </div>

      {shareModal}
    </div>
  );
}

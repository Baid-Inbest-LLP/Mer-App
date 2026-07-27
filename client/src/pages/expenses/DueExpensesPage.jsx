import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { expenseApi } from '../../api/expense.api';
import { recurringApi } from '../../api/recurring.api';
import PageBanner from '../../components/common/PageBanner';
import EmptyState from '../../components/common/EmptyState';
import Pagination from '../../components/common/Pagination';
import Skeleton from '../../components/common/Skeleton';
import FilterSelect from '../../components/common/FilterSelect';
import {
  formatCurrency,
  formatDate,
  formatMerSerial,
  getPaymentStatusBadge,
  getPaymentStatusLabel,
} from '../../utils/format';
import { useSelector } from 'react-redux';

const PAGE_SIZE = 10;

const BUCKETS = [
  { value: 'all', label: 'All open' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'due_today', label: 'Due today' },
  { value: 'due_7', label: 'Due in 7 days' },
  { value: 'due_month', label: 'Due this month' },
  { value: 'partial', label: 'Partially paid' },
  { value: 'hold', label: 'On hold' },
];

export default function DueExpensesPage() {
  const navigate = useNavigate();
  const { lookups } = useSelector((state) => state.common);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 0, total: 0, limit: PAGE_SIZE });
  const [summary, setSummary] = useState(null);
  const [bucket, setBucket] = useState('all');
  const [expenseNature, setExpenseNature] = useState(null);
  const [company, setCompany] = useState(null);
  const [page, setPage] = useState(1);

  const load = async (nextPage = page) => {
    setLoading(true);
    try {
      const res = await expenseApi.due({
        page: nextPage,
        limit: PAGE_SIZE,
        bucket,
        expenseNature: expenseNature || undefined,
        company: company || undefined,
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
    load(1);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket, expenseNature, company]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await recurringApi.generateDue({});
      const created = res.data?.data?.created ?? 0;
      notifications.show({
        message: created ? `Generated ${created} recurring expense(s)` : 'No due templates to generate',
        color: 'green',
      });
      load(page);
    } catch (err) {
      notifications.show({
        message: err?.response?.data?.message || 'Failed to generate recurring expenses',
        color: 'red',
      });
    } finally {
      setGenerating(false);
    }
  };

  const totals = summary?.totals || {};

  return (
    <div>
      <PageBanner
        className="mb-4"
        title="Due Bills"
        subtitle="Track unpaid, partially paid, and held expenses"
        action={{ onClick: handleGenerate, label: generating ? 'Generating…' : 'Generate Due' }}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="card p-4">
          <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Open items</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totals.count || 0}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] uppercase tracking-wider text-amber-700 font-semibold">Balance due</p>
          <p className="text-2xl font-bold text-amber-800 mt-1">{formatCurrency(totals.balanceDue || 0)}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] uppercase tracking-wider text-emerald-700 font-semibold">Already paid</p>
          <p className="text-2xl font-bold text-emerald-800 mt-1">{formatCurrency(totals.amountPaid || 0)}</p>
        </div>
      </div>

      <div className="card p-3 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FilterSelect
            label="Bucket"
            data={BUCKETS}
            value={bucket}
            onChange={(v) => setBucket(v || 'all')}
          />
          <FilterSelect
            label="Nature"
            clearable
            placeholder="All natures"
            data={(lookups?.expenseNatures || ['Fixed', 'Variable']).map((n) => ({
              value: n,
              label: n,
            }))}
            value={expenseNature}
            onChange={setExpenseNature}
          />
          <FilterSelect
            label="Company"
            clearable
            searchable
            placeholder="All companies"
            data={(lookups?.companies || []).map((c) => ({ value: c, label: c }))}
            value={company}
            onChange={setCompany}
          />
        </div>
      </div>

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
            description="Open obligations will appear here once expenses are unpaid or partially paid"
            actionLabel="Add expense"
            onAction={() => navigate('/entries/new')}
          />
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th className="text-center">Expense No</th>
                  <th className="text-center">Due Date</th>
                  <th className="text-center">Nature</th>
                  <th className="text-center">Company</th>
                  <th className="text-center">Head</th>
                  <th className="text-right">Gross</th>
                  <th className="text-right">Paid</th>
                  <th className="text-right">Balance</th>
                  <th className="text-center">Status</th>
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
                      <td className={`text-center ${overdue ? 'text-red-600 font-semibold' : ''}`}>
                        {formatDate(e.dueDate)}
                      </td>
                      <td className="text-center">{e.expenseNature || 'Variable'}</td>
                      <td className="text-center">{e.company || '—'}</td>
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
    </div>
  );
}

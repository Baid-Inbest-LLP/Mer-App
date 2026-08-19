import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { notifications } from '@mantine/notifications';
import { purchaseOrderApi } from '../../api/purchaseOrder.api';
import { isSuperAdmin } from '../../constants/roles';
import PageBanner from '../../components/common/PageBanner';
import EmptyState from '../../components/common/EmptyState';
import Pagination from '../../components/common/Pagination';
import Skeleton from '../../components/common/Skeleton';
import ConfirmModal from '../../components/common/ConfirmModal';
import { formatCurrency, formatDate } from '../../utils/format';

const PAGE_SIZE = 10;

export default function ApprovedPurchaseOrdersPage() {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const canExclude = isSuperAdmin(user?.role);
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [addingId, setAddingId] = useState(null);
  const [excludeTarget, setExcludeTarget] = useState(null);
  const [excluding, setExcluding] = useState(false);
  const requestIdRef = useRef(0);

  const applyListResult = useCallback((data) => {
    setOrders(data.data || []);
    setPagination(data.pagination || { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 });
  }, []);

  const load = useCallback(async (page = 1, searchTerm = '') => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const { data } = await purchaseOrderApi.listCompleted({
        page,
        limit: PAGE_SIZE,
        search: searchTerm || undefined,
      });
      if (requestId !== requestIdRef.current) return;
      applyListResult(data);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      notifications.show({
        message: err.response?.data?.message || 'Failed to load approved purchase orders',
        color: 'red',
      });
      setOrders([]);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [applyListResult]);

  useEffect(() => {
    const requestId = ++requestIdRef.current;

    purchaseOrderApi
      .listCompleted({ page: 1, limit: PAGE_SIZE })
      .then(({ data }) => {
        if (requestId !== requestIdRef.current) return;
        applyListResult(data);
      })
      .catch((err) => {
        if (requestId !== requestIdRef.current) return;
        notifications.show({
          message: err.response?.data?.message || 'Failed to load approved purchase orders',
          color: 'red',
        });
        setOrders([]);
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoading(false);
      });

    return () => {
      requestIdRef.current += 1;
    };
  }, [applyListResult]);

  const handleAddAsExpense = async (poId) => {
    setAddingId(poId);
    try {
      await purchaseOrderApi.getExpenseDraft(poId);
      navigate(`/entries/new?fromPo=${poId}`);
    } catch (err) {
      notifications.show({
        message: err.response?.data?.message || 'Unable to add this PO as an expense',
        color: 'red',
      });
    } finally {
      setAddingId(null);
    }
  };

  const handleExclude = async () => {
    if (!excludeTarget) return;
    setExcluding(true);
    try {
      const { data } = await purchaseOrderApi.exclude(excludeTarget._id);
      notifications.show({
        message: data.message
          || `Excluded${data.data?.slNo ? ` — removed ${data.data.slNo}` : ''}`,
        color: 'green',
      });
      setExcludeTarget(null);
      load(pagination.page, search);
    } catch (err) {
      notifications.show({
        message: err.response?.data?.message || 'Failed to exclude purchase order',
        color: 'red',
      });
    } finally {
      setExcluding(false);
    }
  };

  return (
    <div>
      <PageBanner
        className="mb-4"
        title="Approved Purchase Orders"
        subtitle={`Final Approved Purchase Orders - ${pagination.total || orders.length}`}
      />

      <div className="card p-4 mb-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-48">
          <input
            className="input-field"
            placeholder="Search by PO number..."
            value={search}
            onChange={(e) => {
              const value = e.target.value;
              setSearch(value);
              load(1, value);
            }}
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th className="text-center">PO Number</th>
                  <th className="text-center">Date</th>
                  <th className="text-center">Company</th>
                  <th className="text-center">Vendor</th>
                  <th className="text-right">Amount</th>
                  <th className="text-center">Status</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="text-center"><Skeleton className="h-4 w-28 mx-auto" /></td>
                    <td className="text-center"><Skeleton className="h-4 w-20 mx-auto" /></td>
                    <td className="text-center"><Skeleton className="h-4 w-16 mx-auto" /></td>
                    <td className="text-center"><Skeleton className="h-4 w-24 mx-auto" /></td>
                    <td className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                    <td className="text-center"><Skeleton className="h-5 w-24 mx-auto rounded-full" /></td>
                    <td className="text-center"><Skeleton className="h-8 w-28 mx-auto" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            title="No final-approved purchase orders"
            description={
              search
                ? 'No approved POs match your search.'
                : 'Purchase orders final-approved by Superadmin will appear here.'
            }
          />
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th className="text-center">PO Number</th>
                  <th className="text-center">Date</th>
                  <th className="text-center">Company</th>
                  <th className="text-center">Vendor</th>
                  <th className="text-right">Amount</th>
                  <th className="text-center">Status</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((po) => (
                  <tr key={po._id}>
                    <td className="text-center">
                      <Link
                        to={`/purchase-orders/${po._id}`}
                        className="table-serial-link font-semibold text-primary-700 hover:underline"
                      >
                        {po.poNumber}
                      </Link>
                    </td>
                    <td className="text-center">{formatDate(po.orderDate)}</td>
                    <td className="text-center">
                      <span className="font-mono text-xs bg-primary-50 text-primary-700 border border-primary-200 px-2 py-0.5 rounded-md">
                        {po.companyCode || po.company || '—'}
                      </span>
                    </td>
                    <td className="text-center">{po.vendor || '—'}</td>
                    <td className="text-right font-medium">{formatCurrency(po.totalAmount)}</td>
                    <td className="text-center">
                      <span className="badge-completed">{po.statusLabel}</span>
                    </td>
                    <td className="text-center">
                      <div className="inline-flex items-center justify-center gap-2 flex-wrap">
                        {po.alreadyImported ? (
                          canExclude ? (
                            <button
                              type="button"
                              onClick={() => setExcludeTarget(po)}
                              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
                            >
                              Exclude Bill
                            </button>
                          ) : (
                            <span className="text-xs font-medium text-gray-500">Already added</span>
                          )
                        ) : (
                          <button
                            type="button"
                            disabled={addingId === po._id}
                            onClick={() => handleAddAsExpense(po._id)}
                            className="btn-primary text-xs px-3 py-1.5 disabled:opacity-60"
                          >
                            {addingId === po._id ? 'Opening…' : 'Add as Bill'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
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
          onPageChange={(page) => load(page, search)}
        />
      </div>

      <ConfirmModal
        open={!!excludeTarget}
        onClose={() => setExcludeTarget(null)}
        onCancel={() => setExcludeTarget(null)}
        onConfirm={handleExclude}
        loading={excluding}
        title="Exclude from MER"
        message={
          excludeTarget
            ? `Remove the MER expense linked to ${excludeTarget.poNumber}${
              excludeTarget.linkedExpenseSlNo ? ` (${excludeTarget.linkedExpenseSlNo})` : ''
            }? The PO will be available to add as an expense again.`
            : ''
        }
        confirmLabel="Exclude Bill"
        variant="danger"
      />
    </div>
  );
}

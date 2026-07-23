import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { purchaseOrderApi } from '../../api/purchaseOrder.api';
import ConfirmModal from '../../components/common/ConfirmModal';
import ActivityTimelineSidebar, {
  buildPurchaseOrderTimelineEvents,
} from '../../components/common/ActivityTimelineSidebar';
import Skeleton, { SkeletonText } from '../../components/common/Skeleton';
import { formatAmountInWords, formatCurrency, formatDate } from '../../utils/format';
import {
  calcAmount,
  calcDiscountAmt,
  calcGstAmt,
  calcLineTotal,
  summarizePoAmounts,
} from '../../utils/poAmounts';

const formatExactAmount = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

const formatRoundedAmount = (amount) =>
  formatCurrency(Math.round(Number(amount) || 0)).replace(/\.00$/, '');

const formatCurrencyDisplay = formatRoundedAmount;

const formatAddress = (address) => {
  if (!address) return [];
  const lines = [];
  if (address.street) lines.push(address.street);
  const cityLine = [address.city, address.state].filter(Boolean).join(', ');
  if (cityLine || address.zipCode) {
    lines.push([cityLine, address.zipCode].filter(Boolean).join(' '));
  }
  if (address.country) lines.push(address.country);
  return lines;
};

export default function PurchaseOrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [excludeOpen, setExcludeOpen] = useState(false);
  const [excluding, setExcluding] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await purchaseOrderApi.get(id);
      setOrder(data.data);
    } catch (err) {
      notifications.show({
        message: err.response?.data?.message || 'Purchase order not found',
        color: 'red',
      });
      navigate('/purchase-orders', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleAddAsExpense = async () => {
    setAdding(true);
    try {
      await purchaseOrderApi.getExpenseDraft(id);
      navigate(`/entries/new?fromPo=${id}`);
    } catch (err) {
      notifications.show({
        message: err.response?.data?.message || 'Unable to add this PO as an expense',
        color: 'red',
      });
    } finally {
      setAdding(false);
    }
  };

  const handleExclude = async () => {
    setExcluding(true);
    try {
      const { data } = await purchaseOrderApi.exclude(id);
      notifications.show({
        message: data.message || 'Purchase order excluded from MER expenses',
        color: 'green',
      });
      setExcludeOpen(false);
      load();
    } catch (err) {
      notifications.show({
        message: err.response?.data?.message || 'Failed to exclude purchase order',
        color: 'red',
      });
    } finally {
      setExcluding(false);
    }
  };

  if (loading || !order) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-8 w-56 mb-2" />
        <div className="card overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-slate-300 to-slate-200" />
          <div className="p-6 space-y-4">
            <Skeleton className="h-6 w-40" />
            <SkeletonText lines={3} />
          </div>
        </div>
      </div>
    );
  }

  const lineItems = order.lineItems || [];
  const vendorAddress = order.vendorAddress || {};
  const shippingAddress = order.shippingAddress || {};

  const summary = summarizePoAmounts(lineItems, order.shippingCost);
  const roundedSubtotal = summary.subtotal;
  const roundedGstTotal = summary.gstTotal;
  const roundedShipping = summary.shipping;
  const roundedItemsTotal = summary.itemsTotal;
  const roundedGrandTotal = summary.grandTotal;
  const timelineEvents = buildPurchaseOrderTimelineEvents(order);

  return (
    <div className="expense-view-page w-full max-w-[90rem] mx-auto space-y-6">
      <button
        type="button"
        onClick={() => navigate('/purchase-orders')}
        className="expense-view-back-btn group"
      >
        <svg className="w-4 h-4 transition-transform duration-150 group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Approved POs
      </button>

      <div className="expense-view-layout">
        <div className="min-w-0 space-y-6">
          <div className="card overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-blue-500 to-indigo-600" />
            <div className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="expense-view-title text-2xl font-bold tracking-tight">{order.poNumber}</h1>
                    <span className="badge-completed">{order.statusLabel || 'Approved'}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {order.alreadyImported ? (
                    <>
                      {order.linkedExpenseId && (
                        <Link
                          to={`/entries/${order.linkedExpenseId}`}
                          className="btn-secondary text-sm"
                        >
                          View Expense
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => setExcludeOpen(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
                      >
                        Exclude
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={adding}
                      onClick={handleAddAsExpense}
                      className="btn-primary text-sm disabled:opacity-60"
                    >
                      {adding ? 'Opening…' : 'Add as Expense'}
                    </button>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
                  <div>
                    <p className="text-[11px] text-gray-400 uppercase font-semibold tracking-wider">Order Date</p>
                    <p className="text-sm text-gray-900 font-semibold mt-0.5">{formatDate(order.orderDate) || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-400 uppercase font-semibold tracking-wider">Delivery Date</p>
                    <p className="text-sm text-gray-900 font-semibold mt-0.5">{formatDate(order.expectedDeliveryDate) || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-400 uppercase font-semibold tracking-wider">Items</p>
                    <p className="text-sm text-gray-900 font-semibold mt-0.5">
                      {lineItems.length} line item{lineItems.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-400 uppercase font-semibold tracking-wider">Total Amount</p>
                    <p className="text-lg text-gray-700 font-bold mt-0.5 tracking-tight">
                      {formatCurrencyDisplay(roundedGrandTotal)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-6">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-4">Vendor</h3>
              <p className="font-bold text-gray-900 text-base">{order.vendor?.name || '—'}</p>
              {order.vendor?.contactPerson && (
                <p className="text-sm text-gray-600 mt-1">Contact Person: {order.vendor.contactPerson}</p>
              )}
              {order.vendor?.phone && (
                <p className="text-sm text-gray-500 mt-2">{order.vendor.phone}</p>
              )}
              <div className="mt-2 text-sm text-gray-500 space-y-0.5">
                {vendorAddress.label && (
                  <p className="text-xs font-semibold text-gray-600">{String(vendorAddress.label).toUpperCase()}</p>
                )}
                {formatAddress(vendorAddress).map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>

            <div className="card p-6">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-4">Ship To</h3>
              <div className="flex items-center gap-2 flex-wrap">
                {order.company?.name && (
                  <p className="font-bold text-gray-900 text-base">{order.company.name}</p>
                )}
                {shippingAddress.label && (
                  <span className="inline-block text-xs font-semibold text-primary-700 bg-primary-50 border border-primary-200 px-2 py-0.5 rounded-md">
                    {String(shippingAddress.label).toUpperCase()}
                  </span>
                )}
              </div>
              {order.company?.phone && (
                <p className="text-sm text-gray-500 mt-2">{order.company.phone}</p>
              )}
              <div className="mt-2 text-sm text-gray-500 space-y-0.5">
                {formatAddress(shippingAddress).map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">Order Items</h3>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th className="text-center w-10">#</th>
                    <th className="text-left">Description</th>
                    <th className="text-right">Qty</th>
                    <th className="text-center">Unit</th>
                    <th className="text-right">Unit Price</th>
                    <th className="text-right">Disc %</th>
                    <th className="text-right">Disc Amt</th>
                    <th className="text-right">Amount</th>
                    <th className="text-right">GST %</th>
                    <th className="text-right">GST Amt</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, idx) => {
                    const discountAmt = calcDiscountAmt(item);
                    const amount = calcAmount(item);
                    const gstAmt = calcGstAmt(item);
                    const lineTotal = calcLineTotal(item);
                    return (
                      <tr key={item._id || idx}>
                        <td className="text-center text-gray-400 font-medium">{idx + 1}</td>
                        <td className="text-left font-medium text-gray-800">{item.description}</td>
                        <td className="text-right font-medium">{item.quantity}</td>
                        <td className="text-center text-gray-500">{item.unit}</td>
                        <td className="text-right">{formatExactAmount(item.unitPrice)}</td>
                        <td className="text-right text-gray-500">
                          {item.discount > 0 ? `${item.discount}%` : ''}
                        </td>
                        <td className="text-right text-red-700 font-medium">
                          {discountAmt > 0 ? formatExactAmount(discountAmt) : ''}
                        </td>
                        <td className="text-right font-semibold text-slate-700">
                          {formatExactAmount(amount)}
                        </td>
                        <td className="text-right text-gray-500">
                          {item.gstRate > 0 ? `${item.gstRate}%` : ''}
                        </td>
                        <td className="text-right text-emerald-700 font-medium">
                          {gstAmt > 0 ? formatExactAmount(gstAmt) : ''}
                        </td>
                        <td className="text-right font-bold text-gray-900">
                          {formatRoundedAmount(lineTotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-blue-50">
                    <td className="text-center text-gray-400 align-middle text-base py-2 px-4" />
                    <td className="text-left font-bold text-gray-800 align-middle text-2xl py-2 px-4">Totals</td>
                    <td className="text-right font-bold text-gray-800 align-middle text-base py-2 px-4">{summary.qty}</td>
                    <td className="text-center text-gray-400 align-middle text-base py-2 px-4" />
                    <td className="text-right text-gray-400 align-middle text-base py-2 px-4" />
                    <td className="text-right text-gray-400 align-middle text-base py-2 px-4" />
                    <td className="text-right font-bold text-red-700 align-middle text-base py-2 px-4">
                      {summary.discount > 0 ? formatRoundedAmount(summary.discountRounded) : ''}
                    </td>
                    <td className="text-right font-bold text-slate-700 align-middle text-base py-2 px-4">
                      {formatRoundedAmount(roundedSubtotal)}
                    </td>
                    <td className="text-right text-gray-400 align-middle text-base py-3 px-4" />
                    <td className="text-right font-bold text-emerald-700 align-middle text-base py-2 px-4">
                      {roundedGstTotal > 0 ? formatRoundedAmount(roundedGstTotal) : ''}
                    </td>
                    <td className="text-right font-bold text-primary-700 align-middle text-lg py-2 px-4">
                      {formatRoundedAmount(roundedItemsTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="border-t border-gray-100 p-6">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                <div className="flex-1 max-w-lg">
                  <div className="bg-gradient-to-br from-primary-50 to-blue-50 border border-primary-200 rounded-xl px-5 py-4">
                    <p className="text-[11px] text-primary-500 uppercase font-bold tracking-wider mb-2">Amount in Words</p>
                    <p className="text-base text-primary-900 font-bold leading-relaxed">
                      {formatAmountInWords(roundedGrandTotal)}
                    </p>
                  </div>
                </div>

                <div className="w-80 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 font-medium">Subtotal</span>
                    <span className="font-bold text-gray-800 text-base">
                      {formatRoundedAmount(roundedSubtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 font-medium">GST</span>
                    <span className="font-bold text-emerald-700 text-base">
                      {formatRoundedAmount(roundedGstTotal)}
                    </span>
                  </div>
                  {roundedShipping > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 font-medium">Shipping</span>
                      <span className="font-bold text-gray-800 text-base">
                        {formatRoundedAmount(roundedShipping)}
                      </span>
                    </div>
                  )}
                  <div className="border-t-2 border-gray-900 pt-3 flex justify-between items-baseline">
                    <span className="font-bold text-gray-900 text-lg">Grand Total</span>
                    <span className="text-2xl font-bold text-primary-700 tracking-tight">
                      {formatRoundedAmount(roundedGrandTotal)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {(order.notes || order.terms) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {order.notes ? (
                <div className="card p-6">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3">Notes</h3>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{order.notes}</p>
                </div>
              ) : null}
              {order.terms ? (
                <div className="card p-6">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3">Terms</h3>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{order.terms}</p>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <ActivityTimelineSidebar events={timelineEvents} />
      </div>

      <ConfirmModal
        open={excludeOpen}
        onClose={() => setExcludeOpen(false)}
        onCancel={() => setExcludeOpen(false)}
        onConfirm={handleExclude}
        loading={excluding}
        title="Exclude from MER"
        message={`Remove the MER expense linked to ${order.poNumber}${
          order.linkedExpenseSlNo ? ` (${order.linkedExpenseSlNo})` : ''
        }? The PO will be available to add as an expense again.`}
        confirmLabel="Exclude"
        variant="danger"
      />
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { NumberInput, Switch, Textarea, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useForm, Controller } from 'react-hook-form';
import { useSelector } from 'react-redux';
import { expenseApi } from '../../api/expense.api';
import FilterSelect from '../common/FilterSelect';
import FormDateInput from '../common/FormDateInput';
import ConfirmModal from '../common/ConfirmModal';
import {
  formatCurrency,
  formatDate,
  getPaymentStatusBadge,
  getPaymentStatusLabel,
} from '../../utils/format';
import {
  getCardNumberOptions,
  getFromAccountOptions,
  getPaymentMethodRules,
  PAYMENT_METHOD_OPTIONS,
} from '../../utils/paymentMethods';
import { isSuperAdmin } from '../../constants/roles';

const toSelectValue = (value) => (value == null || value === '' ? null : value);

export default function ExpensePaymentsPanel({ expense, canManage, onChanged, autoOpen = false }) {
  const { lookups } = useSelector((state) => state.common);
  const { user } = useSelector((state) => state.auth);
  const canDeletePayments = isSuperAdmin(user?.role);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [voidTarget, setVoidTarget] = useState(null);
  const [voiding, setVoiding] = useState(false);
  const [holdLoading, setHoldLoading] = useState(false);
  const [autoPayEnabled, setAutoPayEnabled] = useState(Boolean(expense.autoPay));
  const [autoPayCard, setAutoPayCard] = useState(
    expense.autoPayCardNumber || expense.cardNumber || null,
  );
  const [autoPaySaving, setAutoPaySaving] = useState(false);
  const [autoPaying, setAutoPaying] = useState(false);

  const balanceDue = Number(expense.balanceDue ?? expense.grossAmount ?? 0);
  const amountPaid = Number(expense.amountPaid ?? 0);
  const gross = Number(expense.grossAmount ?? 0);
  const progress = gross > 0 ? Math.min(100, Math.round((amountPaid / gross) * 100)) : 0;
  const payments = expense.payments || [];
  const isOpen = !['Paid', 'Cancelled'].includes(expense.status);
  const canRecordPayment = canManage && isOpen && balanceDue > 0 && expense.status !== 'Hold';
  const isFixedBill = expense.expenseNature === 'Fixed';
  const canConfigureAutoPay = canManage && isFixedBill && expense.status !== 'Cancelled';
  const canAutoPayNow = canConfigureAutoPay && isOpen && balanceDue > 0 && expense.status !== 'Hold';

  useEffect(() => {
    setAutoPayEnabled(Boolean(expense.autoPay));
    setAutoPayCard(expense.autoPayCardNumber || expense.cardNumber || null);
  }, [expense.autoPay, expense.autoPayCardNumber, expense.cardNumber, expense._id]);

  useEffect(() => {
    if (!autoOpen || !canRecordPayment) return;
    setOpen(true);
  }, [autoOpen, canRecordPayment]);

  const defaultValues = useMemo(
    () => ({
      amount: balanceDue > 0 ? balanceDue : 0,
      paymentDate: new Date(),
      paymentMethod: expense.paymentMethod || null,
      paymentRefNumber: '',
      bankAccountNumber: expense.bankAccountNumber || '',
      cardNumber: expense.cardNumber || '',
      notes: '',
    }),
    [balanceDue, expense.paymentMethod, expense.bankAccountNumber, expense.cardNumber],
  );

  const { control, register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm({
    defaultValues,
  });

  useEffect(() => {
    if (open) reset(defaultValues);
  }, [open, defaultValues, reset]);

  const paymentMethod = watch('paymentMethod');
  const paymentRules = getPaymentMethodRules(paymentMethod);
  const fromAccountOptions = getFromAccountOptions(
    watch('bankAccountNumber'),
    lookups?.bankAccounts,
  );
  const cardNumberOptions = getCardNumberOptions(
    autoPayCard || watch('cardNumber'),
    lookups?.cards,
  );

  const onSubmit = async (values) => {
    setSaving(true);
    try {
      const res = await expenseApi.addPayment(expense._id, {
        amount: values.amount,
        paymentDate: values.paymentDate instanceof Date
          ? values.paymentDate.toISOString()
          : values.paymentDate,
        paymentMethod: values.paymentMethod,
        paymentRefNumber: values.paymentRefNumber || undefined,
        bankAccountNumber: values.bankAccountNumber || undefined,
        cardNumber: values.cardNumber || undefined,
        notes: values.notes || undefined,
        merType: expense.merType,
      });
      const paidInFull = res.data?.data?.expense?.status === 'Paid';
      notifications.show({
        message: paidInFull
          ? 'Fully paid — marked Completed and moved to Expenses'
          : 'Payment recorded',
        color: 'green',
      });
      setOpen(false);
      onChanged?.();
    } catch (err) {
      notifications.show({
        message: err?.response?.data?.message || 'Failed to record payment',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleVoid = async () => {
    if (!voidTarget) return;
    setVoiding(true);
    try {
      await expenseApi.voidPayment(expense._id, voidTarget._id);
      notifications.show({ message: 'Payment deleted', color: 'green' });
      setVoidTarget(null);
      onChanged?.();
    } catch (err) {
      notifications.show({
        message: err?.response?.data?.message || 'Failed to void payment',
        color: 'red',
      });
    } finally {
      setVoiding(false);
    }
  };

  const toggleHold = async () => {
    setHoldLoading(true);
    try {
      const nextHold = expense.status !== 'Hold';
      await expenseApi.setHold(expense._id, nextHold);
      notifications.show({
        message: nextHold ? 'Expense put on hold' : 'Hold released',
        color: 'green',
      });
      onChanged?.();
    } catch (err) {
      notifications.show({
        message: err?.response?.data?.message || 'Failed to update hold status',
        color: 'red',
      });
    } finally {
      setHoldLoading(false);
    }
  };

  const handleAutoPayToggle = async (checked) => {
    if (checked && !autoPayCard) {
      notifications.show({
        message: 'Select a credit card before enabling auto-pay',
        color: 'orange',
      });
      return;
    }

    setAutoPaySaving(true);
    try {
      await expenseApi.setAutoPay(expense._id, {
        autoPay: checked,
        autoPayCardNumber: checked ? autoPayCard : undefined,
        syncTemplate: true,
      });
      setAutoPayEnabled(checked);
      notifications.show({
        message: checked
          ? 'Auto-pay enabled — full amount will be paid by credit card'
          : 'Auto-pay disabled',
        color: 'green',
      });
      onChanged?.();
    } catch (err) {
      notifications.show({
        message: err?.response?.data?.message || 'Failed to update auto-pay',
        color: 'red',
      });
    } finally {
      setAutoPaySaving(false);
    }
  };

  const handleAutoPayCardChange = async (value) => {
    const next = toSelectValue(value);
    setAutoPayCard(next);
    if (!autoPayEnabled || !next) return;

    setAutoPaySaving(true);
    try {
      await expenseApi.setAutoPay(expense._id, {
        autoPay: true,
        autoPayCardNumber: next,
        syncTemplate: true,
      });
      onChanged?.();
    } catch (err) {
      notifications.show({
        message: err?.response?.data?.message || 'Failed to update auto-pay card',
        color: 'red',
      });
    } finally {
      setAutoPaySaving(false);
    }
  };

  const handleAutoPayNow = async () => {
    if (!autoPayCard) {
      notifications.show({
        message: 'Select a credit card for auto-pay',
        color: 'orange',
      });
      return;
    }

    setAutoPaying(true);
    try {
      const res = await expenseApi.autoPay(expense._id, {
        cardNumber: autoPayCard,
        syncTemplate: true,
      });
      setAutoPayEnabled(true);
      notifications.show({
        message: res.data?.message
          || `Paid ${formatCurrency(balanceDue)} in full by credit card`,
        color: 'green',
      });
      onChanged?.();
    } catch (err) {
      notifications.show({
        message: err?.response?.data?.message || 'Auto-pay failed',
        color: 'red',
      });
    } finally {
      setAutoPaying(false);
    }
  };

  return (
    <div className="expense-payments-panel card overflow-hidden">
      <div className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="expense-payments-icon w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <div className="min-w-0 flex flex-wrap items-center gap-2">
              <h3 className="detail-card-title text-sm font-bold uppercase tracking-wide">
                Payments
              </h3>
              <span className={`${getPaymentStatusBadge(expense.status)} !text-xs`}>
                {getPaymentStatusLabel(expense.status)}
              </span>
              {isFixedBill && autoPayEnabled && (
                <span className="badge-partially-paid !text-xs">Auto-pay</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {canManage && isOpen && expense.status !== 'Hold' && (
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={toggleHold}
                disabled={holdLoading}
              >
                Hold
              </button>
            )}
            {canManage && expense.status === 'Hold' && (
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={toggleHold}
                disabled={holdLoading}
              >
                Release Hold
              </button>
            )}
            {canManage && isOpen && balanceDue > 0 && expense.status !== 'Hold' && (
              <button
                type="button"
                className="btn-primary text-sm"
                onClick={() => setOpen((v) => !v)}
              >
                {open ? 'Close' : 'Add Payment'}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="expense-payments-stat expense-payments-stat--gross rounded-xl border px-3 py-3">
            <p className="expense-payments-stat-label text-[10px] uppercase tracking-wider font-semibold">Gross</p>
            <p className="expense-payments-stat-value text-base font-bold mt-1 tabular-nums">{formatCurrency(gross)}</p>
          </div>
          <div className="expense-payments-stat expense-payments-stat--paid rounded-xl border px-3 py-3">
            <p className="expense-payments-stat-label text-[10px] uppercase tracking-wider font-semibold">Paid</p>
            <p className="expense-payments-stat-value text-base font-bold mt-1 tabular-nums">{formatCurrency(amountPaid)}</p>
          </div>
          <div className="expense-payments-stat expense-payments-stat--due rounded-xl border px-3 py-3">
            <p className="expense-payments-stat-label text-[10px] uppercase tracking-wider font-semibold">Due</p>
            <p className="expense-payments-stat-value text-base font-bold mt-1 tabular-nums">{formatCurrency(balanceDue)}</p>
          </div>
        </div>

        <div className="mb-5">
          <div className="expense-payments-progress-meta flex justify-between text-xs mb-1.5">
            <span className="font-medium">Cleared</span>
            <span className="expense-payments-progress-pct tabular-nums font-semibold">{progress}%</span>
          </div>
          <div className="expense-payments-progress-track h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                progress >= 100
                  ? 'expense-payments-progress-fill--done'
                  : progress > 0
                    ? 'expense-payments-progress-fill--partial'
                    : 'expense-payments-progress-fill--empty'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {canConfigureAutoPay && (
          <div className="expense-payments-form mb-5 rounded-xl border p-4 space-y-3 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="expense-payments-form-title text-sm font-semibold">Auto-pay by credit card</p>
                <p className="text-xs text-gray-500 mt-1">
                  Pay the full billed amount by card. Applies to this Fixed bill and future recurring periods.
                </p>
              </div>
              <Switch
                checked={autoPayEnabled}
                onChange={(e) => handleAutoPayToggle(e.currentTarget.checked)}
                disabled={autoPaySaving || autoPaying}
                label={autoPayEnabled ? 'On' : 'Off'}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FilterSelect
                label="Credit card"
                required={autoPayEnabled || canAutoPayNow}
                searchable
                data={cardNumberOptions}
                value={toSelectValue(autoPayCard)}
                onChange={handleAutoPayCardChange}
                disabled={autoPaySaving || autoPaying}
              />
              {canAutoPayNow && (
                <div className="flex items-end">
                  <button
                    type="button"
                    className="btn-primary text-sm w-full sm:w-auto"
                    onClick={handleAutoPayNow}
                    disabled={autoPaying || autoPaySaving || !autoPayCard}
                  >
                    {autoPaying
                      ? 'Paying…'
                      : `Pay full ${formatCurrency(balanceDue)} by card`}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {open && (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="expense-payments-form mb-5 rounded-xl border p-4 space-y-3 shadow-sm"
          >
            <p className="expense-payments-form-title text-sm font-semibold">Record payment</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Controller
                name="amount"
                control={control}
                rules={{
                  required: 'Amount is required',
                  validate: (v) => (Number(v) > 0 ? true : 'Amount must be greater than zero'),
                }}
                render={({ field, fieldState }) => (
                  <NumberInput
                    label="Amount"
                    required
                    min={0}
                    max={balanceDue}
                    decimalScale={2}
                    prefix="₹"
                    hideControls
                    value={field.value}
                    onChange={field.onChange}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                name="paymentDate"
                control={control}
                rules={{ required: 'Payment date is required' }}
                render={({ field, fieldState }) => (
                  <FormDateInput
                    label="Payment Date"
                    required
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                name="paymentMethod"
                control={control}
                rules={{ required: 'Payment method is required' }}
                render={({ field, fieldState }) => (
                  <FilterSelect
                    label="Method"
                    required
                    data={PAYMENT_METHOD_OPTIONS.map((v) => ({ value: v, label: v }))}
                    value={toSelectValue(field.value)}
                    onChange={(value) => {
                      const next = toSelectValue(value);
                      field.onChange(next);
                      const rules = getPaymentMethodRules(next);
                      if (!rules.requiresBankAccount) setValue('bankAccountNumber', '');
                      if (!rules.requiresCardNumber) setValue('cardNumber', '');
                    }}
                    error={fieldState.error?.message}
                  />
                )}
              />
              {paymentRules.requiresBankAccount ? (
                <Controller
                  name="bankAccountNumber"
                  control={control}
                  rules={{ required: paymentRules.bankAccountMessage || 'From account is required' }}
                  render={({ field, fieldState }) => (
                    <FilterSelect
                      label={paymentRules.bankAccountLabel || 'From Account'}
                      required
                      searchable
                      data={fromAccountOptions}
                      value={toSelectValue(field.value)}
                      onChange={(value) => field.onChange(toSelectValue(value) || '')}
                      error={fieldState.error?.message}
                    />
                  )}
                />
              ) : null}
              {paymentRules.requiresCardNumber ? (
                <Controller
                  name="cardNumber"
                  control={control}
                  rules={{ required: paymentRules.cardNumberMessage || 'Card number is required' }}
                  render={({ field, fieldState }) => (
                    <FilterSelect
                      label={paymentRules.cardNumberLabel || 'Card No'}
                      required
                      searchable
                      data={cardNumberOptions}
                      value={toSelectValue(field.value)}
                      onChange={(value) => field.onChange(toSelectValue(value) || '')}
                      error={fieldState.error?.message}
                    />
                  )}
                />
              ) : null}
              <TextInput
                label={paymentRules.paymentRefLabel || 'Reference'}
                required={paymentRules.requiresPaymentRef}
                {...register('paymentRefNumber', {
                  validate: (v) =>
                    !paymentRules.requiresPaymentRef || v?.trim()
                      ? true
                      : paymentRules.paymentRefMessage || 'Payment reference is required',
                })}
                error={errors.paymentRefNumber?.message}
              />
            </div>
            <Textarea label="Notes" minRows={2} {...register('notes')} />
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-secondary text-sm" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary text-sm" disabled={saving}>
                {saving ? 'Saving…' : 'Save Payment'}
              </button>
            </div>
          </form>
        )}

        {payments.length === 0 ? (
          <div className="expense-payments-empty rounded-xl border border-dashed px-4 py-6 text-center">
            <p className="expense-payments-empty-text text-sm">No payments recorded yet</p>
            {canManage && isOpen && balanceDue > 0 && expense.status !== 'Hold' && !open && (
              <button
                type="button"
                className="expense-payments-empty-action mt-2 text-sm font-semibold hover:underline"
                onClick={() => setOpen(true)}
              >
                Add first payment
              </button>
            )}
          </div>
        ) : (
          <ul className="expense-payments-list divide-y rounded-xl border overflow-hidden">
            {payments.map((p) => {
              const voided = p.status === 'Voided';
              return (
                <li
                  key={p._id}
                  className={`expense-payments-item flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${
                    voided ? 'expense-payments-item--voided' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="expense-payments-item-amount text-sm font-semibold tabular-nums">
                        {formatCurrency(p.amount)}
                      </p>
                      <span className={voided ? 'badge-cancelled' : 'badge-paid'}>
                        {p.status}
                      </span>
                    </div>
                    <p className="expense-payments-item-meta text-xs mt-1">
                      {formatDate(p.paymentDate)}
                      {p.paymentMethod ? ` · ${p.paymentMethod}` : ''}
                      {p.paymentRefNumber ? ` · ${p.paymentRefNumber}` : ''}
                    </p>
                  </div>
                  {canDeletePayments && !voided ? (
                    <button
                      type="button"
                      className="expense-payments-void-btn inline-flex items-center justify-center p-1.5 rounded"
                      onClick={() => setVoidTarget(p)}
                      title="Delete payment"
                      aria-label="Delete payment"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ConfirmModal
        open={!!voidTarget}
        onClose={() => setVoidTarget(null)}
        onCancel={() => setVoidTarget(null)}
        onConfirm={handleVoid}
        loading={voiding}
        title="Delete payment"
        message="Delete this payment? The expense balance will be recalculated."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

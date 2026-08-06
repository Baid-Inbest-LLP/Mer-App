import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { NumberInput, Switch, TextInput, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useSelector } from 'react-redux';
import { recurringApi } from '../../api/recurring.api';
import FilterSelect from '../../components/common/FilterSelect';
import FormDateInput from '../../components/common/FormDateInput';
import ConfirmModal from '../../components/common/ConfirmModal';
import EmptyState from '../../components/common/EmptyState';
import Skeleton from '../../components/common/Skeleton';
import { formatCurrency, formatDate } from '../../utils/format';
import { MER_ENTRY_TYPE_OPTIONS, PAYMENT_METHOD_OPTIONS } from '../../utils/paymentMethods';
import { buildCompanySelectOptionsFromRecords } from '../../utils/companySelect';

const toSelectValue = (value) => (value == null || value === '' ? null : value);

const emptyForm = {
  name: '',
  company: null,
  location: null,
  coNames: '',
  headOfExpense: null,
  particulars: '',
  expenseType: 'Revenue',
  expenseNature: 'Fixed',
  amountType: 'Fixed',
  netAmount: 0,
  gstPercent: 0,
  useIGST: false,
  tds: 0,
  merType: 'Bank',
  paymentMethod: null,
  frequency: 'Monthly',
  dueDayOfMonth: 1,
  startDate: new Date(),
  endDate: null,
  notes: '',
  isActive: true,
};

export default function RecurringSchedulesSection() {
  const { lookups } = useSelector((state) => state.common);
  const { companies } = useSelector((state) => state.companies);
  const companyCode = (name) => lookups?.companyCodeByName?.[name] || name || '—';
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  const { control, register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm({
    defaultValues: emptyForm,
  });

  const selectedCompany = watch('company');
  const companyOptions = buildCompanySelectOptionsFromRecords(companies || []);
  const locationOptions = (lookups?.companyLocations?.[selectedCompany] || []).map((l) => ({
    value: l,
    label: l,
  }));

  const load = async () => {
    setLoading(true);
    try {
      // Active schedules that still repeat (exclude one-time / ended).
      const res = await recurringApi.list({ activeOnly: 'true' });
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const repeating = (res.data?.data || []).filter((row) => {
        if (!row.isActive) return false;
        if (!row.frequency || row.frequency === 'One-time') return false;
        if (row.endDate) {
          const end = new Date(row.endDate);
          end.setHours(23, 59, 59, 999);
          if (end < today) return false;
          if (row.nextDueDate && new Date(row.nextDueDate) > end) return false;
        }
        return true;
      });
      setRows(repeating);
    } catch (err) {
      notifications.show({
        message: err?.response?.data?.message || 'Failed to load schedules',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const activeCount = rows.length;
  const dueSoonCount = rows.filter((r) => {
    if (!r.nextDueDate) return false;
    const due = new Date(r.nextDueDate);
    const in7 = new Date();
    in7.setHours(23, 59, 59, 999);
    in7.setDate(in7.getDate() + 7);
    return due <= in7;
  }).length;
  const activeNet = rows.reduce((sum, r) => sum + (Number(r.netAmount) || 0), 0);

  const openEdit = (row) => {
    setEditing(row);
    reset({
      ...emptyForm,
      ...row,
      startDate: row.startDate ? new Date(row.startDate) : new Date(),
      endDate: row.endDate ? new Date(row.endDate) : null,
    });
    setOpen(true);
  };

  const onSubmit = async (values) => {
    if (!editing) return;
    setSaving(true);
    try {
      const payload = {
        ...values,
        startDate: values.startDate instanceof Date ? values.startDate.toISOString() : values.startDate,
        endDate: values.endDate instanceof Date ? values.endDate.toISOString() : values.endDate || undefined,
      };
      await recurringApi.update(editing._id, payload);
      notifications.show({ message: 'Schedule updated', color: 'green' });
      setOpen(false);
      load();
    } catch (err) {
      notifications.show({
        message: err?.response?.data?.message || 'Failed to save schedule',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await recurringApi.remove(deleteId);
      notifications.show({ message: 'Schedule deleted', color: 'green' });
      setDeleteId(null);
      load();
    } catch (err) {
      notifications.show({
        message: err?.response?.data?.message || 'Failed to delete schedule',
        color: 'red',
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = async (row) => {
    setTogglingId(row._id);
    try {
      await recurringApi.update(row._id, { isActive: !row.isActive });
      notifications.show({
        message: row.isActive ? 'Schedule paused' : 'Schedule resumed',
        color: 'green',
      });
      load();
    } catch (err) {
      notifications.show({
        message: err?.response?.data?.message || 'Failed to update schedule',
        color: 'red',
      });
    } finally {
      setTogglingId(null);
    }
  };

  const handleGenerateOne = async (id) => {
    try {
      const res = await recurringApi.generate(id);
      const skipped = res.data?.data?.skipped;
      notifications.show({
        message: skipped
          ? `Skipped: ${res.data?.data?.reason || 'not due'}`
          : 'Bill generated from schedule',
        color: skipped ? 'yellow' : 'green',
      });
      load();
    } catch (err) {
      notifications.show({
        message: err?.response?.data?.message || 'Generate failed',
        color: 'red',
      });
    }
  };

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="bill-summary-card bill-summary-card--blue">
          <p className="bill-summary-card__label">Repeating Bills</p>
          <p className="bill-summary-card__value">{activeCount}</p>
        </div>
        <div className="bill-summary-card bill-summary-card--amber">
          <p className="bill-summary-card__label">Due in 7 days</p>
          <p className="bill-summary-card__value">{dueSoonCount}</p>
        </div>
        <div className="bill-summary-card bill-summary-card--emerald">
          <p className="bill-summary-card__label">Active Net Amount</p>
          <p className="bill-summary-card__value">{formatCurrency(activeNet)}</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No repeating bills"
            description="Create a Fixed bill with Add Bill — it will appear here and generate on schedule"
          />
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th className="text-left">Name</th>
                  <th className="text-center">Company</th>
                  <th className="text-center">Nature</th>
                  <th className="text-center">Amount</th>
                  <th className="text-center">Frequency</th>
                  <th className="text-center">Next due</th>
                  <th className="text-right">Net</th>
                  <th className="text-center">Status</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row._id}>
                    <td className="text-left font-medium">{row.name}</td>
                    <td className="text-center">
                      <span className="font-mono text-xs bg-primary-50 text-primary-700 border border-primary-200 px-2 py-0.5 rounded-md">
                        {companyCode(row.company)}
                      </span>
                    </td>
                    <td className="text-center">{row.expenseNature}</td>
                    <td className="text-center">{row.amountType === 'Usage' ? 'Usage-based' : 'Fixed'}</td>
                    <td className="text-center">{row.frequency}</td>
                    <td className="text-center">{formatDate(row.nextDueDate)}</td>
                    <td className="text-right">{formatCurrency(row.netAmount)}</td>
                    <td className="text-center">
                      <span className={row.isActive ? 'badge-paid' : 'badge-cancelled'}>
                        {row.isActive ? 'Active' : 'Paused'}
                      </span>
                    </td>
                    <td className="text-center">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          className="p-1.5 rounded text-primary-600 hover:bg-primary-50 transition-colors"
                          title="Generate"
                          onClick={() => handleGenerateOne(row._id)}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="p-1.5 rounded text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-50"
                          title={row.isActive ? 'Pause' : 'Resume'}
                          disabled={togglingId === row._id}
                          onClick={() => handleToggleActive(row)}
                        >
                          {row.isActive ? (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </button>
                        <button
                          type="button"
                          className="p-1.5 rounded text-gray-600 hover:bg-gray-100 transition-colors"
                          title="Edit"
                          onClick={() => openEdit(row)}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="p-1.5 rounded text-red-500 hover:bg-red-50 transition-colors"
                          title="Delete"
                          onClick={() => setDeleteId(row._id)}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {open && editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 bg-black/40 backdrop-blur-sm overflow-y-auto">
          <div className="card w-full max-w-3xl p-6">
            <h3 className="text-lg font-bold mb-4">Edit schedule</h3>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TextInput label="Name" required {...register('name', { required: 'Name is required' })} error={errors.name?.message} />
                <Controller
                  name="company"
                  control={control}
                  rules={{ required: 'Company is required' }}
                  render={({ field, fieldState }) => (
                    <FilterSelect
                      label="Company"
                      required
                      data={companyOptions}
                      value={toSelectValue(field.value)}
                      onChange={(v) => {
                        field.onChange(toSelectValue(v));
                        setValue('location', null);
                      }}
                      error={fieldState.error?.message}
                    />
                  )}
                />
                <Controller
                  name="location"
                  control={control}
                  render={({ field }) => (
                    <FilterSelect
                      label="Location"
                      clearable
                      data={locationOptions}
                      value={toSelectValue(field.value)}
                      onChange={(v) => field.onChange(toSelectValue(v))}
                    />
                  )}
                />
                <TextInput label="Co Name" required {...register('coNames', { required: 'Co name is required' })} error={errors.coNames?.message} />
                <Controller
                  name="headOfExpense"
                  control={control}
                  rules={{ required: 'Head is required' }}
                  render={({ field, fieldState }) => (
                    <FilterSelect
                      label="Head of Expense"
                      required
                      data={(lookups?.expenseHeads || []).map((h) => ({ value: h, label: h }))}
                      value={toSelectValue(field.value)}
                      onChange={(v) => field.onChange(toSelectValue(v))}
                      error={fieldState.error?.message}
                    />
                  )}
                />
                <Controller
                  name="expenseType"
                  control={control}
                  render={({ field }) => (
                    <FilterSelect
                      label="Expense Type"
                      data={['Capital', 'Revenue'].map((v) => ({ value: v, label: v }))}
                      value={toSelectValue(field.value)}
                      onChange={(v) => field.onChange(toSelectValue(v))}
                    />
                  )}
                />
                <Controller
                  name="expenseNature"
                  control={control}
                  render={({ field }) => (
                    <FilterSelect
                      label="Nature"
                      data={['Fixed', 'Variable'].map((v) => ({ value: v, label: v }))}
                      value={toSelectValue(field.value)}
                      onChange={(v) => field.onChange(toSelectValue(v))}
                    />
                  )}
                />
                <Controller
                  name="amountType"
                  control={control}
                  render={({ field }) => (
                    <FilterSelect
                      label="Amount Type"
                      data={[
                        { value: 'Fixed', label: 'Fixed amount' },
                        { value: 'Usage', label: 'Usage-based' },
                      ]}
                      value={toSelectValue(field.value || 'Fixed')}
                      onChange={(v) => field.onChange(toSelectValue(v) || 'Fixed')}
                    />
                  )}
                />
                <Controller
                  name="frequency"
                  control={control}
                  render={({ field }) => (
                    <FilterSelect
                      label="Frequency"
                      data={['One-time', 'Daily', 'Weekly', 'Monthly', 'Quarterly', 'Half-yearly', 'Yearly'].map((v) => ({ value: v, label: v }))}
                      value={toSelectValue(field.value)}
                      onChange={(v) => field.onChange(toSelectValue(v))}
                    />
                  )}
                />
                <Controller
                  name="dueDayOfMonth"
                  control={control}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <NumberInput label="Due day of month" min={1} max={28} hideControls value={field.value} onChange={field.onChange} />
                  )}
                />
                <Controller
                  name="netAmount"
                  control={control}
                  render={({ field }) => (
                    <NumberInput
                      label={watch('amountType') === 'Usage' ? 'Estimated Amount' : 'Net Amount'}
                      min={0}
                      prefix="₹"
                      hideControls
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
                <Controller
                  name="gstPercent"
                  control={control}
                  render={({ field }) => (
                    <NumberInput label="GST %" min={0} max={100} hideControls value={field.value} onChange={field.onChange} />
                  )}
                />
                <Controller
                  name="merType"
                  control={control}
                  render={({ field }) => (
                    <FilterSelect
                      label="Payment Type"
                      data={MER_ENTRY_TYPE_OPTIONS}
                      value={toSelectValue(field.value)}
                      onChange={(v) => field.onChange(toSelectValue(v))}
                    />
                  )}
                />
                <Controller
                  name="paymentMethod"
                  control={control}
                  render={({ field }) => (
                    <FilterSelect
                      label="Default payment method"
                      clearable
                      data={PAYMENT_METHOD_OPTIONS.map((v) => ({ value: v, label: v }))}
                      value={toSelectValue(field.value)}
                      onChange={(v) => field.onChange(toSelectValue(v))}
                    />
                  )}
                />
                <Controller
                  name="startDate"
                  control={control}
                  render={({ field }) => (
                    <FormDateInput label="Start Date" value={field.value} onChange={field.onChange} />
                  )}
                />
                <Controller
                  name="endDate"
                  control={control}
                  render={({ field }) => (
                    <FormDateInput label="End Date" clearable value={field.value} onChange={field.onChange} />
                  )}
                />
              </div>
              <TextInput label="Particulars" {...register('particulars')} />
              <Textarea label="Notes" minRows={2} {...register('notes')} />
              <Controller
                name="isActive"
                control={control}
                render={({ field }) => (
                  <Switch label="Active" checked={Boolean(field.value)} onChange={(e) => field.onChange(e.currentTarget.checked)} />
                )}
              />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-secondary text-sm" onClick={() => setOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary text-sm" disabled={saving}>
                  {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onCancel={() => setDeleteId(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete schedule"
        message="Delete this recurring schedule permanently? Bills already generated are kept."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

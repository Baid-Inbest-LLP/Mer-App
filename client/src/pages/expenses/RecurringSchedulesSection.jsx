import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, Controller, useFormState } from 'react-hook-form';
import {
  Checkbox,
  Group,
  NumberInput,
  Paper,
  Radio,
  SimpleGrid,
  Switch,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useDispatch, useSelector } from 'react-redux';
import { recurringApi } from '../../api/recurring.api';
import { fetchCompanies } from '../../store/slices/companiesSlice';
import FilterSelect from '../../components/common/FilterSelect';
import FormDateInput from '../../components/common/FormDateInput';
import ConfirmModal from '../../components/common/ConfirmModal';
import EmptyState from '../../components/common/EmptyState';
import Skeleton from '../../components/common/Skeleton';
import { formatCurrency, formatDate, formatNumber } from '../../utils/format';
import { calculateGST, calculateGross } from '../../utils/gst';
import { normalizeBranchLabel } from '../../utils/locationFormat';
import {
  MER_ENTRY_TYPE_OPTIONS,
  MER_ENTRY_TYPES,
  PAYMENT_METHOD_OPTIONS,
  getCardNumberOptions,
} from '../../utils/paymentMethods';
import { buildCompanySelectOptionsFromRecords } from '../../utils/companySelect';

const TEXT_INPUT_CLASS_NAMES = {
  input: 'cursor-text',
  error: 'text-red-500 text-xs mt-1',
};
const RADIO_GROUP_CLASS_NAMES = {
  label: 'expense-form-radio-group-label text-sm font-medium',
  error: 'text-red-500 text-xs mt-1',
};
const RADIO_CLASS_NAMES = {
  radio: 'cursor-pointer',
  label: 'expense-form-radio-label cursor-pointer text-sm',
};

const FIXED_FREQUENCY_OPTIONS = ['Monthly', 'Quarterly', 'Half-yearly', 'Yearly'];

const FREQUENCY_FILTERS = [
  { value: 'all', label: 'All' },
  ...FIXED_FREQUENCY_OPTIONS.map((value) => ({ value, label: value })),
];

const toSelectValue = (value) => (value === '' || value == null ? null : value);

const getLocationsForCompany = (company) => {
  if (!company?.locations?.length) return [];

  return company.locations
    .filter((location) => location.label)
    .map((location) => {
      const label = normalizeBranchLabel(location.label);
      return { value: label, label, isDefault: Boolean(location.isDefault) };
    });
};

const getDefaultLocationValue = (company) => {
  const locations = getLocationsForCompany(company);
  if (!locations.length) return null;
  return (locations.find((location) => location.isDefault) || locations[0]).value;
};

const emptyForm = {
  name: '',
  company: null,
  location: null,
  coNames: '',
  headOfExpense: null,
  particulars: '',
  expenseType: 'Revenue',
  amountType: 'Fixed',
  netAmount: '',
  gstPercent: '',
  useIGST: false,
  tds: '',
  merType: 'Bank',
  paymentMethod: null,
  autoPay: false,
  autoPayCardNumber: '',
  frequency: 'Monthly',
  dueDayOfMonth: 1,
  startDate: new Date(),
  endDate: null,
  notes: '',
  isActive: true,
};

const mapTemplateToFormValues = (row) => ({
  name: row.name || '',
  company: row.company || null,
  location: row.location || null,
  coNames: row.coNames || '',
  headOfExpense: row.headOfExpense || null,
  particulars: row.particulars || '',
  expenseType: row.expenseType || 'Revenue',
  amountType: row.amountType || 'Fixed',
  netAmount: Number(row.netAmount) || 0,
  gstPercent: Number(row.gstPercent) || 0,
  useIGST: Boolean(row.useIGST),
  tds: Number(row.tds) || 0,
  merType: row.merType || null,
  paymentMethod: row.paymentMethod || null,
  autoPay: Boolean(row.autoPay),
  autoPayCardNumber: row.autoPayCardNumber || '',
  frequency: FIXED_FREQUENCY_OPTIONS.includes(row.frequency) ? row.frequency : 'Monthly',
  dueDayOfMonth: Number(row.dueDayOfMonth) || 1,
  startDate: row.startDate ? new Date(row.startDate) : new Date(),
  endDate: row.endDate ? new Date(row.endDate) : null,
  notes: row.notes || '',
  isActive: row.isActive !== false,
});

const buildUpdatePayload = (values) => {
  const autoPay = Boolean(values.autoPay);
  const amountType = values.amountType || 'Fixed';
  const netAmount = Number(values.netAmount) || 0;

  return {
    name: values.name?.trim(),
    company: values.company,
    location: values.location || undefined,
    coNames: values.coNames?.trim(),
    headOfExpense: values.headOfExpense,
    particulars: values.particulars || '',
    expenseType: values.expenseType,
    expenseNature: 'Fixed',
    amountType,
    netAmount: amountType === 'Usage' ? Math.max(0, netAmount) : netAmount,
    gstPercent: Number(values.gstPercent) || 0,
    useIGST: Boolean(values.useIGST),
    tds: Number(values.tds) || 0,
    merType: values.merType,
    paymentMethod: autoPay ? 'Card' : (values.paymentMethod || undefined),
    autoPay,
    autoPayCardNumber: autoPay ? (values.autoPayCardNumber || '') : '',
    frequency: values.frequency || 'Monthly',
    dueDayOfMonth: Number(values.dueDayOfMonth) || 1,
    startDate: values.startDate instanceof Date
      ? values.startDate.toISOString()
      : values.startDate,
    endDate: values.endDate instanceof Date
      ? values.endDate.toISOString()
      : values.endDate || undefined,
    notes: values.notes || '',
    isActive: Boolean(values.isActive),
  };
};

const selectData = (items) => (items || []).map((item) => ({ value: item, label: item }));

export default function RecurringSchedulesSection() {
  const dispatch = useDispatch();
  const { lookups } = useSelector((state) => state.common);
  const { companies, loading: companiesLoading } = useSelector((state) => state.companies);
  const companyCode = (name) => lookups?.companyCodeByName?.[name] || name || '—';
  const prevCompanyOptionsLen = useRef(0);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [frequencyFilter, setFrequencyFilter] = useState('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
  } = useForm({
    defaultValues: emptyForm,
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const { errors, isSubmitted, touchedFields } = useFormState({ control });

  const shouldShowErrors = showValidationErrors || isSubmitted;

  const showControllerError = (name, fieldState) => {
    if (!shouldShowErrors && !fieldState.isTouched) return undefined;
    return errors[name]?.message || fieldState.error?.message;
  };

  const showRegisterError = (name) => {
    if (!shouldShowErrors && !touchedFields[name]) return undefined;
    return errors[name]?.message;
  };

  const selectedCompany = watch('company');
  const amountType = watch('amountType');
  const netAmount = watch('netAmount');
  const gstPercent = watch('gstPercent');
  const useIGST = watch('useIGST');
  const tds = watch('tds');
  const autoPay = watch('autoPay');
  const isUsageAmount = amountType === 'Usage';

  const activeCompanies = useMemo(
    () => (companies || []).filter((company) => company.isActive !== false),
    [companies],
  );

  const companyOptions = useMemo(() => {
    const base = buildCompanySelectOptionsFromRecords(activeCompanies);
    const current = editing?.company;
    if (current && !base.some((opt) => opt.value === current)) {
      return [{ value: current, label: companyCode(current) }, ...base];
    }
    return base;
  }, [activeCompanies, editing?.company, lookups?.companyCodeByName]);

  const locationOptions = useMemo(() => {
    if (!selectedCompany) return [];
    const company = activeCompanies.find((item) => item.name === selectedCompany);
    const base = getLocationsForCompany(company);
    const current = editing?.company === selectedCompany ? editing?.location : null;
    if (current && !base.some((opt) => opt.value === current)) {
      return [{ value: current, label: current }, ...base];
    }
    return base;
  }, [activeCompanies, selectedCompany, editing?.company, editing?.location]);

  const merTypeOptions = useMemo(() => {
    const current = editing?.merType;
    if (current && !MER_ENTRY_TYPES.includes(current)) {
      return [{ value: current, label: current }, ...MER_ENTRY_TYPE_OPTIONS];
    }
    return MER_ENTRY_TYPE_OPTIONS;
  }, [editing?.merType]);

  const cardNumberOptions = useMemo(
    () => getCardNumberOptions(editing?.autoPayCardNumber, lookups?.cards),
    [editing?.autoPayCardNumber, lookups?.cards],
  );

  const gstSummary = useMemo(() => {
    const gst = calculateGST(netAmount, gstPercent, useIGST);
    const gross = calculateGross(Number(netAmount) || 0, gst.totalGST, Number(tds) || 0);
    return { ...gst, gross };
  }, [netAmount, gstPercent, useIGST, tds]);

  const load = async () => {
    setLoading(true);
    try {
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

  useEffect(() => {
    dispatch(fetchCompanies({ isActive: true, limit: 100 }));
  }, [dispatch]);

  // Select needs matching options — re-bind when companies finish loading after open.
  useEffect(() => {
    if (!open || !editing) {
      prevCompanyOptionsLen.current = 0;
      return;
    }
    const optionCount = companyOptions.length;
    if (optionCount > 0 && prevCompanyOptionsLen.current === 0) {
      reset(mapTemplateToFormValues(editing));
    }
    prevCompanyOptionsLen.current = optionCount;
  }, [open, editing, companyOptions.length, reset]);

  const filteredRows = frequencyFilter === 'all'
    ? rows
    : rows.filter((r) => r.frequency === frequencyFilter);

  const activeCount = filteredRows.length;
  const dueSoonCount = filteredRows.filter((r) => {
    if (!r.nextDueDate) return false;
    const due = new Date(r.nextDueDate);
    const in7 = new Date();
    in7.setHours(23, 59, 59, 999);
    in7.setDate(in7.getDate() + 7);
    return due <= in7;
  }).length;
  const activeNet = filteredRows.reduce((sum, r) => sum + (Number(r.netAmount) || 0), 0);

  const openEdit = (row) => {
    setEditing(row);
    setShowValidationErrors(false);
    reset(mapTemplateToFormValues(row));
    setOpen(true);
  };

  const closeEdit = () => {
    setOpen(false);
    setEditing(null);
    setShowValidationErrors(false);
    reset(emptyForm);
  };

  const requirePositiveAmount = (value) => {
    if (getValues('amountType') === 'Usage') {
      const amount = Number(value);
      if (value === '' || value == null || Number.isNaN(amount) || amount < 0) {
        return 'Amount cannot be negative';
      }
      return true;
    }
    const amount = Number(value);
    if (value === '' || value == null || Number.isNaN(amount) || amount <= 0) {
      return 'Net amount is required';
    }
    return true;
  };

  const requireRecurringDueDay = (value) => {
    const day = Number(value);
    if (!Number.isInteger(day) || day < 1 || day > 28) {
      return 'Due day of month is required (1–28)';
    }
    return true;
  };

  const onSubmit = async (values) => {
    if (!editing) return;
    setSaving(true);
    try {
      await recurringApi.update(editing._id, buildUpdatePayload(values));
      notifications.show({ message: 'Schedule updated', color: 'green' });
      closeEdit();
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

  const onInvalidSubmit = () => {
    setShowValidationErrors(true);
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

      <div className="flex flex-wrap gap-2 mb-4">
        {FREQUENCY_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFrequencyFilter(f.value)}
            className={`px-3 py-1.5 text-sm font-semibold rounded-lg whitespace-nowrap transition-colors ${
              frequencyFilter === f.value
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
            {f.value !== 'all' && (
              <span className="ml-1.5 opacity-80">
                ({rows.filter((r) => r.frequency === f.value).length})
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : filteredRows.length === 0 ? (
          <EmptyState
            title={frequencyFilter === 'all' ? 'No repeating bills' : `No ${frequencyFilter.toLowerCase()} bills`}
            description={
              frequencyFilter === 'all'
                ? 'Create a Fixed bill with Add Bill — it will appear here and generate on schedule'
                : 'Try another frequency or create a Fixed bill with this schedule'
            }
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
                {filteredRows.map((row) => (
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
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-6 bg-black/40 backdrop-blur-sm overflow-y-auto">
          <div className="card w-full max-w-7xl min-h-[85vh] max-h-[95vh] overflow-y-auto p-8">
            <div className="flex items-start justify-between gap-4 mb-6">
              <h3 className="text-xl font-bold">Edit schedule</h3>
              <button
                type="button"
                onClick={closeEdit}
                className="p-1.5 -mt-1 -mr-1 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form
              noValidate
              onSubmit={handleSubmit(onSubmit, onInvalidSubmit)}
              className="expense-form space-y-3"
            >
              <Paper withBorder p="md">
                <Text fw={600} mb="xs">Bill Details</Text>
                <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md" mb="md" className="items-start">
                  <Controller
                    name="expenseType"
                    control={control}
                    rules={{ required: 'Expense type is required' }}
                    render={({ field, fieldState }) => (
                      <Radio.Group
                        label="Expense Type"
                        required
                        value={field.value || ''}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        error={showControllerError('expenseType', fieldState)}
                        classNames={RADIO_GROUP_CLASS_NAMES}
                        className="w-full"
                      >
                        <Group mt={6} gap="md" wrap="wrap">
                          {(lookups?.expenseTypes || ['Capital', 'Revenue']).map((opt) => (
                            <Radio key={opt} value={opt} label={opt} classNames={RADIO_CLASS_NAMES} />
                          ))}
                        </Group>
                      </Radio.Group>
                    )}
                  />
                  <Controller
                    name="merType"
                    control={control}
                    rules={{ required: 'Payment type is required' }}
                    render={({ field, fieldState }) => (
                      <Radio.Group
                        label="Payment Type"
                        required
                        value={field.value || ''}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        error={showControllerError('merType', fieldState)}
                        classNames={RADIO_GROUP_CLASS_NAMES}
                        className="w-full"
                      >
                        <Group mt={6} gap="md" wrap="wrap">
                          {merTypeOptions.map((opt) => (
                            <Radio key={opt.value} value={opt.value} label={opt.label} classNames={RADIO_CLASS_NAMES} />
                          ))}
                        </Group>
                      </Radio.Group>
                    )}
                  />
                  <Controller
                    name="amountType"
                    control={control}
                    rules={{ required: 'Amount type is required' }}
                    render={({ field, fieldState }) => (
                      <Radio.Group
                        label="Amount Type"
                        required
                        value={field.value || 'Fixed'}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        error={showControllerError('amountType', fieldState)}
                        classNames={RADIO_GROUP_CLASS_NAMES}
                        className="w-full"
                      >
                        <Group mt={6} gap="md" wrap="wrap">
                          <Radio value="Fixed" label="Fixed amount" classNames={RADIO_CLASS_NAMES} />
                          <Radio value="Usage" label="Usage-based" classNames={RADIO_CLASS_NAMES} />
                        </Group>
                      </Radio.Group>
                    )}
                  />
                  <Controller
                    name="frequency"
                    control={control}
                    rules={{ required: 'Frequency is required' }}
                    render={({ field, fieldState }) => (
                      <FilterSelect
                        label="Repeats"
                        required
                        data={selectData(FIXED_FREQUENCY_OPTIONS)}
                        value={toSelectValue(field.value)}
                        onChange={(value) => field.onChange(toSelectValue(value) || 'Monthly')}
                        onBlur={field.onBlur}
                        error={showControllerError('frequency', fieldState)}
                      />
                    )}
                  />
                </SimpleGrid>

                <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
                  <Controller
                    name="dueDayOfMonth"
                    control={control}
                    rules={{ validate: requireRecurringDueDay }}
                    render={({ field, fieldState }) => (
                      <NumberInput
                        label="Due day of month"
                        required
                        min={1}
                        max={28}
                        hideControls
                        classNames={TEXT_INPUT_CLASS_NAMES}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        error={showControllerError('dueDayOfMonth', fieldState)}
                      />
                    )}
                  />
                  <Controller
                    name="startDate"
                    control={control}
                    render={({ field }) => (
                      <FormDateInput
                        label="Start date"
                        clearable
                        popoverProps={{ classNames: { dropdown: 'form-date-dropdown' } }}
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />
                  <Controller
                    name="endDate"
                    control={control}
                    render={({ field }) => (
                      <FormDateInput
                        label="End date"
                        clearable
                        popoverProps={{ classNames: { dropdown: 'form-date-dropdown' } }}
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />
                  <TextInput
                    label="Schedule name"
                    required
                    classNames={TEXT_INPUT_CLASS_NAMES}
                    {...register('name', { required: 'Schedule name is required' })}
                    error={showRegisterError('name')}
                  />
                </SimpleGrid>
              </Paper>

              <Paper withBorder p="md">
                <Text fw={600} mb="xs">Basic Details</Text>
                <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                  <Controller
                    name="company"
                    control={control}
                    rules={{ required: 'Company is required' }}
                    render={({ field, fieldState }) => (
                      <FilterSelect
                        label="Company"
                        searchable
                        required
                        clearable
                        disabled={companiesLoading}
                        placeholder={companiesLoading ? 'Loading companies…' : 'Select company'}
                        data={companyOptions}
                        value={toSelectValue(field.value)}
                        onChange={(value) => {
                          const nextValue = toSelectValue(value);
                          field.onChange(nextValue);
                          if (!nextValue) {
                            setValue('location', null);
                            return;
                          }
                          const company = activeCompanies.find((item) => item.name === nextValue);
                          setValue('location', getDefaultLocationValue(company));
                        }}
                        onBlur={field.onBlur}
                        error={showControllerError('company', fieldState)}
                      />
                    )}
                  />
                  <Controller
                    name="location"
                    control={control}
                    rules={{ required: 'Location is required' }}
                    render={({ field, fieldState }) => (
                      <FilterSelect
                        label="Location"
                        required
                        searchable
                        clearable
                        disabled={!selectedCompany}
                        placeholder={selectedCompany ? 'Select branch' : 'Select company first'}
                        data={locationOptions}
                        value={toSelectValue(field.value)}
                        onChange={(value) => field.onChange(toSelectValue(value))}
                        onBlur={field.onBlur}
                        error={showControllerError('location', fieldState)}
                      />
                    )}
                  />
                  <Controller
                    name="headOfExpense"
                    control={control}
                    rules={{ required: 'Head of expense is required' }}
                    render={({ field, fieldState }) => (
                      <FilterSelect
                        label="Head of Expense"
                        required
                        searchable
                        data={selectData(lookups?.expenseHeads)}
                        value={toSelectValue(field.value)}
                        onChange={(value) => field.onChange(toSelectValue(value))}
                        onBlur={field.onBlur}
                        error={showControllerError('headOfExpense', fieldState)}
                      />
                    )}
                  />
                  <TextInput label="Particulars" classNames={TEXT_INPUT_CLASS_NAMES} {...register('particulars')} />
                  <TextInput
                    label="Co Name (Payee Name)"
                    required
                    classNames={TEXT_INPUT_CLASS_NAMES}
                    {...register('coNames', { required: 'Co name is required' })}
                    error={showRegisterError('coNames')}
                  />
                </SimpleGrid>
              </Paper>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <Paper withBorder p="md">
                  <Text fw={600} mb="md">Amount & GST</Text>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mb="md">
                    <Controller
                      name="netAmount"
                      control={control}
                      rules={{ validate: requirePositiveAmount }}
                      render={({ field, fieldState }) => (
                        <NumberInput
                          label={isUsageAmount ? 'Estimated / Current Amount' : 'Net Amount'}
                          required={!isUsageAmount}
                          min={0}
                          prefix="₹"
                          hideControls
                          classNames={TEXT_INPUT_CLASS_NAMES}
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                          error={showControllerError('netAmount', fieldState)}
                        />
                      )}
                    />
                    <Controller
                      name="gstPercent"
                      control={control}
                      render={({ field }) => (
                        <NumberInput
                          label="GST %"
                          min={0}
                          max={100}
                          hideControls
                          classNames={TEXT_INPUT_CLASS_NAMES}
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      )}
                    />
                    <Controller
                      name="tds"
                      control={control}
                      render={({ field }) => (
                        <NumberInput
                          label="TDS"
                          min={0}
                          prefix="₹"
                          hideControls
                          classNames={TEXT_INPUT_CLASS_NAMES}
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      )}
                    />
                  </SimpleGrid>
                  <Controller
                    name="useIGST"
                    control={control}
                    render={({ field }) => (
                      <Checkbox
                        label="Use IGST"
                        classNames={{ root: 'cursor-pointer', label: 'cursor-pointer' }}
                        checked={Boolean(field.value)}
                        onChange={(event) => field.onChange(event.currentTarget.checked)}
                      />
                    )}
                  />
                  <div className="mt-4 space-y-2 text-sm">
                    {useIGST ? (
                      <div className="flex justify-between">
                        <span className="text-gray-600">IGST</span>
                        <span className="font-medium">₹{formatNumber(gstSummary.igst, 2)}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-600">CGST</span>
                          <span className="font-medium">₹{formatNumber(gstSummary.cgst, 2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">SGST</span>
                          <span className="font-medium">₹{formatNumber(gstSummary.sgst, 2)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between border-t border-gray-200 pt-2 font-bold text-primary-800">
                      <span>Gross</span>
                      <span>₹{formatNumber(gstSummary.gross, 0)}</span>
                    </div>
                  </div>
                </Paper>

                <Paper withBorder p="md">
                  <Text fw={600} mb="md">Payment defaults</Text>
                  <div className="space-y-4">
                    <Controller
                      name="autoPay"
                      control={control}
                      render={({ field }) => (
                        <Checkbox
                          label="Auto-pay future bills by credit card"
                          classNames={{ root: 'cursor-pointer', label: 'cursor-pointer' }}
                          checked={Boolean(field.value)}
                          onChange={(event) => {
                            const checked = event.currentTarget.checked;
                            field.onChange(checked);
                            if (checked) {
                              setValue('paymentMethod', 'Card');
                            }
                          }}
                        />
                      )}
                    />
                    {autoPay ? (
                      <Controller
                        name="autoPayCardNumber"
                        control={control}
                        rules={{
                          validate: (value) => (
                            getValues('autoPay') && !value?.trim()
                              ? 'Credit card is required for auto-pay'
                              : true
                          ),
                        }}
                        render={({ field, fieldState }) => (
                          <FilterSelect
                            label="Credit Card"
                            required
                            searchable
                            clearable
                            placeholder="Select credit card"
                            data={cardNumberOptions}
                            value={toSelectValue(field.value)}
                            onChange={(value) => field.onChange(toSelectValue(value) || '')}
                            error={showControllerError('autoPayCardNumber', fieldState)}
                          />
                        )}
                      />
                    ) : (
                      <Controller
                        name="paymentMethod"
                        control={control}
                        render={({ field }) => (
                          <FilterSelect
                            label="Default payment method"
                            clearable
                            placeholder="Optional — for generated bills"
                            data={PAYMENT_METHOD_OPTIONS.map((v) => ({ value: v, label: v }))}
                            value={toSelectValue(field.value)}
                            onChange={(value) => field.onChange(toSelectValue(value))}
                          />
                        )}
                      />
                    )}
                    <Text size="sm" c="dimmed">
                      {autoPay
                        ? 'Each generated bill will be paid in full by the selected card.'
                        : 'Leave blank to record payment when each bill is generated.'}
                    </Text>
                  </div>
                </Paper>
              </div>

              <Paper withBorder p="md">
                <Textarea label="Notes" minRows={2} {...register('notes')} />
                <Controller
                  name="isActive"
                  control={control}
                  render={({ field }) => (
                    <Switch
                      className="mt-3"
                      label="Active"
                      checked={Boolean(field.value)}
                      onChange={(event) => field.onChange(event.currentTarget.checked)}
                    />
                  )}
                />
              </Paper>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-secondary text-sm" onClick={closeEdit}>Cancel</button>
                <button type="submit" className="btn-primary text-sm" disabled={saving}>
                  {saving ? 'Saving…' : 'Update schedule'}
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

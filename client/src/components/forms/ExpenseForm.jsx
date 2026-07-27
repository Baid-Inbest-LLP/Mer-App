import { useEffect, useMemo, useState } from 'react';
import {
  SimpleGrid,
  TextInput,
  NumberInput,
  Checkbox,
  Loader,
  Paper,
  Text,
  Radio,
  Group,
} from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';
import { useForm, Controller, useFormState } from 'react-hook-form';
import { useSelector } from 'react-redux';
import { calculateGST, calculateGross } from '../../utils/gst';
import { normalizeBranchLabel } from '../../utils/locationFormat';
import { expenseApi } from '../../api/expense.api';
import FilterSelect from '../common/FilterSelect';
import FormDateInput from '../common/FormDateInput';
import { formatAmountInWords, formatMerSerial, formatNumber } from '../../utils/format';
import {
  MER_TYPE_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  MER_PAYMENT_MISMATCH_MESSAGE,
  getPaymentMethodRules,
  merTypeMatchesPaymentMethod,
  normalizeExpensePaymentFields,
} from '../../utils/paymentMethods';

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

const FREQUENCY_OPTIONS = [
  'One-time',
  'Daily',
  'Weekly',
  'Monthly',
  'Quarterly',
  'Half-yearly',
  'Yearly',
];

const formatSummaryAmount = (value) => `₹${formatNumber(value, 2)}`;

function SummaryRow({ label, value, bold = false, large = false }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span
        className={`expense-form-summary-row-label ${bold ? 'expense-form-summary-row-label-bold font-bold text-gray-900' : 'text-gray-600'}`}
      >
        {label}
      </span>
      <span
        className={`expense-form-summary-row-value ${large ? 'text-xl' : ''} ${bold ? 'expense-form-summary-row-value-bold font-bold text-primary-800' : 'font-medium text-gray-900'}`}
      >
        {formatSummaryAmount(value)}
      </span>
    </div>
  );
}

const defaultValues = {
  month: null,
  coNames: '',
  invoiceDate: new Date(),
  dueDate: null,
  location: null,
  company: null,
  invoiceNo: '',
  headOfExpense: null,
  particulars: '',
  expenseType: null,
  expenseNature: 'Variable',
  frequency: 'One-time',
  netAmount: 0,
  gstPercent: 0,
  useIGST: false,
  tds: 0,
  paymentMode: 'none',
  recordPaymentNow: false,
  initialPaymentAmount: null,
  paymentDate: null,
  paymentRefNumber: '',
  bankAccountNumber: '',
  merType: null,
  paymentMethod: null,
  notes: '',
  terms: '',
  isDraft: false,
  cgst: 0,
  sgst: 0,
  igst: 0,
  totalGST: 0,
  grossAmount: 0,
};

const RESET_FORM_OPTIONS = {
  keepErrors: false,
  keepDirty: false,
  keepTouched: false,
  keepIsSubmitted: false,
};

const getLocationsForCompany = (company) => {
  if (!company?.locations?.length) return [];

  return company.locations
    .filter((location) => location.label)
    .map((location) => {
      const label = normalizeBranchLabel(location.label);
      return { value: label, label, isDefault: Boolean(location.isDefault) };
    });
};

const getEmptyFormValues = () => ({
  ...defaultValues,
  invoiceDate: new Date(),
});

const buildInitialFormValues = (initialData) => {
  if (!initialData) return getEmptyFormValues();

  const { merType, paymentMethod } = normalizeExpensePaymentFields(initialData);

  return {
    ...defaultValues,
    ...initialData,
    merType,
    paymentMethod,
    invoiceDate: initialData.invoiceDate ? new Date(initialData.invoiceDate) : new Date(),
    dueDate: initialData.dueDate
      ? new Date(initialData.dueDate)
      : (initialData.invoiceDate ? new Date(initialData.invoiceDate) : null),
    paymentDate: initialData.paymentDate ? new Date(initialData.paymentDate) : null,
    paymentMode: (() => {
      const paid = Number(initialData.amountPaid || 0);
      const gross = Number(initialData.grossAmount || 0);
      if (paid > 0 && gross > 0 && paid < gross - 0.009) return 'partial';
      if (paid > 0 || initialData.paymentDate) return 'full';
      return 'none';
    })(),
    initialPaymentAmount: (() => {
      const paid = Number(initialData.amountPaid || 0);
      const gross = Number(initialData.grossAmount || 0);
      if (paid > 0 && gross > 0 && paid < gross - 0.009) return paid;
      if (paid > 0 || initialData.paymentDate) return gross || paid || null;
      return null;
    })(),
    recordPaymentNow: Boolean(initialData.paymentDate || Number(initialData.amountPaid || 0) > 0),
    expenseNature: initialData.expenseNature || 'Variable',
    frequency: initialData.frequency || 'One-time',
  };
};

const getDefaultLocationValue = (company) => {
  const locations = getLocationsForCompany(company);
  if (!locations.length) return null;
  return (locations.find((location) => location.isDefault) || locations[0]).value;
};

const toSelectValue = (value) => (value === '' || value === undefined ? null : value);

export default function ExpenseForm({ initialData, onSubmit, loading, companies = [], companiesLoading = false }) {
  const { lookups } = useSelector((state) => state.common);
  const [slNo, setSlNo] = useState(initialData?.slNo);
  const [resetSpinKey, setResetSpinKey] = useState(0);
  const [formResetKey, setFormResetKey] = useState(0);

  const initialFormValues = useMemo(() => buildInitialFormValues(initialData), [initialData]);

  const [showValidationErrors, setShowValidationErrors] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    getValues,
    trigger,
  } = useForm({
    defaultValues: initialFormValues,
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

  useEffect(() => {
    if (!initialData) return;

    reset(buildInitialFormValues(initialData));
    setSlNo(initialData.slNo ?? null);
  }, [initialData, reset]);

  const netAmount = watch('netAmount');
  const gstPercent = watch('gstPercent');
  const useIGST = watch('useIGST');
  const tds = watch('tds');
  const selectedCompany = watch('company');
  const selectedLocation = watch('location');
  const selectedMonth = watch('month');
  const invoiceDate = watch('invoiceDate');
  const merType = watch('merType');
  const paymentMethod = watch('paymentMethod');
  const paymentMode = watch('paymentMode');
  const recordPaymentNow = paymentMode === 'full' || paymentMode === 'partial';
  const isPoExpense = Boolean(
    initialData?.purchaseOrderId || initialData?.source === 'purchase_order',
  );

  useEffect(() => {
    if (!shouldShowErrors) return;
    trigger(['merType', 'paymentMethod', 'bankAccountNumber', 'paymentRefNumber']);
  }, [merType, paymentMethod, trigger, shouldShowErrors]);

  // Keep settlement fields in sync with payment mode + gross from Amount & GST.
  useEffect(() => {
    setValue('recordPaymentNow', recordPaymentNow);
    if (paymentMode === 'none') {
      setValue('paymentDate', null);
      setValue('initialPaymentAmount', null);
      return;
    }
    if (paymentMode === 'full') {
      setValue('initialPaymentAmount', Number(getValues('grossAmount')) || 0);
      return;
    }
    if (paymentMode === 'partial') {
      const current = Number(getValues('initialPaymentAmount'));
      const gross = Number(getValues('grossAmount')) || 0;
      if (!Number.isFinite(current) || current <= 0 || (gross > 0 && current >= gross - 0.009)) {
        setValue('initialPaymentAmount', null);
      }
    }
  }, [paymentMode, recordPaymentNow, setValue, getValues]);

  const grossAmount = watch('grossAmount') || 0;
  const initialPaymentAmount = watch('initialPaymentAmount');

  useEffect(() => {
    if (paymentMode !== 'full') return;
    setValue('initialPaymentAmount', Number(grossAmount) || 0);
  }, [paymentMode, grossAmount, setValue]);

  const paymentRules = getPaymentMethodRules(paymentMethod);

  const activeCompanies = useMemo(
    () => (companies || []).filter((company) => company.isActive !== false),
    [companies],
  );

  const companyOptions = useMemo(
    () => activeCompanies.map((company) => ({ value: company.name, label: company.name })),
    [activeCompanies],
  );

  const locationOptions = useMemo(() => {
    if (!selectedCompany) return [];

    const company = activeCompanies.find((item) => item.name === selectedCompany);
    return getLocationsForCompany(company);
  }, [activeCompanies, selectedCompany]);

  useEffect(() => {
    if (!selectedCompany) return;

    const company = activeCompanies.find((item) => item.name === selectedCompany);
    const defaultLocation = getDefaultLocationValue(company);
    const isValidLocation = locationOptions.some((option) => option.value === selectedLocation);

    if (!isValidLocation && defaultLocation) {
      setValue('location', defaultLocation);
    }
  }, [activeCompanies, selectedCompany, selectedLocation, locationOptions, setValue]);

  useEffect(() => {
    if (initialData) return;
    if (!selectedCompany || !selectedMonth) {
      setSlNo(null);
      return;
    }
    expenseApi
      .nextSlNo({
        company: selectedCompany,
        month: selectedMonth,
        invoiceDate: invoiceDate?.toISOString?.() ?? invoiceDate,
      })
      .then(({ data }) => setSlNo(data.data.slNo))
      .catch(() => setSlNo(null));
  }, [initialData, selectedCompany, selectedMonth, invoiceDate]);

  useEffect(() => {
    const gst = calculateGST(netAmount, gstPercent, useIGST);
    const gross = calculateGross(netAmount, gst.totalGST, tds);
    setValue('cgst', gst.cgst);
    setValue('sgst', gst.sgst);
    setValue('igst', gst.igst);
    setValue('totalGST', gst.totalGST);
    setValue('grossAmount', gross);
  }, [netAmount, gstPercent, useIGST, tds, setValue]);

  const selectData = (items) => (items || []).map((i) => ({ value: i, label: i }));

  const paymentMethodOptions = useMemo(
    () => selectData(lookups?.paymentMethods?.length ? lookups.paymentMethods : PAYMENT_METHOD_OPTIONS),
    [lookups?.paymentMethods],
  );

  const requireIfPaymentRule = (ruleKey, message) => (value) => {
    if (!getValues('recordPaymentNow')) return true;
    const rules = getPaymentMethodRules(getValues('paymentMethod'));
    if (!rules[ruleKey]) return true;
    return value?.trim() ? true : message;
  };

  const requirePositiveAmount = (value) => {
    const amount = Number(value);
    if (value === '' || value === null || value === undefined || Number.isNaN(amount) || amount <= 0) {
      return 'Net amount is required';
    }
    return true;
  };

  const validateMerPaymentMatch = (fieldName) => (value) => {
    const otherValue = fieldName === 'merType' ? getValues('paymentMethod') : getValues('merType');
    if (!value || !otherValue) return true;
    return merTypeMatchesPaymentMethod(
      fieldName === 'merType' ? value : otherValue,
      fieldName === 'paymentMethod' ? value : otherValue,
    ) || MER_PAYMENT_MISMATCH_MESSAGE;
  };

  const submit = (data, isDraft = false) => {
    const payload = { ...data, isDraft };
    if (!payload.dueDate && payload.invoiceDate) {
      payload.dueDate = payload.invoiceDate;
    }

    const mode = payload.paymentMode || 'none';
    const recording = mode === 'full' || mode === 'partial';
    payload.recordPaymentNow = recording;

    if (!recording) {
      delete payload.paymentDate;
      delete payload.paymentMethod;
      delete payload.paymentRefNumber;
      delete payload.bankAccountNumber;
      delete payload.cardNumber;
      delete payload.initialPaymentAmount;
    } else if (mode === 'full') {
      payload.initialPaymentAmount = Number(payload.grossAmount) || 0;
    }
    delete payload.paymentMode;

    if (payload.cardNumber) {
      payload.cardNumber = formatIssuerLast4(payload.cardNumber);
    }
    if (payload.bankAccountNumber) {
      payload.bankAccountNumber = formatIssuerLast4(payload.bankAccountNumber);
    }
    onSubmit(payload);
  };

  const onValidSubmit = (data) => {
    setShowValidationErrors(false);
    submit(data, false);
  };

  const onInvalidSubmit = () => {
    setShowValidationErrors(true);
  };

  const handleReset = () => {
    setResetSpinKey((key) => key + 1);
    setShowValidationErrors(false);

    if (initialData) {
      reset(buildInitialFormValues(initialData), RESET_FORM_OPTIONS);
      setSlNo(initialData.slNo ?? null);
    } else {
      reset(getEmptyFormValues(), RESET_FORM_OPTIONS);
      setSlNo(null);
    }

    setFormResetKey((key) => key + 1);
  };

  const handleSaveDraft = () => {
    submit(getValues(), true);
  };

  const cgst = watch('cgst') || 0;
  const sgst = watch('sgst') || 0;
  const igst = watch('igst') || 0;
  const totalGST = watch('totalGST') || 0;
  const summaryNetAmount = isPoExpense ? Math.round(Number(netAmount) || 0) : (netAmount || 0);
  const summaryGstAmount = isPoExpense ? Math.round(Number(gstAmount) || 0) : totalGST;
  const summaryIgst = isPoExpense ? Math.round(Number(gstAmount) || 0) : igst;
  const paidNow = paymentMode === 'full'
    ? Number(grossAmount) || 0
    : Number(initialPaymentAmount) || 0;
  const balanceAfterPayment = Math.max(0, (Number(grossAmount) || 0) - paidNow);

  return (
    <form key={formResetKey} noValidate onSubmit={handleSubmit(onValidSubmit, onInvalidSubmit)} className="expense-form">
      <Paper withBorder p="md" mb="sm">
        <Text fw={600} mb="xs">
          Basic details {slNo ? `(Expense No: ${formatMerSerial(slNo)})` : ''}
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 3, md: 4 }}>
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
                placeholder={companiesLoading ? 'Loading companies...' : 'Select company'}
                disabled={companiesLoading}
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
                name={field.name}
                ref={field.ref}
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
                disabled={!selectedCompany || companiesLoading}
                placeholder={selectedCompany ? 'Select branch' : 'Select company first'}
                data={locationOptions}
                {...field}
                value={toSelectValue(field.value)}
                onChange={(value) => field.onChange(toSelectValue(value))}
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
                {...field}
                value={toSelectValue(field.value)}
                onChange={(value) => field.onChange(toSelectValue(value))}
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

          <TextInput
            label="Invoice No"
            required
            classNames={TEXT_INPUT_CLASS_NAMES}
            {...register('invoiceNo', { required: 'Invoice number is required' })}
            error={showRegisterError('invoiceNo')}
          />

          <Controller
            name="invoiceDate"
            control={control}
            rules={{ required: 'Invoice date is required' }}
            render={({ field, fieldState }) => (
              <FormDateInput
                label="Invoice Date"
                required
                popoverProps={{ classNames: { dropdown: 'form-date-dropdown' } }}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={showControllerError('invoiceDate', fieldState)}
              />
            )}
          />
        </SimpleGrid>
      </Paper>

      <Paper withBorder p="md" mb="sm">
        <Text fw={600} mb="xs">
          Expense details
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mb="md" className="items-start">
          <Controller
            name="merType"
            control={control}
            rules={{
              required: 'MER type is required',
              validate: validateMerPaymentMatch('merType'),
            }}
            render={({ field, fieldState }) => (
              <Radio.Group
                label="MER Type"
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
                    <Radio
                      key={opt.value}
                      value={opt.value}
                      label={opt.label}
                      classNames={RADIO_CLASS_NAMES}
                    />
                  ))}
                </Group>
              </Radio.Group>
            )}
          />
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
                    <Radio
                      key={opt}
                      value={opt}
                      label={opt}
                      classNames={RADIO_CLASS_NAMES}
                    />
                  ))}
                </Group>
              </Radio.Group>
            )}
          />
          <Controller
            name="expenseNature"
            control={control}
            render={({ field, fieldState }) => (
              <Radio.Group
                label="Expense Nature"
                value={field.value || 'Variable'}
                onChange={(value) => field.onChange(value || 'Variable')}
                onBlur={field.onBlur}
                error={showControllerError('expenseNature', fieldState)}
                classNames={RADIO_GROUP_CLASS_NAMES}
                className="w-full"
              >
                <Group mt={6} gap="md" wrap="wrap">
                  {(lookups?.expenseNatures || ['Fixed', 'Variable']).map((opt) => (
                    <Radio
                      key={opt}
                      value={opt}
                      label={opt}
                      classNames={RADIO_CLASS_NAMES}
                    />
                  ))}
                </Group>
              </Radio.Group>
            )}
          />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
          <Controller
            name="frequency"
            control={control}
            rules={{ required: 'Expense frequency is required' }}
            render={({ field, fieldState }) => (
              <FilterSelect
                label="Expense Frequency"
                required
                data={selectData(lookups?.frequencies || FREQUENCY_OPTIONS)}
                {...field}
                value={toSelectValue(field.value || 'One-time')}
                onChange={(value) => field.onChange(toSelectValue(value) || 'One-time')}
                error={showControllerError('frequency', fieldState)}
              />
            )}
          />
          <Controller
            name="month"
            control={control}
            rules={{ required: 'Month is required' }}
            render={({ field, fieldState }) => (
              <FilterSelect
                label="Month"
                required
                data={selectData(lookups?.months)}
                {...field}
                value={toSelectValue(field.value)}
                onChange={(value) => field.onChange(toSelectValue(value))}
                error={showControllerError('month', fieldState)}
              />
            )}
          />
          <Controller
            name="dueDate"
            control={control}
            render={({ field, fieldState }) => (
              <FormDateInput
                label="Due Date"
                clearable
                popoverProps={{ classNames: { dropdown: 'form-date-dropdown' } }}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={showControllerError('dueDate', fieldState)}
              />
            )}
          />
        </SimpleGrid>
      </Paper>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3 items-stretch">
        <Paper withBorder p="md" className="h-full flex flex-col">
          <div className="flex items-center min-h-[28px] mb-4">
            <Text fw={600}>Amount & GST</Text>
          </div>
          <div className="flex flex-col gap-4 flex-1 content-start">
            <Controller
              name="netAmount"
              control={control}
              rules={{ validate: requirePositiveAmount }}
              render={({ field, fieldState }) => (
                <NumberInput
                  label="Net Amount"
                  required
                  min={0}
                  prefix="₹"
                  hideControls
                  classNames={TEXT_INPUT_CLASS_NAMES}
                  {...field}
                  error={showControllerError('netAmount', fieldState)}
                />
              )}
            />
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              {isPoExpense ? (
                <Controller
                  name="gstAmount"
                  control={control}
                  render={({ field }) => (
                    <NumberInput
                      label="GST Amount"
                      min={0}
                      prefix="₹"
                      decimalScale={2}
                      fixedDecimalScale={false}
                      hideControls
                      classNames={TEXT_INPUT_CLASS_NAMES}
                      {...field}
                    />
                  )}
                />
              ) : (
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
                      {...field}
                    />
                  )}
                />
              )}
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
                    {...field}
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
          </div>
        </Paper>

        <Paper withBorder p="md" className="h-full flex flex-col">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <Text fw={600}>Payment</Text>
            <Controller
              name="paymentMode"
              control={control}
              render={({ field }) => (
                <Radio.Group
                  value={field.value || 'none'}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  classNames={RADIO_GROUP_CLASS_NAMES}
                >
                  <Group gap="md" wrap="wrap">
                    <Radio value="none" label="Unpaid" classNames={RADIO_CLASS_NAMES} />
                    <Radio value="full" label="Pay Full" classNames={RADIO_CLASS_NAMES} />
                    <Radio value="partial" label="Pay Other" classNames={RADIO_CLASS_NAMES} />
                  </Group>
                </Radio.Group>
              )}
            />
          </div>

          <div className="expense-payment-strip mb-3 grid grid-cols-3 divide-x rounded-md border">
            <div className="flex min-w-0 items-baseline justify-between gap-1.5 px-2 py-1.5">
              <span className="expense-payment-strip-label expense-payment-strip-label--gross text-[12px] font-bold uppercase tracking-wide">
                Gross
              </span>
              <span className="expense-payment-strip-value expense-payment-strip-value--gross text-[14px] font-bold tabular-nums">
                {formatSummaryAmount(grossAmount)}
              </span>
            </div>
            <div className="flex min-w-0 items-baseline justify-between gap-1.5 px-2 py-1.5">
              <span className="expense-payment-strip-label expense-payment-strip-label--paid text-[12px] font-bold uppercase tracking-wide">
                Paid
              </span>
              <span className="expense-payment-strip-value expense-payment-strip-value--paid text-[14px] font-bold tabular-nums">
                {formatSummaryAmount(paidNow)}
              </span>
            </div>
            <div className="flex min-w-0 items-baseline justify-between gap-1.5 px-2 py-1.5">
              <span
                className={`expense-payment-strip-label text-[12px] font-bold uppercase tracking-wide ${
                  balanceAfterPayment > 0.009
                    ? 'expense-payment-strip-label--due'
                    : 'expense-payment-strip-label--paid'
                }`}
              >
                Balance
              </span>
              <span
                className={`expense-payment-strip-value text-[14px] font-bold tabular-nums ${
                  balanceAfterPayment > 0.009
                    ? 'expense-payment-strip-value--due'
                    : 'expense-payment-strip-value--paid'
                }`}
              >
                {formatSummaryAmount(balanceAfterPayment)}
              </span>
            </div>
          </div>

          {recordPaymentNow ? (
            <div className="flex flex-col gap-4 flex-1 content-start">
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <Controller
                  name="initialPaymentAmount"
                  control={control}
                  rules={{
                    validate: (value) => {
                      if (!recordPaymentNow) return true;
                      if (paymentMode === 'full') return true;
                      const amount = Number(value);
                      if (value === null || value === undefined || value === '' || Number.isNaN(amount)) {
                        return 'Payment amount is required';
                      }
                      if (amount <= 0) return 'Payment amount must be greater than zero';
                      const gross = Number(getValues('grossAmount')) || 0;
                      if (gross > 0 && amount >= gross - 0.009) {
                        return 'Use Pay Full for the complete amount';
                      }
                      if (gross > 0 && amount > gross) {
                        return 'Payment cannot exceed gross amount';
                      }
                      return true;
                    },
                  }}
                  render={({ field, fieldState }) => (
                    <NumberInput
                      label={paymentMode === 'full' ? 'Payment Amount (Full)' : 'Payment Amount'}
                      required={paymentMode === 'partial'}
                      readOnly={paymentMode === 'full'}
                      disabled={paymentMode === 'full'}
                      min={0}
                      max={paymentMode === 'partial' ? Math.max(0, Number(grossAmount) || 0) : undefined}
                      prefix="₹"
                      decimalScale={2}
                      hideControls
                      classNames={TEXT_INPUT_CLASS_NAMES}
                      value={paymentMode === 'full' ? (Number(grossAmount) || 0) : (field.value ?? '')}
                      onChange={field.onChange}
                      error={showControllerError('initialPaymentAmount', fieldState)}
                    />
                  )}
                />
                <Controller
                  name="paymentMethod"
                  control={control}
                  rules={{
                    required: recordPaymentNow ? 'Payment method is required' : false,
                  }}
                  render={({ field, fieldState }) => (
                    <FilterSelect
                      label="Payment Method"
                      required
                      clearable
                      placeholder="Select payment method"
                      data={paymentMethodOptions}
                      {...field}
                      value={toSelectValue(field.value)}
                      onChange={(value) => {
                        const next = toSelectValue(value);
                        field.onChange(next);
                        const rules = getPaymentMethodRules(next);
                        if (!rules.requiresBankAccount) {
                          setValue('bankAccountNumber', '');
                        }
                        if (!rules.requiresCardNumber) {
                          setValue('cardNumber', '');
                        }
                      }}
                      error={showControllerError('paymentMethod', fieldState)}
                    />
                  )}
                />
              </SimpleGrid>

              <SimpleGrid
                cols={{
                  base: 1,
                  sm: (paymentRules.requiresBankAccount || paymentRules.requiresCardNumber) ? 3 : 2,
                }}
                spacing="md"
              >
                {paymentRules.requiresBankAccount ? (
                  <Controller
                    name="bankAccountNumber"
                    control={control}
                    rules={{
                      validate: requireIfPaymentRule(
                        'requiresBankAccount',
                        paymentRules.bankAccountMessage || 'From account is required',
                      ),
                    }}
                    render={({ field, fieldState }) => (
                      <FilterSelect
                        label={paymentRules.bankAccountLabel || 'From Account'}
                        required
                        clearable
                        searchable
                        placeholder="Select from account"
                        data={fromAccountOptions}
                        {...field}
                        value={toSelectValue(field.value)}
                        onChange={(value) => field.onChange(toSelectValue(value) || '')}
                        error={showControllerError('bankAccountNumber', fieldState)}
                      />
                    )}
                  />
                ) : null}
                {paymentRules.requiresCardNumber ? (
                  <Controller
                    name="cardNumber"
                    control={control}
                    rules={{
                      validate: requireIfPaymentRule(
                        'requiresCardNumber',
                        paymentRules.cardNumberMessage || 'Card number is required',
                      ),
                    }}
                    render={({ field, fieldState }) => (
                      <FilterSelect
                        label={paymentRules.cardNumberLabel || 'Card No'}
                        required
                        clearable
                        searchable
                        placeholder={paymentRules.cardNumberPlaceholder || 'Select card'}
                        data={cardNumberOptions}
                        {...field}
                        value={toSelectValue(field.value)}
                        onChange={(value) => field.onChange(toSelectValue(value) || '')}
                        error={showControllerError('cardNumber', fieldState)}
                      />
                    )}
                  />
                ) : null}
                <TextInput
                  label={paymentRules.paymentRefLabel || 'Payment Ref Number'}
                  required={paymentRules.requiresPaymentRef}
                  classNames={TEXT_INPUT_CLASS_NAMES}
                  placeholder={paymentRules.paymentRefPlaceholder}
                  {...register('paymentRefNumber', {
                    validate: requireIfPaymentRule(
                      'requiresPaymentRef',
                      paymentRules.paymentRefMessage || 'Payment reference is required',
                    ),
                  })}
                  error={showRegisterError('paymentRefNumber')}
                />
                <Controller
                  name="paymentDate"
                  control={control}
                  rules={{ required: recordPaymentNow ? 'Payment date is required' : false }}
                  render={({ field, fieldState }) => (
                    <FormDateInput
                      label="Payment Date"
                      required
                      clearable
                      popoverProps={{ classNames: { dropdown: 'form-date-dropdown' } }}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      error={showControllerError('paymentDate', fieldState)}
                    />
                  )}
                />
              </SimpleGrid>
            </div>
          ) : (
            <div className="expense-payment-unpaid-hint flex flex-1 items-center rounded-lg border border-dashed px-4 py-6">
              <Text size="md" c="dimmed" className="leading-relaxed">
                Leave unpaid to track as a due bill. Choose Pay Full to settle the gross amount, or Pay Other for a partial payment.
              </Text>
            </div>
          )}
        </Paper>

        <Paper withBorder p="md" className="expense-form-summary flex flex-col h-full">
          <Text fw={600} mb="xs" className="expense-form-summary-title">
            Entry Summary
          </Text>
          <div className="space-y-3 flex-1">
            <SummaryRow label="Net Amount" value={summaryNetAmount} large />

            {useIGST ? (
              <SummaryRow label="IGST" value={igst} />
            ) : (
              <>
                <SummaryRow label="CGST" value={cgst} />
                <SummaryRow label="SGST" value={sgst} />
              </>
            )}

            <SummaryRow label="Total GST" value={totalGST} />
            <SummaryRow label="TDS" value={tds || 0} />

            <div className="expense-form-summary-gross-divider border-t border-gray-200 pt-3">
              <SummaryRow label="Gross" value={grossAmount} bold large />
            </div>

            <div className="expense-amount-words-box rounded-lg border px-4 py-3 mt-1">
              <p className="expense-amount-words-label text-xs font-semibold uppercase tracking-wide mb-1">
                Amount in Words :
              </p>
              <p className="expense-amount-words-value text-lg sm:text-xl font-semibold leading-snug">
                {formatAmountInWords(grossAmount)}
              </p>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              className="form-btn-reset"
              onClick={handleReset}
              disabled={loading}
              title="Reset"
              aria-label="Reset"
            >
              <IconRefresh key={resetSpinKey} size={18} className="form-btn-reset-icon-spin" />
            </button>
            <button
              type="button"
              className="form-btn-draft"
              disabled={loading}
              onClick={handleSaveDraft}
            >
              {loading ? <Loader size={16} color="var(--mantine-color-blue-8)" /> : null}
              Save as Draft
            </button>
            <button type="submit" className="form-btn-submit" disabled={loading}>
              {loading ? <Loader size={16} color="white" /> : null}
              {initialData?.isDraft
                ? 'Submit Entry'
                : initialData
                  ? 'Update Entry'
                  : 'Create'}
            </button>
          </div>
        </Paper>

        <Paper withBorder p="md" className="h-full flex flex-col">
          <Text fw={600} mb="xs">Notes & Terms</Text>

          <div className="mb-3">
            <label htmlFor="expense-notes" className="expense-form-field-label block text-sm font-medium mb-1">
              Notes
            </label>
            <textarea
              id="expense-notes"
              className="input-field cursor-text"
              rows={7}
              placeholder="Internal notes or special instructions..."
              {...register('notes')}
            />
          </div>

          <div className="flex-1 flex flex-col">
            <label htmlFor="expense-terms" className="expense-form-field-label block text-sm font-medium mb-1">
              Terms & Conditions
            </label>
            <textarea
              id="expense-terms"
              className="input-field cursor-text flex-1 min-h-[10rem]"
              rows={7}
              placeholder="Payment terms, delivery conditions..."
              {...register('terms')}
            />
          </div>
        </Paper>
      </div>
    </form>
  );
}

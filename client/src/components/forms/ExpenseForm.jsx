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
import { calculateGST, calculateGSTFromAmount, calculateGross } from '../../utils/gst';
import { normalizeBranchLabel } from '../../utils/locationFormat';
import { expenseApi } from '../../api/expense.api';
import FilterSelect from '../common/FilterSelect';
import FormDateInput from '../common/FormDateInput';
import ExpenseFormAmountGstSection from './ExpenseFormAmountGstSection';
import ExpenseFormPaymentSection from './ExpenseFormPaymentSection';
import ExpenseFormSummaryRow from './ExpenseFormSummaryRow';
import {
  RADIO_CLASS_NAMES,
  RADIO_GROUP_CLASS_NAMES,
  TEXT_INPUT_CLASS_NAMES,
  toDateOrNull,
  toSelectValue,
} from './expenseFormShared';
import { buildCompanySelectOptionsFromRecords } from '../../utils/companySelect';
import { formatAmountInWords, formatMerSerial } from '../../utils/format';
import {
  MER_ENTRY_TYPE_OPTIONS,
  MER_ENTRY_TYPES,
  PAYMENT_METHOD_OPTIONS,
  formatIssuerLast4,
  getCardNumberOptions,
  getFromAccountOptions,
  getPaymentMethodRules,
  normalizeExpensePaymentFields,
} from '../../utils/paymentMethods';

// A Fixed bill recurs; a Variable bill is one-time.
const FIXED_FREQUENCY_OPTIONS = ['Monthly', 'Quarterly', 'Half-yearly', 'Yearly'];
const MONTH_OPTIONS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTH_NAME_TO_INDEX = Object.fromEntries(
  MONTH_OPTIONS.map((name, index) => [name, index]),
);

const startOfLocalDay = (value) => {
  const date = toDateOrNull(value);
  if (!date) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const getMonthIndex = (monthName) => {
  if (!monthName) return null;
  if (MONTH_NAME_TO_INDEX[monthName] !== undefined) return MONTH_NAME_TO_INDEX[monthName];
  const idx = MONTH_OPTIONS.findIndex(
    (name) => name.toLowerCase() === String(monthName).trim().toLowerCase(),
  );
  return idx >= 0 ? idx : null;
};

const monthNameFromDate = (value) => {
  const date = toDateOrNull(value);
  if (!date) return null;
  return date.toLocaleString('en-US', { month: 'long' });
};

const isCurrentBillingMonth = (monthName, relativeTo = new Date()) => {
  const monthIndex = getMonthIndex(monthName);
  if (monthIndex == null) return false;
  return monthIndex === relativeTo.getMonth();
};

/** Calendar year for the billing month: keep year if date is already in that month, else current year. */
const resolveBillingMonthYear = (monthName, preferredDate = new Date()) => {
  const monthIndex = getMonthIndex(monthName);
  const preferred = toDateOrNull(preferredDate) || new Date();
  if (monthIndex == null) return preferred.getFullYear();
  if (preferred.getMonth() === monthIndex) return preferred.getFullYear();
  return new Date().getFullYear();
};

const getBillingMonthDateBounds = (monthName, preferredDate = new Date()) => {
  const monthIndex = getMonthIndex(monthName);
  if (monthIndex == null) {
    return { minDate: undefined, maxDate: undefined, calendarDate: undefined };
  }
  const year = resolveBillingMonthYear(monthName, preferredDate);
  const minDate = new Date(year, monthIndex, 1);
  const maxDate = new Date(year, monthIndex + 1, 0);
  return { minDate, maxDate, calendarDate: minDate };
};

const isDateWithinBillingMonthBounds = (value, monthName, preferredDate = new Date()) => {
  const date = startOfLocalDay(value);
  const { minDate, maxDate } = getBillingMonthDateBounds(monthName, preferredDate);
  if (!date || !minDate || !maxDate) return true;
  const min = startOfLocalDay(minDate);
  const max = startOfLocalDay(maxDate);
  return date >= min && date <= max;
};

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
  amountType: 'Fixed',
  frequency: 'One-time',
  recurringDueDay: 1,
  recurringStartDate: null,
  recurringEndDate: null,
  netAmount: '',
  gstPercent: '',
  gstAmount: '',
  useIGST: false,
  tds: '',
  paymentMode: 'none',
  recordPaymentNow: false,
  autoPay: false,
  autoPayCardNumber: '',
  initialPaymentAmount: null,
  paymentDate: null,
  paymentRefNumber: '',
  bankAccountNumber: '',
  cardNumber: '',
  merType: 'Bank',
  paymentMethod: null,
  hasBillOrReceipt: false,
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

const getEmptyFormValues = () => {
  const invoiceDate = new Date();
  return {
    ...defaultValues,
    invoiceDate,
    month: monthNameFromDate(invoiceDate),
  };
};

const buildInitialFormValues = (initialData) => {
  if (!initialData) return getEmptyFormValues();

  const { merType, paymentMethod } = normalizeExpensePaymentFields(initialData);

  const isPoExpense = Boolean(initialData.purchaseOrderId || initialData.source === 'purchase_order');

  return {
    ...defaultValues,
    ...initialData,
    merType: merType || 'Bank',
    paymentMethod,
    gstAmount: isPoExpense
      ? (initialData.gstAmount ?? initialData.totalGST ?? 0)
      : (initialData.gstAmount ?? 0),
    invoiceDate: initialData.expenseNature === 'Fixed' && !initialData.invoiceDate
      ? null
      : (initialData.invoiceDate ? new Date(initialData.invoiceDate) : new Date()),
    invoiceNo: initialData.expenseNature === 'Fixed' ? (initialData.invoiceNo || '') : (initialData.invoiceNo || ''),
    dueDate: initialData.dueDate ? new Date(initialData.dueDate) : null,
    recurringStartDate: initialData.recurringStartDate
      ? new Date(initialData.recurringStartDate)
      : null,
    recurringEndDate: initialData.recurringEndDate
      ? new Date(initialData.recurringEndDate)
      : null,
    month: initialData.month
      || monthNameFromDate(
        initialData.expenseNature === 'Fixed'
          ? (initialData.recurringStartDate || initialData.dueDate || initialData.invoiceDate)
          : (initialData.invoiceDate || new Date()),
      ),
    paymentDate: initialData.paymentDate ? new Date(initialData.paymentDate) : null,
    paymentMode: (() => {
      if (initialData.autoPay) return 'autopay';
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
    recordPaymentNow: Boolean(
      initialData.autoPay
      || initialData.paymentDate
      || Number(initialData.amountPaid || 0) > 0,
    ),
    autoPay: Boolean(initialData.autoPay),
    autoPayCardNumber: initialData.autoPayCardNumber || initialData.cardNumber || '',
    expenseNature: initialData.expenseNature || 'Variable',
    amountType: initialData.amountType || 'Fixed',
    frequency: initialData.frequency || 'One-time',
  };
};

const getDefaultLocationValue = (company) => {
  const locations = getLocationsForCompany(company);
  if (!locations.length) return null;
  return (locations.find((location) => location.isDefault) || locations[0]).value;
};

export default function ExpenseForm({
  initialData,
  onSubmit,
  loading,
  companies = [],
  companiesLoading = false,
  onBillNoChange,
}) {
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
    clearErrors,
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

  useEffect(() => {
    onBillNoChange?.(slNo ? formatMerSerial(slNo) : null);
  }, [slNo, onBillNoChange]);

  const netAmount = watch('netAmount');
  const gstPercent = watch('gstPercent');
  const gstAmount = watch('gstAmount');
  const useIGST = watch('useIGST');
  const tds = watch('tds');
  const selectedCompany = watch('company');
  const selectedLocation = watch('location');
  const selectedMonth = watch('month');
  const invoiceDate = watch('invoiceDate');
  const recurringStartDate = watch('recurringStartDate');
  const recurringDueDay = watch('recurringDueDay');
  const merType = watch('merType');
  const paymentMethod = watch('paymentMethod');
  const paymentMode = watch('paymentMode');
  const isAutoPayMode = paymentMode === 'autopay';
  const recordPaymentNow = paymentMode === 'full' || paymentMode === 'partial' || isAutoPayMode;
  const isPoExpense = Boolean(
    initialData?.purchaseOrderId || initialData?.source === 'purchase_order',
  );
  const expenseNature = watch('expenseNature');
  const amountType = watch('amountType');
  const isFixed = expenseNature === 'Fixed';
  const isUsageAmount = isFixed && amountType === 'Usage';
  const isExistingEntry = Boolean(initialData?._id);
  const alreadyRecurring = Boolean(initialData?.recurringTemplateId);

  useEffect(() => {
    if (!shouldShowErrors) return;
    trigger(['merType', 'paymentMethod', 'bankAccountNumber', 'paymentRefNumber', 'cardNumber']);
  }, [merType, paymentMethod, trigger, shouldShowErrors]);

  // New Fixed bills: keep this instance's due date in sync with the schedule day.
  useEffect(() => {
    if (!isFixed || isExistingEntry) return;
    const day = Number(recurringDueDay);
    if (!Number.isInteger(day) || day < 1 || day > 28) return;
    const date = toDateOrNull(
      getValues('recurringStartDate') || getValues('invoiceDate') || new Date(),
    );
    if (!date) return;
    setValue('dueDate', new Date(date.getFullYear(), date.getMonth(), day));
  }, [isFixed, isExistingEntry, recurringDueDay, recurringStartDate, getValues, setValue]);

  // Keep settlement fields in sync with payment mode + gross from Amount & GST.
  useEffect(() => {
    setValue('recordPaymentNow', recordPaymentNow);
    setValue('autoPay', isAutoPayMode);

    if (paymentMode === 'none') {
      setValue('paymentDate', null);
      setValue('initialPaymentAmount', null);
      setValue('paymentMethod', null);
      setValue('paymentRefNumber', '');
      setValue('cardNumber', '');
      setValue('autoPayCardNumber', '');
      return;
    }

    if (paymentMode === 'full' || isAutoPayMode) {
      setValue('initialPaymentAmount', Number(getValues('grossAmount')) || 0);
      if (!getValues('paymentDate')) {
        setValue('paymentDate', new Date());
      }
    }

    if (isAutoPayMode) {
      setValue('paymentMethod', 'Card');
      setValue('paymentRefNumber', 'AUTO-PAY');
      setValue('bankAccountNumber', '');
      return;
    }

    if (paymentMode === 'partial') {
      const current = Number(getValues('initialPaymentAmount'));
      const gross = Number(getValues('grossAmount')) || 0;
      if (!Number.isFinite(current) || current <= 0 || (gross > 0 && current >= gross - 0.009)) {
        setValue('initialPaymentAmount', null);
      }
    }
  }, [paymentMode, recordPaymentNow, isAutoPayMode, setValue, getValues]);

  const grossAmount = watch('grossAmount') || 0;
  const initialPaymentAmount = watch('initialPaymentAmount');

  useEffect(() => {
    if (paymentMode !== 'full' && paymentMode !== 'autopay') return;
    setValue('initialPaymentAmount', Number(grossAmount) || 0);
  }, [paymentMode, grossAmount, setValue]);

  const paymentRules = getPaymentMethodRules(paymentMethod);

  const merTypeOptions = useMemo(() => {
    const current = initialData?.merType;
    if (current && !MER_ENTRY_TYPES.includes(current)) {
      return [{ value: current, label: current }, ...MER_ENTRY_TYPE_OPTIONS];
    }
    return MER_ENTRY_TYPE_OPTIONS;
  }, [initialData?.merType]);

  const paymentMethodOptions = useMemo(() => {
    const base = PAYMENT_METHOD_OPTIONS.map((item) => ({ value: item, label: item }));
    const current = initialData?.paymentMethod;
    if (
      current
      && !PAYMENT_METHOD_OPTIONS.includes(current)
      && !base.some((opt) => opt.value === current)
    ) {
      return [...base, { value: current, label: current }];
    }
    return base;
  }, [initialData?.paymentMethod]);

  const fromAccountOptions = useMemo(
    () => getFromAccountOptions(initialData?.bankAccountNumber, lookups?.bankAccounts),
    [initialData?.bankAccountNumber, lookups?.bankAccounts],
  );

  const cardNumberOptions = useMemo(
    () => getCardNumberOptions(initialData?.cardNumber, lookups?.cards),
    [initialData?.cardNumber, lookups?.cards],
  );

  const activeCompanies = useMemo(
    () => (companies || []).filter((company) => company.isActive !== false),
    [companies],
  );

  const companyOptions = useMemo(
    () => buildCompanySelectOptionsFromRecords(activeCompanies),
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
    if (!selectedCompany || !selectedMonth || !merType) {
      if (!initialData) setSlNo(null);
      return undefined;
    }

    const serialAnchor = isFixed ? (recurringStartDate || invoiceDate) : invoiceDate;
    const fyStartYear = (value) => {
      if (!value) return '';
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      const year = date.getFullYear();
      return date.getMonth() >= 3 ? year : year - 1;
    };

    const depsKey = `${selectedCompany}|${selectedMonth}|${merType}|${fyStartYear(serialAnchor)}`;
    const initialAnchor = initialData
      ? (initialData.expenseNature === 'Fixed'
        ? (initialData.recurringStartDate || initialData.invoiceDate)
        : initialData.invoiceDate)
      : null;
    const initialKey = initialData
      ? `${initialData.company || ''}|${initialData.month || ''}|${initialData.merType || ''}|${fyStartYear(initialAnchor)}`
      : '';

    // Edit with unchanged serial dependents — keep the saved bill no.
    if (initialData && depsKey === initialKey && initialData.slNo) {
      setSlNo(initialData.slNo);
      return undefined;
    }

    let cancelled = false;
    expenseApi
      .nextSlNo({
        company: selectedCompany,
        month: selectedMonth,
        invoiceDate: serialAnchor?.toISOString?.() ?? serialAnchor,
        merType,
      })
      .then(({ data }) => {
        if (!cancelled) setSlNo(data.data.slNo);
      })
      .catch(() => {
        if (!cancelled) setSlNo(initialData?.slNo ?? null);
      });

    return () => {
      cancelled = true;
    };
  }, [initialData, selectedCompany, selectedMonth, invoiceDate, recurringStartDate, isFixed, merType]);

  useEffect(() => {
    const gst = isPoExpense
      ? calculateGSTFromAmount(gstAmount, useIGST)
      : calculateGST(netAmount, gstPercent, useIGST);
    // Inputs stay as entered; only gross is rounded for summary / payload.
    const gross = calculateGross(Number(netAmount) || 0, gst.totalGST, tds);
    setValue('cgst', gst.cgst);
    setValue('sgst', gst.sgst);
    setValue('igst', gst.igst);
    setValue('totalGST', gst.totalGST);
    setValue('grossAmount', gross);
    if (isPoExpense) {
      const net = Number(netAmount) || 0;
      const raw = Number(gstAmount) || 0;
      setValue('gstPercent', net > 0 ? Number(((raw / net) * 100).toFixed(2)) : 0);
    }
  }, [netAmount, gstPercent, gstAmount, useIGST, tds, isPoExpense, setValue]);

  const selectData = (items) => (items || []).map((i) => ({ value: i, label: i }));

  const requireIfPaymentRule = (ruleKey, message) => (value) => {
    if (!getValues('recordPaymentNow')) return true;
    const rules = getPaymentMethodRules(getValues('paymentMethod'));
    if (!rules[ruleKey]) return true;
    return value?.trim() ? true : message;
  };

  const requirePositiveAmount = (value) => {
    if (getValues('expenseNature') === 'Fixed' && getValues('amountType') === 'Usage') {
      const amount = Number(value);
      if (value === '' || value === null || value === undefined || Number.isNaN(amount) || amount < 0) {
        return 'Amount cannot be negative';
      }
      return true;
    }
    const amount = Number(value);
    if (value === '' || value === null || value === undefined || Number.isNaN(amount) || amount <= 0) {
      return 'Net amount is required';
    }
    return true;
  };

  const requireInvoiceNo = (value) => {
    if (getValues('expenseNature') === 'Fixed') return true;
    return value?.trim() ? true : 'Invoice number is required';
  };

  const requireInvoiceDate = (value) => {
    if (getValues('expenseNature') === 'Fixed') return true;
    if (!value) return 'Invoice date is required';
    const month = getValues('month');
    if (month && !isDateWithinBillingMonthBounds(value, month, value)) {
      return `Invoice date must be within ${month}`;
    }
    return true;
  };

  const requireDueDate = (value) => {
    if (!value) return true;
    const invoice = getValues('invoiceDate');
    if (!invoice) return true;
    const due = startOfLocalDay(value);
    const inv = startOfLocalDay(invoice);
    if (due && inv && due < inv) {
      return 'Due date cannot be before invoice date';
    }
    return true;
  };

  const requireRecurringDueDay = (value) => {
    if (getValues('expenseNature') !== 'Fixed') return true;
    const day = Number(value);
    if (!Number.isInteger(day) || day < 1 || day > 28) {
      return 'Due day of month is required (1–28)';
    }
    return true;
  };

  const submit = (data, isDraft = false) => {
    const payload = { ...data, isDraft };
    payload.dueDate = data.dueDate || null;
    payload.netAmount = Number(payload.netAmount) || 0;
    payload.gstPercent = Number(payload.gstPercent) || 0;
    payload.gstAmount = Number(payload.gstAmount) || 0;
    payload.tds = Number(payload.tds) || 0;

    const mode = payload.paymentMode || 'none';
    const recording = mode === 'full' || mode === 'partial' || mode === 'autopay';
    const isAutoPay = mode === 'autopay';
    payload.recordPaymentNow = recording;
    payload.autoPay = isAutoPay;

    if (!recording) {
      delete payload.paymentDate;
      delete payload.paymentMethod;
      delete payload.paymentRefNumber;
      delete payload.bankAccountNumber;
      delete payload.cardNumber;
      delete payload.initialPaymentAmount;
      delete payload.autoPayCardNumber;
    } else if (mode === 'full' || isAutoPay) {
      payload.initialPaymentAmount = Number(payload.grossAmount) || 0;
    }
    delete payload.paymentMode;

    if (payload.cardNumber) {
      payload.cardNumber = formatIssuerLast4(payload.cardNumber);
    }
    if (isAutoPay) {
      payload.paymentMethod = 'Card';
      payload.paymentRefNumber = payload.paymentRefNumber || 'AUTO-PAY';
      payload.autoPayCardNumber = payload.cardNumber || '';
    } else {
      delete payload.autoPayCardNumber;
    }
    if (payload.bankAccountNumber) {
      payload.bankAccountNumber = formatIssuerLast4(payload.bankAccountNumber);
    }

    // Nature drives recurrence: Fixed => recurring schedule; Variable => one-time.
    if (payload.expenseNature === 'Variable') {
      payload.frequency = 'One-time';
      payload.amountType = 'Fixed';
    } else if (!payload.amountType) {
      payload.amountType = 'Fixed';
    }
    const wantsRecurring = payload.expenseNature === 'Fixed'
      && !isDraft
      && payload.frequency
      && payload.frequency !== 'One-time';
    if (wantsRecurring) {
      payload.recurringStartDate = payload.recurringStartDate instanceof Date
        ? payload.recurringStartDate.toISOString()
        : payload.recurringStartDate || undefined;
      payload.recurringEndDate = payload.recurringEndDate instanceof Date
        ? payload.recurringEndDate.toISOString()
        : payload.recurringEndDate || undefined;
    } else {
      delete payload.recurringDueDay;
      delete payload.recurringStartDate;
      delete payload.recurringEndDate;
      delete payload.scheduleName;
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
  const summaryNetAmount = netAmount || 0;
  const summaryGstAmount = isPoExpense ? (Number(gstAmount) || 0) : totalGST;
  const summaryIgst = isPoExpense ? (Number(gstAmount) || 0) : igst;
  const paidNow = (paymentMode === 'full' || isAutoPayMode)
    ? Number(grossAmount) || 0
    : Number(initialPaymentAmount) || 0;
  const balanceAfterPayment = Math.max(0, (Number(grossAmount) || 0) - paidNow);

  return (
    <form key={formResetKey} noValidate onSubmit={handleSubmit(onValidSubmit, onInvalidSubmit)} className="expense-form">
      <Paper withBorder p="md" mb="sm">
        <Text fw={600} mb="xs">
          Bill Details
        </Text>
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
            name="expenseNature"
            control={control}
            rules={{ required: 'Bill nature is required' }}
            render={({ field, fieldState }) => (
              <Radio.Group
                label="Bill Nature"
                required
                value={field.value || 'Variable'}
                onChange={(value) => {
                  const nextNature = value || 'Variable';
                  field.onChange(nextNature);
                  if (nextNature === 'Variable') {
                    setValue('frequency', 'One-time');
                    setValue('amountType', 'Fixed');
                    if (getValues('paymentMode') === 'autopay') {
                      setValue('paymentMode', 'none');
                      setValue('autoPay', false);
                    }
                    clearErrors(['dueDate', 'recurringDueDay', 'amountType', 'netAmount']);
                    if (!getValues('invoiceDate')) {
                      const today = new Date();
                      setValue('invoiceDate', today);
                      setValue('month', monthNameFromDate(today));
                    }
                  } else {
                    clearErrors(['invoiceNo', 'invoiceDate']);
                    const current = getValues('frequency');
                    if (!current || !FIXED_FREQUENCY_OPTIONS.includes(current)) {
                      setValue('frequency', 'Monthly');
                    }
                    if (!getValues('amountType')) {
                      setValue('amountType', 'Fixed');
                    }
                    if (!getValues('recurringDueDay')) {
                      setValue('recurringDueDay', 1);
                    }
                    if (!getValues('recurringStartDate')) {
                      setValue('recurringStartDate', new Date());
                    }
                  }
                }}
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
          <Controller
            name="month"
            control={control}
            rules={{ required: 'Billing month is required' }}
            render={({ field, fieldState }) => (
              <FilterSelect
                label="Billing Month"
                required
                searchable
                clearable
                placeholder="Select month"
                data={selectData(
                  lookups?.months?.length ? lookups.months : MONTH_OPTIONS,
                )}
                value={toSelectValue(field.value)}
                onChange={(value) => {
                  const month = toSelectValue(value);
                  field.onChange(month);
                  if (!month || isFixed) return;

                  if (isCurrentBillingMonth(month)) {
                    const today = new Date();
                    setValue('invoiceDate', today, { shouldValidate: shouldShowErrors });
                    const due = getValues('dueDate');
                    if (due && startOfLocalDay(due) < startOfLocalDay(today)) {
                      setValue('dueDate', today, { shouldValidate: shouldShowErrors });
                    }
                    return;
                  }

                  setValue('invoiceDate', null, { shouldValidate: shouldShowErrors });
                }}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
                error={showControllerError('month', fieldState)}
              />
            )}
          />
        </SimpleGrid>

        {isFixed && !isExistingEntry && !isPoExpense && (
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
            <Controller
              name="recurringDueDay"
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
                  error={showControllerError('recurringDueDay', fieldState)}
                />
              )}
            />
            <Controller
              name="frequency"
              control={control}
              render={({ field }) => (
                <FilterSelect
                  label="Repeats"
                  required
                  data={selectData(FIXED_FREQUENCY_OPTIONS)}
                  value={toSelectValue(FIXED_FREQUENCY_OPTIONS.includes(field.value) ? field.value : 'Monthly')}
                  onChange={(value) => field.onChange(toSelectValue(value) || 'Monthly')}
                />
              )}
            />
            <Controller
              name="recurringStartDate"
              control={control}
              render={({ field }) => (
                <FormDateInput
                  label="Start date"
                  clearable
                  popoverProps={{ classNames: { dropdown: 'form-date-dropdown' } }}
                  value={field.value}
                  onChange={(value) => field.onChange(toDateOrNull(value))}
                />
              )}
            />
            <Controller
              name="recurringEndDate"
              control={control}
              render={({ field }) => (
                <FormDateInput
                  label="End date"
                  clearable
                  popoverProps={{ classNames: { dropdown: 'form-date-dropdown' } }}
                  value={field.value}
                  onChange={(value) => field.onChange(toDateOrNull(value))}
                />
              )}
            />
          </SimpleGrid>
        )}

        {isExistingEntry && alreadyRecurring && (
          <Text size="sm" fw={500} className="mt-4">
            This bill is part of a recurring schedule. Manage it under Bills → Recurring.
          </Text>
        )}
      </Paper>

      <Paper withBorder p="md" mb="sm">
        <Text fw={600} mb="xs">
          Basic Details
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
            required={!isFixed}
            classNames={TEXT_INPUT_CLASS_NAMES}
            {...register('invoiceNo', { validate: requireInvoiceNo })}
            error={showRegisterError('invoiceNo')}
          />

          <Controller
            name="invoiceDate"
            control={control}
            rules={{ validate: requireInvoiceDate }}
            render={({ field, fieldState }) => {
              const bounds = selectedMonth
                ? getBillingMonthDateBounds(selectedMonth, field.value || new Date())
                : { minDate: undefined, maxDate: undefined, calendarDate: undefined };
              return (
                <FormDateInput
                  label="Invoice Date"
                  required={!isFixed}
                  clearable={isFixed}
                  popoverProps={{ classNames: { dropdown: 'form-date-dropdown' } }}
                  value={field.value}
                  date={field.value || bounds.calendarDate}
                  minDate={bounds.minDate}
                  maxDate={bounds.maxDate}
                  maxLevel="month"
                  onChange={(value) => {
                    let next = toDateOrNull(value);
                    if (
                      next
                      && selectedMonth
                      && !isDateWithinBillingMonthBounds(next, selectedMonth, next)
                    ) {
                      next = null;
                    }
                    field.onChange(next);
                    const due = getValues('dueDate');
                    if (next && due && startOfLocalDay(due) < startOfLocalDay(next)) {
                      setValue('dueDate', next, { shouldValidate: shouldShowErrors });
                    } else if (shouldShowErrors) {
                      trigger('dueDate');
                    }
                  }}
                  onBlur={field.onBlur}
                  error={showControllerError('invoiceDate', fieldState)}
                />
              );
            }}
          />

          <Controller
            name="dueDate"
            control={control}
            rules={{ validate: requireDueDate }}
            render={({ field, fieldState }) => {
              const invoiceDay = startOfLocalDay(invoiceDate);
              const invoiceKey = invoiceDay ? invoiceDay.getTime() : 'none';
              return (
                <FormDateInput
                  key={`due-date-${invoiceKey}`}
                  label="Due Date"
                  clearable
                  popoverProps={{ classNames: { dropdown: 'form-date-dropdown' } }}
                  value={field.value}
                  minDate={invoiceDay || undefined}
                  defaultDate={invoiceDay || field.value || undefined}
                  excludeDate={
                    invoiceDay
                      ? (date) => {
                        const day = startOfLocalDay(date);
                        return Boolean(day && day < invoiceDay);
                      }
                      : undefined
                  }
                  onChange={(value) => field.onChange(toDateOrNull(value))}
                  onBlur={field.onBlur}
                  error={showControllerError('dueDate', fieldState)}
                />
              );
            }}
          />
        </SimpleGrid>
      </Paper>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3 items-stretch">
        <ExpenseFormAmountGstSection
          control={control}
          clearErrors={clearErrors}
          showControllerError={showControllerError}
          requirePositiveAmount={requirePositiveAmount}
          isFixed={isFixed}
          isPoExpense={isPoExpense}
          isUsageAmount={isUsageAmount}
        />
        <ExpenseFormPaymentSection
          control={control}
          register={register}
          getValues={getValues}
          setValue={setValue}
          showControllerError={showControllerError}
          showRegisterError={showRegisterError}
          requireIfPaymentRule={requireIfPaymentRule}
          isFixed={isFixed}
          isAutoPayMode={isAutoPayMode}
          recordPaymentNow={recordPaymentNow}
          paymentMode={paymentMode}
          paymentRules={paymentRules}
          grossAmount={grossAmount}
          paidNow={paidNow}
          balanceAfterPayment={balanceAfterPayment}
          paymentMethodOptions={paymentMethodOptions}
          fromAccountOptions={fromAccountOptions}
          cardNumberOptions={cardNumberOptions}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3 items-stretch">
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

        <Paper withBorder p="md" className="expense-form-summary flex flex-col h-full">
          <Text fw={600} mb="xs" className="expense-form-summary-title">
            Summary
          </Text>
          <div className="space-y-3 flex-1">
            <ExpenseFormSummaryRow label="Net Amount" value={summaryNetAmount} large />

            {useIGST ? (
              <ExpenseFormSummaryRow label="IGST" value={summaryIgst} />
            ) : (
              <>
                <ExpenseFormSummaryRow label="CGST" value={cgst} />
                <ExpenseFormSummaryRow label="SGST" value={sgst} />
                <ExpenseFormSummaryRow label="Total GST" value={isPoExpense ? summaryGstAmount : totalGST} />
              </>
            )}

            <ExpenseFormSummaryRow label="TDS" value={tds || 0} />

            <div className="expense-form-summary-gross-divider border-t border-gray-200 pt-3">
              <ExpenseFormSummaryRow label="Gross" value={grossAmount} bold large decimals={0} />
            </div>

            <div className="expense-amount-words-box rounded-lg border px-4 py-3 mt-1">
              <p className="expense-amount-words-label text-xs font-semibold uppercase tracking-wide mb-1">
                Amount in Words :
              </p>
              <p className="expense-amount-words-value text-lg sm:text-xl font-semibold leading-snug">
                {formatAmountInWords(grossAmount)}
              </p>
            </div>

            <Controller
              name="hasBillOrReceipt"
              control={control}
              render={({ field }) => (
                <Checkbox
                  label="Bill / Receipt available"
                  classNames={{ root: 'cursor-pointer', label: 'cursor-pointer' }}
                  checked={Boolean(field.value)}
                  onChange={(event) => field.onChange(event.currentTarget.checked)}
                />
              )}
            />
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
                : initialData?._id
                  ? 'Update Entry'
                  : 'Create'}
            </button>
          </div>
        </Paper>
      </div>
    </form>
  );
}

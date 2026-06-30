import { useEffect, useMemo, useState } from 'react';
import {
  SimpleGrid,
  TextInput,
  NumberInput,
  Switch,
  Loader,
  Paper,
  Text,
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
const SWITCH_CLASS_NAMES = { track: 'cursor-pointer', label: 'cursor-pointer' };

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
  location: null,
  company: null,
  invoiceNo: '',
  headOfExpense: null,
  particulars: '',
  expenseType: null,
  netAmount: 0,
  gstPercent: 0,
  useIGST: false,
  tds: 0,
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
    paymentDate: initialData.paymentDate ? new Date(initialData.paymentDate) : null,
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

  useEffect(() => {
    if (!shouldShowErrors) return;
    trigger(['merType', 'paymentMethod', 'bankAccountNumber', 'paymentRefNumber']);
  }, [merType, paymentMethod, trigger, shouldShowErrors]);

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
    onSubmit({ ...data, isDraft });
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
  const grossAmount = watch('grossAmount') || 0;

  return (
    <form key={formResetKey} noValidate onSubmit={handleSubmit(onValidSubmit, onInvalidSubmit)}>
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
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
          <Controller
            name="merType"
            control={control}
            rules={{
              required: 'MER type is required',
              validate: validateMerPaymentMatch('merType'),
            }}
            render={({ field, fieldState }) => (
              <FilterSelect
                label="MER Type"
                required
                clearable
                placeholder="Select MER type"
                data={MER_TYPE_OPTIONS}
                {...field}
                value={toSelectValue(field.value)}
                onChange={(value) => field.onChange(toSelectValue(value))}
                error={showControllerError('merType', fieldState)}
              />
            )}
          />
          <Controller
            name="expenseType"
            control={control}
            rules={{ required: 'Expense type is required' }}
            render={({ field, fieldState }) => (
              <FilterSelect
                label="Expense Type"
                required
                clearable
                placeholder="Select expense type"
                data={selectData(lookups?.expenseTypes)}
                {...field}
                value={toSelectValue(field.value)}
                onChange={(value) => field.onChange(toSelectValue(value))}
                error={showControllerError('expenseType', fieldState)}
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
        </SimpleGrid>
      </Paper>

      <div className="dashboard-grid-2 mb-3 gap-3">
        <Paper withBorder p="md">
          <Text fw={600} mb="xs">
            Payment
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Controller
              name="paymentDate"
              control={control}
              rules={{ required: 'Payment date is required' }}
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
            <Controller
              name="paymentMethod"
              control={control}
              rules={{
                required: 'Payment method is required',
                validate: validateMerPaymentMatch('paymentMethod'),
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
                  onChange={(value) => field.onChange(toSelectValue(value))}
                  error={showControllerError('paymentMethod', fieldState)}
                />
              )}
            />
            {paymentRules.requiresBankAccount ? (
              <TextInput
                label={paymentRules.bankAccountLabel || 'Bank Account Number'}
                required
                classNames={TEXT_INPUT_CLASS_NAMES}
                placeholder={paymentRules.bankAccountPlaceholder}
                {...register('bankAccountNumber', {
                  validate: requireIfPaymentRule(
                    'requiresBankAccount',
                    paymentRules.bankAccountMessage || 'Bank account number is required',
                  ),
                })}
                error={showRegisterError('bankAccountNumber')}
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
          </SimpleGrid>
        </Paper>
        <Paper withBorder p="md">
          <Text fw={600} mb="xs">
            Amount & GST
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
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
            <Controller
              name="useIGST"
              control={control}
              render={({ field }) => (
                <Switch
                  label="Use IGST"
                  mt="xl"
                  classNames={SWITCH_CLASS_NAMES}
                  checked={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </SimpleGrid>
        </Paper>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Paper withBorder p="md" mb="sm">
          <Text fw={600} mb="xs">Notes & Terms</Text>

          <div>
            <label htmlFor="expense-notes" className="block text-sm font-medium text-gray-700 mb-1">
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

          <div>
            <label htmlFor="expense-terms" className="block text-sm font-medium text-gray-700 mb-1">
              Terms & Conditions
            </label>
            <textarea
              id="expense-terms"
              className="input-field cursor-text"
              rows={7}
              placeholder="Payment terms, delivery conditions..."
              {...register('terms')}
            />
          </div>
        </Paper>
        <Paper withBorder p="md" mb="sm" className="expense-form-summary flex flex-col justify-between">
          <Text fw={600} mb="xs" className="expense-form-summary-title">
            Entry Summary
          </Text>
          <div className="space-y-3">
            <SummaryRow label="Net Amount" value={netAmount || 0} large />

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

            <div className="expense-amount-words-box rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 mt-1">
              <p className="expense-amount-words-label text-xs font-semibold uppercase tracking-wide text-gray-700 mb-1">
                Amount in Words :
              </p>
              <p className="expense-amount-words-value text-lg sm:text-xl font-semibold leading-snug text-primary-700">
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
                  : 'Create Entry'}
            </button>
          </div>
        </Paper>
      </div>
    </form>
  );
}

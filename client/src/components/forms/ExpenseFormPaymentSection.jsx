import { SimpleGrid, NumberInput, TextInput, Paper, Text, Radio, Group } from '@mantine/core';
import { Controller } from 'react-hook-form';
import FilterSelect from '../common/FilterSelect';
import FormDateInput from '../common/FormDateInput';
import { getPaymentMethodRules } from '../../utils/paymentMethods';
import {
  formatSummaryAmount,
  RADIO_CLASS_NAMES,
  RADIO_GROUP_CLASS_NAMES,
  TEXT_INPUT_CLASS_NAMES,
  toDateOrNull,
  toSelectValue,
} from './expenseFormShared';

export default function ExpenseFormPaymentSection({
  control,
  register,
  getValues,
  setValue,
  showControllerError,
  showRegisterError,
  requireIfPaymentRule,
  isFixed,
  isAutoPayMode,
  recordPaymentNow,
  paymentMode,
  paymentRules,
  grossAmount,
  paidNow,
  balanceAfterPayment,
  paymentMethodOptions,
  fromAccountOptions,
  cardNumberOptions,
}) {
  return (
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
                {isFixed && (
                  <Radio value="autopay" label="Auto-pay" classNames={RADIO_CLASS_NAMES} />
                )}
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
            {formatSummaryAmount(grossAmount, 0)}
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
          {isAutoPayMode && (
            <Text size="sm" c="dimmed">
              Pays the full billed amount by credit card and enables auto-pay for future recurring bills.
            </Text>
          )}
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Controller
              name="initialPaymentAmount"
              control={control}
              rules={{
                validate: (value) => {
                  if (!recordPaymentNow) return true;
                  if (paymentMode === 'full' || isAutoPayMode) return true;
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
                  label={
                    isAutoPayMode || paymentMode === 'full'
                      ? 'Payment Amount (Full)'
                      : 'Payment Amount'
                  }
                  required={paymentMode === 'partial'}
                  readOnly={paymentMode === 'full' || isAutoPayMode}
                  disabled={paymentMode === 'full' || isAutoPayMode}
                  min={0}
                  max={paymentMode === 'partial' ? Math.max(0, Number(grossAmount) || 0) : undefined}
                  prefix="₹"
                  decimalScale={2}
                  hideControls
                  classNames={TEXT_INPUT_CLASS_NAMES}
                  value={
                    (paymentMode === 'full' || isAutoPayMode)
                      ? (Number(grossAmount) || 0)
                      : (field.value ?? '')
                  }
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
                  clearable={!isAutoPayMode}
                  placeholder="Select payment method"
                  data={isAutoPayMode
                    ? [{ value: 'Card', label: 'Card' }]
                    : paymentMethodOptions}
                  {...field}
                  value={toSelectValue(field.value)}
                  onChange={(value) => {
                    if (isAutoPayMode) {
                      field.onChange('Card');
                      return;
                    }
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
                  disabled={isAutoPayMode}
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
                    label={isAutoPayMode ? 'Credit Card' : (paymentRules.cardNumberLabel || 'Card No')}
                    required
                    clearable={!isAutoPayMode}
                    searchable
                    placeholder={
                      isAutoPayMode
                        ? 'Select credit card'
                        : (paymentRules.cardNumberPlaceholder || 'Select card')
                    }
                    data={cardNumberOptions}
                    {...field}
                    value={toSelectValue(field.value)}
                    onChange={(value) => {
                      const next = toSelectValue(value) || '';
                      field.onChange(next);
                      if (isAutoPayMode) {
                        setValue('autoPayCardNumber', next);
                      }
                    }}
                    error={showControllerError('cardNumber', fieldState)}
                  />
                )}
              />
            ) : null}
            <TextInput
              label={paymentRules.paymentRefLabel || 'Payment Ref Number'}
              required={paymentRules.requiresPaymentRef}
              readOnly={isAutoPayMode}
              disabled={isAutoPayMode}
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
                  onChange={(value) => field.onChange(toDateOrNull(value))}
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
            {isFixed
              ? 'Leave unpaid to track as a due bill. Choose Pay Full, Pay Other, or Auto-pay to settle by credit card.'
              : 'Leave unpaid to track as a due bill. Choose Pay Full to settle the gross amount, or Pay Other for a partial payment.'}
          </Text>
        </div>
      )}
    </Paper>
  );
}

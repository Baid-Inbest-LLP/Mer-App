import { SimpleGrid, NumberInput, Checkbox, Paper, Text, Radio, Group } from '@mantine/core';
import { Controller } from 'react-hook-form';
import {
  RADIO_CLASS_NAMES,
  RADIO_GROUP_CLASS_NAMES,
  TEXT_INPUT_CLASS_NAMES,
} from './expenseFormShared';

export default function ExpenseFormAmountGstSection({
  control,
  clearErrors,
  showControllerError,
  requirePositiveAmount,
  isFixed,
  isPoExpense,
  isUsageAmount,
}) {
  return (
    <Paper withBorder p="md" className="h-full flex flex-col">
      <div className="flex items-center min-h-[28px] mb-4">
        <Text fw={600}>Amount & GST</Text>
      </div>
      <div className="flex flex-col gap-4 flex-1 content-start">
        <SimpleGrid cols={{ base: 1, sm: isFixed ? 2 : 1 }} spacing="md">
          {isFixed && (
            <Controller
              name="amountType"
              control={control}
              rules={{ required: isFixed ? 'Amount type is required' : false }}
              render={({ field, fieldState }) => (
                <Radio.Group
                  label="Amount Type"
                  required
                  value={field.value || 'Fixed'}
                  onChange={(value) => {
                    const next = value || 'Fixed';
                    field.onChange(next);
                    if (next === 'Usage') {
                      clearErrors('netAmount');
                    }
                  }}
                  onBlur={field.onBlur}
                  error={showControllerError('amountType', fieldState)}
                  classNames={RADIO_GROUP_CLASS_NAMES}
                >
                  <Group mt={6} gap="md" wrap="wrap">
                    <Radio value="Fixed" label="Fixed amount" classNames={RADIO_CLASS_NAMES} />
                    <Radio value="Usage" label="Usage-based" classNames={RADIO_CLASS_NAMES} />
                  </Group>
                </Radio.Group>
              )}
            />
          )}
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
                decimalScale={isPoExpense ? 2 : undefined}
                fixedDecimalScale={false}
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
        </SimpleGrid>
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
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
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
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
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
      </div>
    </Paper>
  );
}

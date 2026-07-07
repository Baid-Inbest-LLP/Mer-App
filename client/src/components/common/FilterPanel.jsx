import { SimpleGrid, TextInput, Group, Button } from '@mantine/core';
import { useState } from 'react';
import { useSelector } from 'react-redux';
import { getRecentFinancialYearOptions } from '../../utils/financialYear';
import FilterSelect from './FilterSelect';
import { buildCompanySelectOptions } from '../../utils/companySelect';

const TIMEFRAMES = [
  { value: '', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'quarter', label: 'This quarter' },
  { value: 'year', label: 'This year' },
];

export default function FilterPanel({ filters, onChange, onApply, onClear, compact, hide = [] }) {
  const { lookups } = useSelector((state) => state.common);
  const [resetKey, setResetKey] = useState(0);
  const isHidden = (key) => hide.includes(key);

  const locationOptions =
    filters.company && lookups?.companyLocations?.[filters.company]
      ? lookups.companyLocations[filters.company]
      : lookups?.locations;

  const update = (key, value) => {
    const next = { ...filters, [key]: value || undefined };
    if (key === 'company' && value !== filters.company) {
      const validLocations = lookups?.companyLocations?.[value];
      if (validLocations && filters.location && !validLocations.includes(filters.location)) {
        next.location = undefined;
      }
    }
    onChange(next);
  };

  const selectData = (items) =>
    (items || []).map((item) => ({ value: item, label: item }));

  const selectValue = (key) => filters[key] ?? null;

  const handleClear = () => {
    onClear?.();
    setResetKey((k) => k + 1);
  };

  const companyOptions = buildCompanySelectOptions(
    lookups?.companies,
    lookups?.companyCodeByName,
  );

  return (
    <div className="card p-4 mb-4 filter-panel">
      <SimpleGrid key={resetKey} cols={{ base: 1, sm: 2, md: compact ? 3 : 4, lg: compact ? 4 : 6 }} spacing="sm">
        {!isHidden('search') && (
          <TextInput
            placeholder="Search expense no, invoice, company, co name..."
            value={filters.search || ''}
            onChange={(e) => update('search', e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onApply?.();
            }}
          />
        )}
        {!isHidden('timeframe') && (
          <FilterSelect
            placeholder="Timeframe"
            clearable
            data={TIMEFRAMES}
            value={selectValue('timeframe')}
            onChange={(v) => update('timeframe', v)}
          />
        )}
        <FilterSelect
          placeholder="Financial year"
          clearable
          searchable
          data={getRecentFinancialYearOptions(lookups?.currentFinancialYear, 2)}
          value={selectValue('financialYear')}
          onChange={(v) => update('financialYear', v)}
        />
        <FilterSelect
          placeholder="Month"
          clearable
          searchable
          data={selectData(lookups?.months)}
          value={selectValue('month')}
          onChange={(v) => update('month', v)}
        />
        {!isHidden('quarter') && (
          <FilterSelect
            placeholder="Quarter"
            clearable
            data={selectData(lookups?.quarters)}
            value={selectValue('quarter')}
            onChange={(v) => update('quarter', v)}
          />
        )}
        {!isHidden('approvalStatus') && (
          <FilterSelect
            placeholder="Approval status"
            clearable
            data={selectData(lookups?.approvalStatuses)}
            value={selectValue('approvalStatus')}
            onChange={(v) => update('approvalStatus', v)}
          />
        )}
        <FilterSelect
          placeholder="Expense type"
          clearable
          data={selectData(lookups?.expenseTypes)}
          value={selectValue('expenseType')}
          onChange={(v) => update('expenseType', v)}
        />
        <FilterSelect
          placeholder="Payment method"
          clearable
          data={selectData(lookups?.paymentMethods)}
          value={selectValue('paymentMethod')}
          onChange={(v) => update('paymentMethod', v)}
        />
        <FilterSelect
          placeholder="Head of expense"
          clearable
          searchable
          data={selectData(lookups?.expenseHeads)}
          value={selectValue('headOfExpense')}
          onChange={(v) => update('headOfExpense', v)}
        />
        {!isHidden('coNames') && (
          <TextInput
            placeholder="Co name"
            value={filters.coNames || ''}
            onChange={(e) => update('coNames', e.target.value)}
          />
        )}
        <FilterSelect
          placeholder="Company"
          clearable
          searchable
          data={companyOptions}
          value={selectValue('company')}
          onChange={(v) => update('company', v)}
        />
        <FilterSelect
          placeholder="Location / Branch"
          clearable
          searchable
          data={selectData(locationOptions)}
          value={selectValue('location')}
          onChange={(v) => update('location', v)}
        />
      </SimpleGrid>
      <Group mt="md" justify="flex-end">
        <Button variant="default" onClick={handleClear}>
          Clear
        </Button>
        <Button className="btn-primary" onClick={onApply}>
          Apply filters
        </Button>
      </Group>
    </div>
  );
}

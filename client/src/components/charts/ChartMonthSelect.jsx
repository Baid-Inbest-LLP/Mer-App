import { Select } from '@mantine/core';

export default function ChartMonthSelect({ fyMonthOptions = [], selectedMonth, onMonthChange }) {
  const monthSelectData = fyMonthOptions.map((o) => ({ value: o.value, label: o.label }));

  return (
    <div className="w-full sm:w-24 lg:w-20 xl:w-24 shrink-0">
      <Select
        size="sm"
        placeholder="Select month"
        value={selectedMonth || null}
        onChange={(val) => val && onMonthChange(val)}
        data={monthSelectData}
        allowDeselect={false}
        comboboxProps={{ withinPortal: true, zIndex: 1000 }}
      />
    </div>
  );
}

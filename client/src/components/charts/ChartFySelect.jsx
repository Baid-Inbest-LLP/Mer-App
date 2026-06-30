import { Select } from '@mantine/core';

export default function ChartFySelect({ fyOptions = [], selectedFy, onFyChange }) {
  return (
    <div className="w-full sm:w-28 lg:w-24 xl:w-28 shrink-0">
      <Select
        size="sm"
        placeholder="Financial year"
        value={selectedFy || null}
        onChange={(val) => val && onFyChange(val)}
        data={fyOptions}
        allowDeselect={false}
        searchable
        comboboxProps={{ withinPortal: true, zIndex: 1000 }}
      />
    </div>
  );
}

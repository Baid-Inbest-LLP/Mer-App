import { MultiSelect } from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';

export default function FilterMultiSelect({ classNames, ...props }) {
  return (
    <MultiSelect
      rightSection={<IconChevronDown size={16} stroke={1.5} />}
      rightSectionPointerEvents="none"
      comboboxProps={{ withinPortal: true, zIndex: 1000 }}
      classNames={{
        ...classNames,
        input: [classNames?.input, 'cursor-pointer'].filter(Boolean).join(' '),
        error: [classNames?.error, 'text-red-500 text-xs mt-1'].filter(Boolean).join(' '),
      }}
      {...props}
    />
  );
}

import { DateInput } from '@mantine/dates';
import { IconCalendar } from '@tabler/icons-react';

export default function FormDateInput({ classNames, popoverProps, ...props }) {
  return (
    <DateInput
      valueFormat="DD/MM/YYYY"
      placeholder="DD/MM/YYYY"
      rightSection={<IconCalendar size={16} stroke={1.5} className="text-gray-500 pointer-events-none" />}
      rightSectionPointerEvents="none"
      popoverProps={{
        withinPortal: true,
        zIndex: 1000,
        shadow: 'md',
        radius: 'md',
        ...popoverProps,
      }}
      classNames={{
        ...classNames,
        input: [classNames?.input, 'cursor-pointer'].filter(Boolean).join(' '),
        error: [classNames?.error, 'text-red-500 text-xs mt-1'].filter(Boolean).join(' '),
      }}
      {...props}
    />
  );
}

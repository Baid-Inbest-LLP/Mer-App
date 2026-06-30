import { Stack, Text, ThemeIcon } from '@mantine/core';
import { IconDatabaseOff } from '@tabler/icons-react';

export default function EmptyState({ title = 'No data found', description, actionLabel, onAction }) {
  return (
    <Stack align="center" py="xl" gap="md">
      <ThemeIcon size={60} radius="xl" variant="light" color="gray">
        <IconDatabaseOff size={32} />
      </ThemeIcon>
      <Text fw={600}>{title}</Text>
      {description && (
        <Text c="dimmed" size="sm" ta="center" maw={400}>
          {description}
        </Text>
      )}
      {actionLabel && onAction && (
        <button type="button" onClick={onAction} className="btn-primary">
          {actionLabel}
        </button>
      )}
    </Stack>
  );
}

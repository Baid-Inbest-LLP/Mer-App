import { Paper, Text, Group, ThemeIcon, Stack } from '@mantine/core';

export default function KPICard({ title, value, icon: Icon, color = 'blue', subtitle }) {
  return (
    <Paper withBorder p="md" radius="md" h="100%">
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            {title}
          </Text>
          <Text size="xl" fw={700}>
            {value}
          </Text>
          {subtitle && (
            <Text size="xs" c="dimmed">
              {subtitle}
            </Text>
          )}
        </Stack>
        {Icon && (
          <ThemeIcon size="lg" radius="md" variant="light" color={color}>
            <Icon size={20} />
          </ThemeIcon>
        )}
      </Group>
    </Paper>
  );
}

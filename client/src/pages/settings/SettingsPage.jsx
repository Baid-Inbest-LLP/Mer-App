import { useEffect, useState } from 'react';
import { Paper, Table, Text, Badge, Tabs, Loader, Center } from '@mantine/core';
import { useSelector } from 'react-redux';
import PageBanner from '../../components/common/PageBanner';
import { masterApi } from '../../api/master.api';

function UsersPanel() {
  const [users, setUsers] = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data } = await masterApi.users();
        if (!cancelled) setUsers(data.data);
      } catch {
        if (!cancelled) setUsers([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (users === null) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }

  return (
    <Paper withBorder radius="md">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Email</Table.Th>
            <Table.Th>Role</Table.Th>
            <Table.Th>Status</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {users.map((u) => (
            <Table.Tr key={u._id}>
              <Table.Td>{u.name}</Table.Td>
              <Table.Td>{u.email}</Table.Td>
              <Table.Td>{u.role}</Table.Td>
              <Table.Td>
                <Badge color={u.isActive ? 'green' : 'red'}>
                  {u.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}

export default function SettingsPage() {
  const { user } = useSelector((state) => state.auth);
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  return (
    <div>
      <PageBanner
        className="mb-4"
        title="Settings"
        subtitle="Application configuration and users"
      />
       <Tabs defaultValue="profile">
        <Tabs.List>
          <Tabs.Tab value="profile">Profile</Tabs.Tab>
          {isAdmin && <Tabs.Tab value="users">Users</Tabs.Tab>}
        </Tabs.List>
        <Tabs.Panel value="profile" pt="md">
          <Paper withBorder p="lg" radius="md" maw={480}>
            <Text fw={600}>{user?.name}</Text>
            <Text c="dimmed" size="sm">
              {user?.email}
            </Text>
            <Badge mt="sm">{user?.role}</Badge>
          </Paper>
        </Tabs.Panel>
        {isAdmin && (
          <Tabs.Panel value="users" pt="md">
            <UsersPanel key={user?.id} />
          </Tabs.Panel>
        )}
      </Tabs>
    </div>
  );
}

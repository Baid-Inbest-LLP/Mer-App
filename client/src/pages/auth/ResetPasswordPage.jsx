import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Paper, Title, Text, PasswordInput, Button, Stack, Center, Box } from '@mantine/core';
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { authApi } from '../../api/auth.api';
import { notifications } from '@mantine/notifications';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');
  const { register, handleSubmit } = useForm();
  const [loading, setLoading] = useState(false);

  const onSubmit = async ({ password }) => {
    if (!token) {
      notifications.show({ title: 'Invalid link', message: 'Missing token', color: 'red' });
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword({ token, password });
      notifications.show({ title: 'Success', message: 'Password updated', color: 'green' });
      navigate('/login');
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err.response?.data?.message || 'Reset failed',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Center mih="100vh">
      <Box maw={420} w="100%" px="md">
        <Paper withBorder shadow="md" p="xl" radius="md">
          <Title order={3} mb="lg">
            Reset password
          </Title>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Stack gap="md">
              <PasswordInput
                label="New password"
                required
                minLength={6}
                {...register('password', { required: true, minLength: 6 })}
              />
              <Button type="submit" fullWidth loading={loading} disabled={!token}>
                Update password
              </Button>
              <Text size="sm" ta="center">
                <Link to="/login">Back to login</Link>
              </Text>
            </Stack>
          </form>
        </Paper>
      </Box>
    </Center>
  );
}

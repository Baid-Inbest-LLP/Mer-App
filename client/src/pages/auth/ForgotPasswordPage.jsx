import { Link } from 'react-router-dom';
import { Paper, Title, Text, TextInput, Button, Stack, Center, Box, Alert } from '@mantine/core';
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { authApi } from '../../api/auth.api';
import { notifications } from '@mantine/notifications';

export default function ForgotPasswordPage() {
  const { register, handleSubmit } = useForm();
  const [loading, setLoading] = useState(false);
  const [resetUrl, setResetUrl] = useState(null);

  const onSubmit = async ({ email }) => {
    setLoading(true);
    try {
      const { data } = await authApi.forgotPassword(email);
      notifications.show({
        title: 'Check your email',
        message: data.message || 'If the email exists, a reset link was sent.',
        color: 'green',
      });
      if (data.data?.resetUrl) setResetUrl(data.data.resetUrl);
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err.response?.data?.message || 'Request failed',
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
          <Title order={3} mb="xs">
            Forgot password
          </Title>
          <Text c="dimmed" size="sm" mb="lg">
            Enter your email to receive a reset link
          </Text>
          {resetUrl && (
            <Alert color="blue" mb="md" title="Dev reset link">
              <Text size="xs" component={Link} to={resetUrl.replace(/^https?:\/\/[^/]+/, '')}>
                {resetUrl}
              </Text>
            </Alert>
          )}
          <form onSubmit={handleSubmit(onSubmit)}>
            <Stack gap="md">
              <TextInput label="Email" required {...register('email')} />
              <Button type="submit" fullWidth loading={loading}>
                Send reset link
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

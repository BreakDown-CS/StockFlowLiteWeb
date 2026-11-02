'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, App, Button, Card, Flex, Form, Input, Typography } from 'antd';

import { bffRequest } from '@/lib/api/bff-client';
import { ApiError } from '@/lib/api/errors';
import { messageForCode } from '@/lib/api/messages';

type Values = { current_password: string; new_password: string; confirm_password: string };

/**
 * Change password.
 *
 * The API revokes every session of the user on success — including the one used to make
 * the request — so the BFF clears its cookie and we send the user back to sign-in. That is
 * the point of this screen: it demonstrates global session invalidation end to end.
 */
export function ChangePasswordScreen() {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm<Values>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFinish(values: Values): Promise<void> {
    setSubmitting(true);
    setError(null);
    try {
      await bffRequest('/api/bff/auth/change-password', {
        method: 'POST',
        body: {
          current_password: values.current_password,
          new_password: values.new_password,
        },
      });
      message.success('Password changed — every session was signed out');
      router.replace('/login?reason=session_expired');
      router.refresh();
    } catch (cause) {
      setError(messageForCode(cause instanceof ApiError ? cause.code : 'INTERNAL_ERROR'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Flex vertical gap={16}>
      <Flex vertical gap={2}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Change password
        </Typography.Title>
        <Typography.Text type="secondary">
          Changing your password signs you out everywhere, including this browser.
        </Typography.Text>
      </Flex>

      <Card style={{ maxWidth: 520 }}>
        <Form<Values> form={form} layout="vertical" requiredMark="optional" onFinish={handleFinish}>
          {error && (
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
              message="Could not change the password"
              description={error}
            />
          )}

          <Form.Item
            name="current_password"
            label="Current password"
            rules={[{ required: true, message: 'Enter your current password' }]}
          >
            <Input.Password autoComplete="current-password" maxLength={1024} />
          </Form.Item>

          <Form.Item
            name="new_password"
            label="New password"
            rules={[
              { required: true, message: 'Enter a new password' },
              { min: 8, message: 'Use at least 8 characters' },
            ]}
          >
            <Input.Password autoComplete="new-password" maxLength={1024} />
          </Form.Item>

          <Form.Item
            name="confirm_password"
            label="Confirm new password"
            dependencies={['new_password']}
            rules={[
              { required: true, message: 'Repeat the new password' },
              ({ getFieldValue }) => ({
                validator(_, value: string) {
                  if (!value || getFieldValue('new_password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('The passwords do not match'));
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" maxLength={1024} />
          </Form.Item>

          <Flex gap={8}>
            <Button type="primary" htmlType="submit" loading={submitting}>
              Change password
            </Button>
            <Link href="/">
              <Button htmlType="button">Cancel</Button>
            </Link>
          </Flex>
        </Form>
      </Card>
    </Flex>
  );
}

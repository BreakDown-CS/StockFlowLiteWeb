'use client';

import { useState } from 'react';
import { Alert, App, Button, Form, Input, Typography } from 'antd';
import { useRouter, useSearchParams } from 'next/navigation';

import { bffRequest } from '@/lib/api/bff-client';
import { ApiError } from '@/lib/api/errors';
import { messageForCode } from '@/lib/api/messages';

type LoginValues = {
  username: string;
  password: string;
};

type LoginResult = {
  user: { id: string; username: string; role: string };
  expires_at: string;
};

/**
 * Only allow same-origin relative destinations, so `?next=` cannot be used as an
 * open redirect to another site.
 */
function sanitizeNext(raw: string | null): string {
  if (!raw) {
    return '/';
  }
  if (!raw.startsWith('/') || raw.startsWith('//')) {
    return '/';
  }
  return raw;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { message } = App.useApp();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reason = searchParams.get('reason');
  const nextPath = sanitizeNext(searchParams.get('next'));

  async function handleFinish(values: LoginValues): Promise<void> {
    setSubmitting(true);
    setError(null);

    try {
      await bffRequest<LoginResult>('/api/bff/auth/login', {
        method: 'POST',
        body: values,
      });
      message.success('Signed in');
      router.replace(nextPath);
      router.refresh();
    } catch (cause) {
      const code = cause instanceof ApiError ? cause.code : 'INTERNAL_ERROR';
      // A 502/504 means the API is down, which is a different problem from a
      // rejected password; messageForCode keeps those distinguishable.
      setError(messageForCode(code));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form<LoginValues>
      layout="vertical"
      requiredMark={false}
      onFinish={handleFinish}
      autoComplete="on"
      initialValues={{ username: '' }}
    >
      {reason === 'session_expired' && !error && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Your session ended"
          description="Sign in again to continue where you left off."
        />
      )}

      {error && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="Sign-in failed"
          description={error}
        />
      )}

      <Form.Item
        name="username"
        label="Username"
        rules={[
          { required: true, message: 'Enter your username' },
          { max: 50, message: 'Username is too long' },
        ]}
      >
        <Input
          autoFocus
          autoComplete="username"
          placeholder="e.g. admin"
          size="large"
          maxLength={50}
          disabled={submitting}
        />
      </Form.Item>

      <Form.Item
        name="password"
        label="Password"
        rules={[{ required: true, message: 'Enter your password' }]}
      >
        <Input.Password
          autoComplete="current-password"
          size="large"
          maxLength={1024}
          disabled={submitting}
        />
      </Form.Item>

      <Form.Item style={{ marginBottom: 0 }}>
        <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
          Sign in
        </Button>
      </Form.Item>

      <Typography.Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0 }}>
        Your session is stored in an httpOnly cookie. The API token is never exposed to
        the browser.
      </Typography.Paragraph>
    </Form>
  );
}

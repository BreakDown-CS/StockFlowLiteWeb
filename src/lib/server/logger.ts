import 'server-only';

/**
 * Structured logger with mandatory redaction.
 *
 * Anything that can carry a credential is replaced before it reaches stdout:
 * `Authorization` headers, cookies, passwords and CSRF tokens. Error objects are
 * reduced to name + message so stack traces cannot smuggle in header dumps.
 */

const REDACTED = '[redacted]';

const SENSITIVE_KEYS = new Set(
  [
    'authorization',
    'cookie',
    'cookies',
    'set-cookie',
    'password',
    'current_password',
    'new_password',
    'token',
    'sessiontoken',
    'x-csrf-token',
    'csrf',
    'sessionsecret',
    'idempotency-key',
  ].map((key) => key.toLowerCase()),
);

type LogFields = Record<string, unknown>;

function redactValue(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }
  if (typeof value === 'object' && value !== null) {
    return redactFields(value as LogFields);
  }
  return value;
}

function redactFields(fields: LogFields): LogFields {
  const output: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    output[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? REDACTED : redactValue(value);
  }
  return output;
}

function emit(level: 'info' | 'warn' | 'error', message: string, fields?: LogFields): void {
  const payload = fields ? redactFields(fields) : {};
  const line = JSON.stringify({ level, message, ...payload, at: new Date().toISOString() });

  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.info(line);
}

export const logger = {
  info: (message: string, fields?: LogFields) => emit('info', message, fields),
  warn: (message: string, fields?: LogFields) => emit('warn', message, fields),
  error: (message: string, fields?: LogFields) => emit('error', message, fields),
};

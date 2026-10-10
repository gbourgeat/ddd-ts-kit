import { errorCode } from '@ddd-ts-kit/events';

/**
 * What may be reported about a caught error. JetStream answers a refused request with a
 * numeric error code (`10058` for a stream that exists with another configuration): it
 * becomes `JETSTREAM_10058`. A connection error wraps the system error: its code
 * (`ECONNREFUSED`) is the one reported. Never the message.
 */
export function failureCode(error: unknown): string {
  if (typeof error !== 'object' || error === null) {
    return errorCode(error);
  }

  if ('code' in error && typeof error.code === 'number' && Number.isInteger(error.code)) {
    return `JETSTREAM_${String(error.code)}`;
  }

  const cause: unknown = 'cause' in error ? error.cause : undefined;
  const causeCode = errorCode(cause);

  return causeCode === 'UNKNOWN_ERROR' || causeCode === 'Error' ? errorCode(error) : causeCode;
}

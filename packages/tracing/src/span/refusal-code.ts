import type { Attributes } from '@opentelemetry/api';

const CODE = /^[A-Za-z_][A-Za-z0-9_.:-]{0,63}$/;

/** The `code` of an error as a span attribute, when it is shaped like a code: never a message. */
export function refusalCode(error: unknown): Attributes {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return {};
  }

  const { code } = error;

  return typeof code === 'string' && CODE.test(code) ? { 'app.error.code': code } : {};
}

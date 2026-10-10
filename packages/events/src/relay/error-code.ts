const IDENTIFIER = /^[A-Za-z][A-Za-z0-9_.:-]{0,63}$/;

/**
 * What may be stored and logged about a caught error: its `code` when it carries one, else
 * its class name. Never its message, which may quote payload data.
 */
export function errorCode(error: unknown): string {
  if (typeof error !== 'object' || error === null) {
    return 'UNKNOWN_ERROR';
  }

  if ('code' in error && typeof error.code === 'string' && IDENTIFIER.test(error.code)) {
    return error.code;
  }

  const name = error instanceof Error ? error.constructor.name : '';

  return IDENTIFIER.test(name) ? name : 'UNKNOWN_ERROR';
}

import type { ErrorDescription } from './error-description.js';

const SHORT_CODE = /^[A-Za-z0-9_.:-]{1,64}$/;

/** What may be recorded about a caught error. Never its message: it quotes data. */
export function describeError(error: unknown): ErrorDescription {
  const errorCode = codeOf(error);

  return {
    errorType: error instanceof Error ? error.constructor.name : typeof error,
    ...(errorCode === undefined ? {} : { errorCode }),
  };
}

function codeOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;

  const { code } = error;

  return typeof code === 'string' && SHORT_CODE.test(code) ? code : undefined;
}

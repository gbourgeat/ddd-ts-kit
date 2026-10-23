import type { ErrorIdentity } from './error-identity';

const SHORT_CODE = /^[A-Za-z0-9_.:-]{1,64}$/;

/**
 * What the kit records about an error it caught on its own: its class and its code. Never its
 * message, which quotes data, and never the error itself: `describeError` is for the error a
 * project decides to log.
 */
export function identifyError(error: unknown): ErrorIdentity {
  const errorCode = codeOf(error);

  return {
    errorType: error instanceof Error ? error.constructor.name : typeof error,
    ...(errorCode === undefined ? {} : { errorCode }),
  };
}

function codeOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }

  const { code } = error;

  return typeof code === 'string' && SHORT_CODE.test(code) ? code : undefined;
}

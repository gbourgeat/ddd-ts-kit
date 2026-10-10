export const UNEXPECTED_ERROR = 'UNEXPECTED_ERROR';

const SHORT_CODE = /^[A-Za-z0-9_.:-]{1,64}$/;

/** The `code` of a `DomainError` or of a fault that carries a short one. Never a message. */
export function errorCodeOf(error: unknown): string {
  if (typeof error !== 'object' || error === null || !('code' in error)) return UNEXPECTED_ERROR;

  const { code } = error;

  return typeof code === 'string' && SHORT_CODE.test(code) ? code : UNEXPECTED_ERROR;
}

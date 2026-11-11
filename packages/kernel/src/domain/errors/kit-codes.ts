/**
 * The codes of the refusals the packages of the kit raise, whichever package raises them: what a
 * route may declare in `errors`, and what a test may expect, without a class of the project.
 * `KitCodes.Forbidden` is the code `'FORBIDDEN'`; a misspelled key does not compile.
 */
export const KitCodes = {
  ValidationFailed: 'VALIDATION_FAILED',
  NotFound: 'NOT_FOUND',
  Conflict: 'CONFLICT',
  InvariantViolation: 'INVARIANT_VIOLATION',
  Unauthorized: 'UNAUTHORIZED',
  Forbidden: 'FORBIDDEN',
  NotAcceptable: 'NOT_ACCEPTABLE',
  ConcurrencyConflict: 'CONCURRENCY_CONFLICT',
  InvalidCriteria: 'INVALID_CRITERIA',
  InvalidPageRequest: 'INVALID_PAGE_REQUEST',
  Timeout: 'TIMEOUT',
  CircuitOpen: 'CIRCUIT_OPEN',
  BulkheadFull: 'BULKHEAD_FULL',
  AttemptsExhausted: 'ATTEMPTS_EXHAUSTED',
  ServiceUnavailable: 'SERVICE_UNAVAILABLE',
  PreconditionFailed: 'PRECONDITION_FAILED',
  PreconditionRequired: 'PRECONDITION_REQUIRED',
  FileTooLarge: 'FILE_TOO_LARGE',
  UnsupportedMediaType: 'UNSUPPORTED_MEDIA_TYPE',
  FileNotFound: 'FILE_NOT_FOUND',
  FileRejected: 'FILE_REJECTED',
  InvalidFileKey: 'INVALID_FILE_KEY',
} as const;

/** One code of the kit: `'FORBIDDEN' | 'NOT_FOUND' | ...`. */
export type KitCode = (typeof KitCodes)[keyof typeof KitCodes];

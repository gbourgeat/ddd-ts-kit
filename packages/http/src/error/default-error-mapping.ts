import type { ErrorMapping } from './error-mapping.js';

export const DEFAULT_ERROR_MAPPING: ErrorMapping = {
  VALIDATION_FAILED: 422,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INVARIANT_VIOLATION: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
};

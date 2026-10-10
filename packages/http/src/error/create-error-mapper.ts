import { DEFAULT_ERROR_MAPPING } from './default-error-mapping.js';
import type { ErrorMapper } from './error-mapper.js';
import type { ErrorMapping } from './error-mapping.js';

export interface ErrorMapperOptions {
  /** Status of a `DomainError` whose code is not mapped. Defaults to 422. */
  readonly fallbackStatus?: number;
  /** Builds the problem `type` URI of a code. Defaults to `urn:problem:<code-in-kebab-case>`. */
  readonly typeOf?: (code: string) => string;
}

export function createErrorMapper(overrides: ErrorMapping = {}, options: ErrorMapperOptions = {}): ErrorMapper {
  const mapping: ErrorMapping = { ...DEFAULT_ERROR_MAPPING, ...overrides };
  const fallbackStatus = options.fallbackStatus ?? 422;

  const typeOf = options.typeOf ?? ((code: string) => `urn:problem:${code.toLowerCase().replaceAll('_', '-')}`);

  return {
    mapping,
    statusOf: (code) => mapping[code] ?? fallbackStatus,
    typeOf,
  };
}

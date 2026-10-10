import { DomainError } from '../../domain/errors/domain-error.js';

export const INVALID_PAGE_REQUEST = 'INVALID_PAGE_REQUEST';

export class InvalidPageRequestError extends DomainError {
  readonly code = INVALID_PAGE_REQUEST;
}

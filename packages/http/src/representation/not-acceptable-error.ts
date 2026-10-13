import { DomainError } from '@ddd-ts-kit/kernel';

export const NOT_ACCEPTABLE = 'NOT_ACCEPTABLE';

/** The `Accept` header of the request names no media type the route answers in: 406. */
export class NotAcceptableError extends DomainError {
  readonly code = NOT_ACCEPTABLE;
}

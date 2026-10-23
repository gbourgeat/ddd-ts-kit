import { DomainError } from '@ddd-ts-kit/kernel';

/** The reason of a failure that is not a `DomainError`: its class and message stay out of the trail. */
export const UNEXPECTED_ERROR = 'UNEXPECTED_ERROR';

/** What a `failed` entry says of what was thrown: the `code` of a `DomainError`, a constant for anything else. */
export function failureReason(failure: unknown): string {
  return failure instanceof DomainError ? failure.code : UNEXPECTED_ERROR;
}

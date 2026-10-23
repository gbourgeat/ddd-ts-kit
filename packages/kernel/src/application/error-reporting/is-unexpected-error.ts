import { DomainError } from '../../domain/errors/domain-error';

/**
 * A `DomainError` is a business refusal the code planned for: an answer, not an incident.
 * Everything else thrown is a fault somebody has to look at.
 */
export function isUnexpectedError(error: unknown): boolean {
  return !(error instanceof DomainError);
}

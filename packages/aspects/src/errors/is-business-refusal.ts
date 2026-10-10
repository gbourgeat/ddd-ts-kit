import { DomainError } from '@ddd-ts-kit/kernel';

/** A business refusal: the dependency answered, and asking again would get the same answer. */
export function isBusinessRefusal(error: unknown): boolean {
  return error instanceof DomainError;
}

import { DomainError } from '@ddd-ts-kit/kernel';

export class DelegationEndsInThePastError extends DomainError {
  readonly code = 'DELEGATION_ENDS_IN_THE_PAST';

  constructor(readonly endsAt: Date) {
    super(`A delegation cannot end in the past (${endsAt.toISOString()}).`);
  }
}

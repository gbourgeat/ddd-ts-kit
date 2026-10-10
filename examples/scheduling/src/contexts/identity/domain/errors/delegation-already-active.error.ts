import { DomainError } from '@ddd-ts-kit/kernel';

export class DelegationAlreadyActiveError extends DomainError {
  readonly code = 'DELEGATION_ALREADY_ACTIVE';

  constructor(readonly delegationId: string) {
    super(`This practitioner already delegates to this assistant (delegation ${delegationId}).`);
  }
}

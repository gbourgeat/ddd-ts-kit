import { DomainError } from '@ddd-ts-kit/kernel';

export class DelegationNotActiveError extends DomainError {
  readonly code = 'DELEGATION_NOT_ACTIVE';

  constructor(readonly delegationId: string) {
    super(`The delegation ${delegationId} already ended.`);
  }
}

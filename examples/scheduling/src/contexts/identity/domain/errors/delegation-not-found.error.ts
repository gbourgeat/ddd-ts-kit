import { DomainError } from '@ddd-ts-kit/kernel';

export class DelegationNotFoundError extends DomainError {
  readonly code = 'DELEGATION_NOT_FOUND';

  constructor(readonly delegationId: string) {
    super(`The delegation ${delegationId} does not exist on this desk.`);
  }
}

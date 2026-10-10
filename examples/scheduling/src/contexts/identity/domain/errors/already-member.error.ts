import { DomainError } from '@ddd-ts-kit/kernel';

export class AlreadyMemberError extends DomainError {
  readonly code = 'ALREADY_MEMBER';

  constructor(readonly personId: string) {
    super(`The person ${personId} is already a member of this practice.`);
  }
}

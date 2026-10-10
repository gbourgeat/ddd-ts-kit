import { DomainError } from '@ddd-ts-kit/kernel';

export class NotAMemberError extends DomainError {
  readonly code = 'NOT_A_MEMBER';

  constructor(readonly personId: string) {
    super(`The person ${personId} is not a member of this practice.`);
  }
}

import { DomainError } from '@ddd-ts-kit/kernel';

export class UnknownRoleError extends DomainError {
  readonly code = 'UNKNOWN_ROLE';

  constructor(readonly value: string) {
    super(`"${value}" is not a role of a practice: manager, practitioner or assistant.`);
  }
}

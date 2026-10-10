import { DomainError } from '@ddd-ts-kit/kernel';

export class NotAnAssistantError extends DomainError {
  readonly code = 'NOT_AN_ASSISTANT';

  constructor(readonly personId: string) {
    super(`The person ${personId} is not an assistant of this practice.`);
  }
}

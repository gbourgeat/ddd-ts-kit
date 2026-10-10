import { DomainError } from '@ddd-ts-kit/kernel';

export class PracticeNotFoundError extends DomainError {
  readonly code = 'PRACTICE_NOT_FOUND';

  constructor(readonly practiceId: string) {
    super(`The practice ${practiceId} does not exist.`);
  }
}

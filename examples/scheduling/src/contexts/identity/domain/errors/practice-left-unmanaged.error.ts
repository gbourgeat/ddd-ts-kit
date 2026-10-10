import { DomainError } from '@ddd-ts-kit/kernel';

export class PracticeLeftUnmanagedError extends DomainError {
  readonly code = 'LAST_MANAGER';

  constructor() {
    super('A practice keeps at least one manager: its last manager cannot be removed.');
  }
}

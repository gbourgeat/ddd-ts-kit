import { DomainError } from '@ddd-ts-kit/kernel';

export class InvalidDisplayNameError extends DomainError {
  readonly code = 'INVALID_DISPLAY_NAME';

  constructor() {
    super('A display name holds between 1 and 120 characters.');
  }
}

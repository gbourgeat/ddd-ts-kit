import { DomainError } from '@ddd-ts-kit/kernel';

export class InvalidEmailError extends DomainError {
  readonly code = 'INVALID_EMAIL';

  constructor(readonly value: string) {
    super(`"${value}" is not an address the platform can write to.`);
  }
}

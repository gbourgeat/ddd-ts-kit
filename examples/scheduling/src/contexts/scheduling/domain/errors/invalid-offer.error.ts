import { DomainError } from '@ddd-ts-kit/kernel';

export class InvalidOfferError extends DomainError {
  readonly code = 'INVALID_OFFER';

  constructor(rule: string) {
    super(`An offer ${rule}.`);
  }
}

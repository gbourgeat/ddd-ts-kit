import { DomainError } from '@ddd-ts-kit/kernel';

export class LedgerUnavailable extends DomainError {
  readonly code = 'LEDGER_UNAVAILABLE';
}

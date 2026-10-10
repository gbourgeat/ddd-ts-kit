import { DomainError } from '@ddd-ts-kit/kernel';

export class LedgerClosed extends DomainError {
  readonly code = 'LEDGER_CLOSED';
}

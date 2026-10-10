import { DomainError } from '@ddd-ts-kit/kernel';

export class InvoiceAlreadyIssued extends DomainError {
  readonly code = 'INVOICE_ALREADY_ISSUED';
}

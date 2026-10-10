import { AggregateRoot } from '@ddd-ts-kit/kernel';
import { InvoiceIssued } from './events/invoice-issued.event.js';

export interface InvoiceIssuance {
  readonly id: string;
  readonly customerId: string;
  readonly issuedBy: string;
  readonly issuedAt: Date;
}

export class Invoice extends AggregateRoot {
  private constructor(
    id: string,
    readonly customerId: string,
    readonly issuedBy: string,
    readonly issuedAt: Date,
  ) {
    super(id);
  }

  static issue({ id, customerId, issuedBy, issuedAt }: InvoiceIssuance): Invoice {
    const invoice = new Invoice(id, customerId, issuedBy, issuedAt);

    invoice.record(new InvoiceIssued(id, issuedAt, customerId));

    return invoice;
  }
}

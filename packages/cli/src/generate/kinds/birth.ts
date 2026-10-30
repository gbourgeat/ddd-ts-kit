import type { Name } from '../../naming';

/** The event an aggregate is born with, and the fact it names: `InvoiceIssued`, `Issued`. */
export interface Birth {
  readonly event: Name;
  readonly fact: Name;
}

import type { Page, PageRequest } from '@ddd-ts-kit/kernel';

export interface InvoiceSummary {
  readonly id: string;
  readonly amount: number;
  readonly status: 'draft' | 'issued';
}

/** The one field a client may sort invoices by. The identifier always breaks the ties. */
export type InvoiceSort = 'amount';

export abstract class InvoiceQueries {
  abstract search(request: PageRequest<InvoiceSort>): Promise<Page<InvoiceSummary>>;
}

import { Query } from '@ddd-ts-kit/kernel';
import { Public } from '@ddd-ts-kit/kernel/declarations';
import type { Invoice } from '../../../domain/invoice.js';

@Public()
export class GetInvoice extends Query<Invoice | undefined> {
  constructor(readonly invoiceId: string) {
    super();
  }
}

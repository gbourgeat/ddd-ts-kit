import { token } from '@ddd-ts-kit/kernel/declarations';
import type { InvoiceRepository } from '../../domain/repositories/invoice.repository.js';

export interface Mailer {
  send(to: string, subject: string): Promise<void>;
}

export interface CustomerDirectory {
  exists(customerId: string): Promise<boolean>;
}

export const INVOICES = token<InvoiceRepository>('billing.InvoiceRepository');
export const MAILER = token<Mailer>('billing.Mailer');
export const CUSTOMERS = token<CustomerDirectory>('billing.CustomerDirectory');

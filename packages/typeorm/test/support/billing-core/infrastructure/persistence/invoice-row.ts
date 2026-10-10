import type { AuditStamp, TenantScoped } from '@ddd-ts-kit/kernel';
import type { InvoiceState } from '../../domain/invoice.js';

export interface InvoiceRow extends InvoiceState, TenantScoped, AuditStamp {
  version: number;
}

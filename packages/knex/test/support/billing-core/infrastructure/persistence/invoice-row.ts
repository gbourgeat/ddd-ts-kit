import type { AuditRow, TenantRow } from '../../../../../src';
import type { InvoiceState } from '../../domain/invoice';

export interface InvoiceRow extends Omit<InvoiceState, 'details'>, TenantRow, AuditRow {
  details?: unknown;
  version: number;
}

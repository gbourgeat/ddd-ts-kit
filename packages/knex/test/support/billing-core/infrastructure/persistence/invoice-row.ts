import type { AuditRow, TenantRow } from '../../../../../src/index.js';
import type { InvoiceState } from '../../domain/invoice.js';

export interface InvoiceRow extends InvoiceState, TenantRow, AuditRow {
  version: number;
}

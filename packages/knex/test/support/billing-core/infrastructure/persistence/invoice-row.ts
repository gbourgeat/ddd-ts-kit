import type { AuditRow, TenantRow } from '../../../../../src';
import type { InvoiceState } from '../../domain/invoice';

export interface InvoiceRow extends InvoiceState, TenantRow, AuditRow {
  version: number;
}

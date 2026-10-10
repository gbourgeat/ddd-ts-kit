import { stampCreation, stampUpdate, tenantScopeOf, type Clock, type ExecutionScope } from '@ddd-ts-kit/kernel';
import {
  auditRow,
  insertIgnoringConflict,
  optimisticUpdate,
  tenantRow,
  type KnexContext,
  type TenantRow,
} from '../../../../../src/index.js';
import { Invoice, type InvoiceState } from '../../domain/invoice.js';
import type { InvoiceRepository } from '../../domain/repositories/invoice.repository.js';
import { invoicesOf } from './invoices-of.js';

type VersionedInvoice = InvoiceState & { version: number };

/**
 * The repository a consuming project would write: no transaction in sight, every statement
 * scoped to the tenant of the work in progress, audit columns stamped from its actor.
 */
export class KnexInvoiceRepository implements InvoiceRepository {
  constructor(
    private readonly context: KnexContext,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Invoice | undefined> {
    const row = await invoicesOf(this.context)
      .where({ id, ...this.ownTenant() })
      .first();

    if (row === undefined) {
      return undefined;
    }

    const invoice = Invoice.rehydrate(row);

    invoice.version = row.version;

    return invoice;
  }

  async save(invoice: Invoice): Promise<void> {
    await optimisticUpdate(invoice, async ({ expected, next }) => {
      const state = { ...invoice.state, version: next };

      return expected === 0 ? this.insert(state) : this.update(state, expected);
    });
  }

  private async insert(state: VersionedInvoice): Promise<number> {
    const row = { ...state, ...this.ownTenant(), ...auditRow(stampCreation(this.scope, this.clock)) };

    const inserted = await insertIgnoringConflict(this.context.executor(), invoicesOf(this.context), {
      row,
      conflict: 'id',
    });

    return inserted ? 1 : 0;
  }

  private update(state: VersionedInvoice, expected: number): Promise<number> {
    return invoicesOf(this.context)
      .where({ id: state.id, version: expected, ...this.ownTenant() })
      .update({ ...state, ...auditRow(stampUpdate(this.scope, this.clock)) });
  }

  private ownTenant(): TenantRow {
    return tenantRow(tenantScopeOf(this.scope));
  }
}

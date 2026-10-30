import { and, eq } from 'drizzle-orm';
import { stampCreation, stampUpdate, tenantScopeOf, type Clock, type ExecutionScope } from '@ddd-ts-kit/kernel';
import { optimisticUpdate } from '../../../../../src/postgres';
import type { Database } from '../../../platform/database/database';
import { Invoice, type InvoiceState } from '../../domain/invoice';
import type { InvoiceRepository } from '../../domain/repositories/invoice.repository';
import { invoices } from './invoices';
import { ownTenant } from './own-tenant';

/** What the aggregate says of itself, plus the version to store: the rest of the row is the adapter's. */
type VersionedInvoice = InvoiceState & { readonly version: number };

/**
 * The repository a consuming project would write: no transaction in sight, every statement
 * scoped to the tenant of the work in progress, audit columns stamped from its actor.
 */
export class DrizzleInvoiceRepository implements InvoiceRepository {
  constructor(
    private readonly database: Database,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Invoice | undefined> {
    const [row] = await this.database
      .executor()
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), ownTenant(this.scope)));

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
      const written = expected === 0 ? await this.insert(state) : await this.update(state, expected);

      return written.length;
    });
  }

  private insert(state: VersionedInvoice) {
    const row = { ...state, ...tenantScopeOf(this.scope), ...stampCreation(this.scope, this.clock) };

    // The key alone: a row that takes a value another row holds under another unique constraint is refused.
    const insertion = this.database.executor().insert(invoices).values(row);

    return insertion.onConflictDoNothing({ target: invoices.id }).returning({ id: invoices.id });
  }

  private update(state: VersionedInvoice, expected: number) {
    return this.database
      .executor()
      .update(invoices)
      .set({ ...state, ...stampUpdate(this.scope, this.clock) })
      .where(and(eq(invoices.id, state.id), eq(invoices.version, expected), ownTenant(this.scope)))
      .returning({ id: invoices.id });
  }
}

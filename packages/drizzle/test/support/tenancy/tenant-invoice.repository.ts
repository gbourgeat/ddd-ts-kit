import { and, eq } from 'drizzle-orm';
import { FixedClock, stampCreation, stampUpdate, tenantScopeOf, type ExecutionScope } from '@ddd-ts-kit/kernel';
import { optimisticUpdate, ownTenantCondition, primaryKeyOf, tenantCondition } from '../../../src/postgres';
import type { Database } from '../platform/database/database';
import { Invoice, type InvoiceState } from '../billing-core/domain/invoice';
import type { InvoiceRepository } from '../billing-core/domain/repositories/invoice.repository';
import { invoices } from '../billing-core/infrastructure/persistence/invoices';

type VersionedInvoice = InvoiceState & { readonly version: number };

const clock = new FixedClock(new Date('2026-03-01T10:00:00.000Z'));

/**
 * The repository of a project on shared tables: reads through `tenantCondition`, writes through
 * `ownTenantCondition`. Built `unfiltered`, it writes no tenant condition, as a statement that
 * forgot it: under row-level security the policies alone confine it.
 */
export class TenantInvoiceRepository implements InvoiceRepository {
  constructor(
    private readonly database: Database,
    private readonly scope: ExecutionScope,
    private readonly unfiltered = false,
  ) {}

  async findById(id: string): Promise<Invoice | undefined> {
    const [row] = await this.database
      .executor()
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), this.unfiltered ? undefined : tenantCondition(invoices.tenantId, this.scope)));

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
    const row = { ...state, ...tenantScopeOf(this.scope), ...stampCreation(this.scope, clock) };

    return this.database
      .executor()
      .insert(invoices)
      .values(row)
      .onConflictDoNothing({ target: primaryKeyOf(invoices) })
      .returning({ id: invoices.id });
  }

  private update(state: VersionedInvoice, expected: number) {
    return this.database
      .executor()
      .update(invoices)
      .set({ ...state, ...stampUpdate(this.scope, clock) })
      .where(
        and(
          eq(invoices.id, state.id),
          eq(invoices.version, expected),
          this.unfiltered ? undefined : ownTenantCondition(invoices.tenantId, this.scope),
        ),
      )
      .returning({ id: invoices.id });
  }
}

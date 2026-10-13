import { FixedClock, stampCreation, stampUpdate, tenantScopeOf, type ExecutionScope } from '@ddd-ts-kit/kernel';
import { auditRow, insertIgnoringConflict, optimisticUpdate, tenantRow, type KnexContext } from '../../../src/index.js';
import { Invoice, type InvoiceState } from '../billing-core/domain/invoice.js';
import type { InvoiceRepository } from '../billing-core/domain/repositories/invoice.repository.js';
import type { InvoiceTables } from './invoice-tables.js';

export interface StrategyRepositoryParts {
  readonly context: KnexContext;
  readonly scope: ExecutionScope;
  readonly tables: InvoiceTables;
}

const clock = new FixedClock(new Date('2026-03-01T10:00:00.000Z'));

/** The repository a project writes under a strategy of tenant isolation: it names the tenant on insert, and reaches its rows through the strategy. */
export class StrategyInvoiceRepository implements InvoiceRepository {
  constructor(private readonly parts: StrategyRepositoryParts) {}

  async findById(id: string): Promise<Invoice | undefined> {
    const { context, scope, tables } = this.parts;
    const row = await tables.read(context, scope).where({ id }).first();

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

  private async insert(state: InvoiceState & { version: number }): Promise<number> {
    const { context, scope, tables } = this.parts;
    const row = { ...state, ...tenantRow(tenantScopeOf(scope)), ...auditRow(stampCreation(scope, clock)) };

    return (await insertIgnoringConflict(context.executor(), tables.write(context, scope), { row, conflict: 'id' }))
      ? 1
      : 0;
  }

  private update(state: InvoiceState & { version: number }, expected: number): Promise<number> {
    const { context, scope, tables } = this.parts;

    return tables
      .write(context, scope)
      .where({ id: state.id, version: expected })
      .update({ ...state, ...auditRow(stampUpdate(scope, clock)) });
  }
}

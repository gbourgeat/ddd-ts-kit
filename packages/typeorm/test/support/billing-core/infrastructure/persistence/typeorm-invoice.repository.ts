import { stampCreation, stampUpdate, tenantScopeOf, type Clock, type ExecutionScope } from '@ddd-ts-kit/kernel';
import { insertIgnoringConflict, optimisticUpdate, type TypeOrmContext } from '../../../../../src/index.js';
import { Invoice, type InvoiceState } from '../../domain/invoice.js';
import type { InvoiceRepository } from '../../domain/repositories/invoice.repository.js';
import { invoices } from './invoices.js';

type VersionedInvoice = InvoiceState & { version: number };

/**
 * The repository a consuming project would write: no transaction in sight, every statement
 * scoped to the tenant of the work in progress, audit columns stamped from its actor.
 */
export class TypeOrmInvoiceRepository implements InvoiceRepository {
  constructor(
    private readonly context: TypeOrmContext,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Invoice | undefined> {
    const row = await this.context.manager().findOneBy(invoices, { id, ...tenantScopeOf(this.scope) });

    if (row === null) {
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
    const row = { ...state, ...tenantScopeOf(this.scope), ...stampCreation(this.scope, this.clock) };

    return (await insertIgnoringConflict(this.context.manager(), invoices, row)) ? 1 : 0;
  }

  private async update(state: VersionedInvoice, expected: number): Promise<number> {
    const guarded = { id: state.id, version: expected, ...tenantScopeOf(this.scope) };
    const row = { ...state, ...stampUpdate(this.scope, this.clock) };

    return (await this.context.manager().update(invoices, guarded, row)).affected ?? 0;
  }
}

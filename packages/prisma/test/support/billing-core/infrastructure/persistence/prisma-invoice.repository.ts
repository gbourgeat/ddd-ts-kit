import { stampCreation, stampUpdate, tenantScopeOf, type Clock, type ExecutionScope } from '@ddd-ts-kit/kernel';
import { optimisticUpdate, ownTenantWhere, tenantWhere } from '../../../../../src';
import type { Prisma } from '../../../../generated/client/client';
import type { Database } from '../../../platform/database/database';
import { Invoice, type InvoiceState } from '../../domain/invoice';
import type { InvoiceRepository } from '../../domain/repositories/invoice.repository';
import { statusOf } from './status-of';

type VersionedInvoice = InvoiceState & { version: number };

/**
 * The repository a consuming project would write: no transaction in sight, every statement
 * confined to the tenant of the work in progress through the helpers (`tenantWhere` to read,
 * `ownTenantWhere` to update, `tenantScopeOf` on the inserted row), audit columns stamped from
 * its actor.
 */
export class PrismaInvoiceRepository implements InvoiceRepository {
  constructor(
    private readonly database: Database,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Invoice | undefined> {
    // findFirst, not findUnique: the tenant is part of every condition, and it is not part of the key.
    const row = await this.database.client().invoice.findFirst({ where: { id, ...tenantWhere(this.scope) } });

    if (row === null) {
      return undefined;
    }

    const invoice = Invoice.rehydrate({ ...row, status: statusOf(row.status) });

    invoice.version = row.version;

    return invoice;
  }

  async save(invoice: Invoice): Promise<void> {
    await optimisticUpdate(invoice, async ({ expected, next }) => {
      const state = { ...invoice.state, version: next };
      const written = expected === 0 ? await this.insert(state) : await this.update(state, expected);

      return written.count;
    });
  }

  private insert(state: VersionedInvoice): Promise<Prisma.BatchPayload> {
    const row = { ...state, ...tenantScopeOf(this.scope), ...stampCreation(this.scope, this.clock) };

    return this.database.client().invoice.createMany({ data: [row], skipDuplicates: true });
  }

  private update(state: VersionedInvoice, expected: number): Promise<Prisma.BatchPayload> {
    return this.database.client().invoice.updateMany({
      where: { id: state.id, version: expected, ...ownTenantWhere(this.scope) },
      data: { ...state, ...stampUpdate(this.scope, this.clock) },
    });
  }
}

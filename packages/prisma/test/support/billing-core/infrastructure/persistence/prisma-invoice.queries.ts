import {
  encodeCursor,
  pageOf,
  tenantScopeOf,
  type CursorPageRequest,
  type ExecutionScope,
  type OffsetPageRequest,
  type Page,
  type PageRequest,
  type SortDirection,
  type TenantScoped,
} from '@ddd-ts-kit/kernel';
import type { Prisma } from '../../../../generated/client/client';
import type { Database } from '../../../platform/database/database';
import type { InvoiceQueries, InvoiceSort, InvoiceSummary } from '../../application/ports/invoice-queries.port';
import { directionOf } from './direction-of';
import { positionOf, type InvoicePosition } from './position-of';
import { statusOf } from './status-of';

/**
 * The list query of a read port, in both variants of `PageRequest`. The order is total: the
 * primary key follows the sort field, in the same direction. Without it, rows of equal amount
 * have no defined order, and a page could repeat or skip one of them.
 */
export class PrismaInvoiceQueries implements InvoiceQueries {
  constructor(
    private readonly database: Database,
    private readonly scope: ExecutionScope,
  ) {}

  async search(request: PageRequest<InvoiceSort>): Promise<Page<InvoiceSummary>> {
    return request.kind === 'offset' ? this.byOffset(request) : this.byCursor(request);
  }

  private async byOffset(request: OffsetPageRequest<InvoiceSort>): Promise<Page<InvoiceSummary>> {
    const { invoice } = this.database.client();
    const where = tenantScopeOf(this.scope);

    const rows = await invoice.findMany({
      where,
      orderBy: totalOrder(directionOf(request)),
      take: request.limit,
      skip: request.offset,
    });

    return pageOf(rows.map(toSummary), { total: await invoice.count({ where }) });
  }

  /** One row more than asked tells whether a page follows, without counting. */
  private async byCursor(request: CursorPageRequest<InvoiceSort>): Promise<Page<InvoiceSummary>> {
    const direction = directionOf(request);
    const tenant = tenantScopeOf(this.scope);

    const rows = await this.database.client().invoice.findMany({
      where: request.cursor === undefined ? tenant : beyond(positionOf(request.cursor), direction, tenant),
      orderBy: totalOrder(direction),
      take: request.limit + 1,
    });

    const items = rows.slice(0, request.limit);
    const last = items.at(-1);
    const more = rows.length > request.limit && last !== undefined;

    return pageOf(items.map(toSummary), more ? { nextCursor: encodeCursor({ amount: last.amount, id: last.id }) } : {});
  }
}

function totalOrder(direction: SortDirection): Prisma.InvoiceOrderByWithRelationInput[] {
  return [{ amount: direction }, { id: direction }];
}

/** The rows after a position, as a tuple comparison: the tie-breaker decides among equals. */
function beyond(
  { amount, id }: InvoicePosition,
  direction: SortDirection,
  tenant: TenantScoped,
): Prisma.InvoiceWhereInput {
  const past = direction === 'asc' ? 'gt' : 'lt';

  return { ...tenant, OR: [{ amount: { [past]: amount } }, { amount, id: { [past]: id } }] };
}

function toSummary(row: { id: string; amount: number; status: string }): InvoiceSummary {
  return { id: row.id, amount: row.amount, status: statusOf(row.status) };
}

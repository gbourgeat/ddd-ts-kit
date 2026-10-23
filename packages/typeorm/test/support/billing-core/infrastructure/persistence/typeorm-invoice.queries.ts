import { LessThan, MoreThan, type FindOptionsWhere } from 'typeorm';
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
import type { TypeOrmContext } from '../../../../../src';
import type { InvoiceQueries, InvoiceSort, InvoiceSummary } from '../../application/ports/invoice-queries.port';
import { directionOf } from './direction-of';
import type { InvoiceRow } from './invoice-row';
import { invoices } from './invoices';
import { positionOf, type InvoicePosition } from './position-of';

/**
 * The list query of a read port, in both variants of `PageRequest`. The order is total: the
 * primary key follows the sort field, in the same direction. Without it, rows of equal amount
 * have no defined order, and a page could repeat or skip one of them.
 */
export class TypeOrmInvoiceQueries implements InvoiceQueries {
  constructor(
    private readonly context: TypeOrmContext,
    private readonly scope: ExecutionScope,
  ) {}

  async search(request: PageRequest<InvoiceSort>): Promise<Page<InvoiceSummary>> {
    return request.kind === 'offset' ? this.byOffset(request) : this.byCursor(request);
  }

  private async byOffset(request: OffsetPageRequest<InvoiceSort>): Promise<Page<InvoiceSummary>> {
    const [rows, total] = await this.context.manager().findAndCount(invoices, {
      where: tenantScopeOf(this.scope),
      order: totalOrder(directionOf(request)),
      take: request.limit,
      skip: request.offset,
    });

    return pageOf(rows.map(toSummary), { total });
  }

  /** One row more than asked tells whether a page follows, without counting. */
  private async byCursor(request: CursorPageRequest<InvoiceSort>): Promise<Page<InvoiceSummary>> {
    const direction = directionOf(request);
    const tenant = tenantScopeOf(this.scope);

    const rows = await this.context.manager().find(invoices, {
      where: request.cursor === undefined ? tenant : beyond(positionOf(request.cursor), direction, tenant),
      order: totalOrder(direction),
      take: request.limit + 1,
    });

    const items = rows.slice(0, request.limit);
    const last = items.at(-1);
    const more = rows.length > request.limit && last !== undefined;

    return pageOf(items.map(toSummary), more ? { nextCursor: encodeCursor({ amount: last.amount, id: last.id }) } : {});
  }
}

function totalOrder(direction: SortDirection): { amount: SortDirection; id: SortDirection } {
  return { amount: direction, id: direction };
}

/**
 * The rows after a position, as a tuple comparison: the tie-breaker decides among equals. A
 * list of conditions is an OR in TypeORM, so each alternative restates the tenant.
 */
function beyond(
  { amount, id }: InvoicePosition,
  direction: SortDirection,
  tenant: TenantScoped,
): FindOptionsWhere<InvoiceRow>[] {
  const past = direction === 'asc' ? MoreThan : LessThan;

  return [
    { ...tenant, amount: past(amount) },
    { ...tenant, amount, id: past(id) },
  ];
}

function toSummary(row: InvoiceRow): InvoiceSummary {
  return { id: row.id, amount: row.amount, status: row.status };
}

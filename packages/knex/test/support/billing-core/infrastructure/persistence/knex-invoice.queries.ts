import type { Knex } from 'knex';
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
} from '@ddd-ts-kit/kernel';
import { tenantRow, type KnexContext } from '../../../../../src';
import type { InvoiceQueries, InvoiceSort, InvoiceSummary } from '../../application/ports/invoice-queries.port';
import { directionOf } from './direction-of';
import type { InvoiceRow } from './invoice-row';
import { invoicesOf } from './invoices-of';
import { positionOf, type InvoicePosition } from './position-of';

/**
 * The list query of a read port, in both variants of `PageRequest`. The order is total: the
 * primary key follows the sort field, in the same direction. Without it, rows of equal amount
 * have no defined order, and a page could repeat or skip one of them.
 */
export class KnexInvoiceQueries implements InvoiceQueries {
  constructor(
    private readonly context: KnexContext,
    private readonly scope: ExecutionScope,
  ) {}

  async search(request: PageRequest<InvoiceSort>): Promise<Page<InvoiceSummary>> {
    return request.kind === 'offset' ? this.byOffset(request) : this.byCursor(request);
  }

  private async byOffset(request: OffsetPageRequest<InvoiceSort>): Promise<Page<InvoiceSummary>> {
    const rows = await this.ownInvoices()
      .orderBy(totalOrder(directionOf(request)))
      .limit(request.limit)
      .offset(request.offset);

    const counted = await this.ownInvoices().count<{ total: string | number }[]>({ total: '*' }).first();

    return pageOf(rows.map(toSummary), { total: Number(counted?.total ?? 0) });
  }

  /** One row more than asked tells whether a page follows, without counting. */
  private async byCursor(request: CursorPageRequest<InvoiceSort>): Promise<Page<InvoiceSummary>> {
    const direction = directionOf(request);

    const query = this.ownInvoices()
      .orderBy(totalOrder(direction))
      .limit(request.limit + 1);

    const rows = await (request.cursor === undefined ? query : beyond(query, positionOf(request.cursor), direction));
    const items = rows.slice(0, request.limit);
    const last = items.at(-1);
    const more = rows.length > request.limit && last !== undefined;

    return pageOf(items.map(toSummary), more ? { nextCursor: encodeCursor({ amount: last.amount, id: last.id }) } : {});
  }

  private ownInvoices(): Knex.QueryBuilder<InvoiceRow, InvoiceRow[]> {
    return invoicesOf(this.context).where(tenantRow(tenantScopeOf(this.scope)));
  }
}

function totalOrder(direction: SortDirection): { column: string; order: SortDirection }[] {
  return [
    { column: 'amount', order: direction },
    { column: 'id', order: direction },
  ];
}

/** The rows after a position, as a tuple comparison: the tie-breaker decides among equals. */
function beyond(
  query: Knex.QueryBuilder<InvoiceRow, InvoiceRow[]>,
  { amount, id }: InvoicePosition,
  direction: SortDirection,
): Knex.QueryBuilder<InvoiceRow, InvoiceRow[]> {
  const past = direction === 'asc' ? '>' : '<';

  return query.where((after) => {
    void after.where('amount', past, amount).orWhere((tied) => {
      void tied.where('amount', amount).where('id', past, id);
    });
  });
}

function toSummary(row: InvoiceRow): InvoiceSummary {
  return { id: row.id, amount: row.amount, status: row.status };
}

import { and, asc, desc, eq, gt, lt, or, type SQL } from 'drizzle-orm';
import {
  encodeCursor,
  pageOf,
  type CursorPageRequest,
  type ExecutionScope,
  type OffsetPageRequest,
  type Page,
  type PageRequest,
  type SortDirection,
} from '@ddd-ts-kit/kernel';
import type { Database } from '../../../platform/database/database.js';
import type { InvoiceQueries, InvoiceSort, InvoiceSummary } from '../../application/ports/invoice-queries.port.js';
import { directionOf } from './direction-of.js';
import { invoices } from './invoices.js';
import { ownTenant } from './own-tenant.js';
import { positionOf, type InvoicePosition } from './position-of.js';

/**
 * The list query of a read port, in both variants of `PageRequest`. The order is total: the
 * primary key follows the sort field, in the same direction. Without it, rows of equal amount
 * have no defined order, and a page could repeat or skip one of them.
 */
export class DrizzleInvoiceQueries implements InvoiceQueries {
  constructor(
    private readonly database: Database,
    private readonly scope: ExecutionScope,
  ) {}

  search(request: PageRequest<InvoiceSort>): Promise<Page<InvoiceSummary>> {
    return request.kind === 'offset' ? this.byOffset(request) : this.byCursor(request);
  }

  private async byOffset(request: OffsetPageRequest<InvoiceSort>): Promise<Page<InvoiceSummary>> {
    const db = this.database.executor();

    const rows = await db
      .select()
      .from(invoices)
      .where(ownTenant(this.scope))
      .orderBy(...totalOrder(directionOf(request)))
      .limit(request.limit)
      .offset(request.offset);

    return pageOf(rows.map(toSummary), { total: await db.$count(invoices, ownTenant(this.scope)) });
  }

  /** One row more than asked tells whether a page follows, without counting. */
  private async byCursor(request: CursorPageRequest<InvoiceSort>): Promise<Page<InvoiceSummary>> {
    const direction = directionOf(request);
    const after = request.cursor === undefined ? undefined : beyond(positionOf(request.cursor), direction);

    const rows = await this.database
      .executor()
      .select()
      .from(invoices)
      .where(and(ownTenant(this.scope), after))
      .orderBy(...totalOrder(direction))
      .limit(request.limit + 1);

    const items = rows.slice(0, request.limit);
    const last = items.at(-1);
    const more = rows.length > request.limit && last !== undefined;

    return pageOf(items.map(toSummary), more ? { nextCursor: encodeCursor({ amount: last.amount, id: last.id }) } : {});
  }
}

function totalOrder(direction: SortDirection): SQL[] {
  const toward = direction === 'asc' ? asc : desc;

  return [toward(invoices.amount), toward(invoices.id)];
}

/** The rows after a position, as a tuple comparison: the tie-breaker decides among equals. */
function beyond({ amount, id }: InvoicePosition, direction: SortDirection): SQL | undefined {
  const past = direction === 'asc' ? gt : lt;

  return or(past(invoices.amount, amount), and(eq(invoices.amount, amount), past(invoices.id, id)));
}

function toSummary(row: typeof invoices.$inferSelect): InvoiceSummary {
  return { id: row.id, amount: row.amount, status: row.status };
}

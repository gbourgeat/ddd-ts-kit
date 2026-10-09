import { and, asc, desc, eq, gt, lt, or, type SQL } from 'drizzle-orm';
import { index, integer, text } from 'drizzle-orm/pg-core';
import type { PgliteQueryResultHKT } from 'drizzle-orm/pglite';
import {
  AggregateRoot,
  DomainError,
  InvalidPageRequestError,
  decodeCursor,
  encodeCursor,
  pageOf,
  stampCreation,
  stampUpdate,
  tenantScopeOf,
  type Clock,
  type CursorPageRequest,
  type ExecutionScope,
  type OffsetPageRequest,
  type Page,
  type PageRequest,
  type Repository,
  type SortDirection,
} from '@ddd-ts-kit/kernel';
import {
  auditColumns,
  contextSchema,
  optimisticUpdate,
  tenantColumn,
  type DrizzleContext,
} from '../../src/postgres.js';

export class InvoiceAlreadyIssued extends DomainError {
  readonly code = 'INVOICE_ALREADY_ISSUED';
}

export class Invoice extends AggregateRoot {
  #amount: number;
  #status: 'draft' | 'issued';

  private constructor(id: string, amount: number, status: 'draft' | 'issued') {
    super(id);
    this.#amount = amount;
    this.#status = status;
  }

  static draft(id: string, amount: number): Invoice {
    return new Invoice(id, amount, 'draft');
  }

  static rehydrate(state: { id: string; amount: number; status: 'draft' | 'issued' }): Invoice {
    return new Invoice(state.id, state.amount, state.status);
  }

  addCharge(amount: number): void {
    if (this.#status === 'issued') {
      throw new InvoiceAlreadyIssued(`Invoice ${this.id} is already issued`);
    }
    this.#amount += amount;
  }

  issue(): void {
    this.#status = 'issued';
  }

  get state(): { id: string; amount: number; status: 'draft' | 'issued' } {
    return { id: this.id, amount: this.#amount, status: this.#status };
  }
}

/** One schema per bounded context: `billing-core` owns `billing_core.invoices`. */
export const billing = contextSchema('billing-core');

export const invoices = billing.table(
  'invoices',
  {
    id: text('id').primaryKey(),
    amount: integer('amount').notNull(),
    status: text('status').$type<'draft' | 'issued'>().notNull(),
    version: integer('version').notNull(),
    ...tenantColumn(),
    ...auditColumns(),
  },
  // The order of the list below, tie-breaker included, so a page is read from the index.
  (table) => [index('invoices_tenant_amount_idx').on(table.tenantId, table.amount, table.id)],
);

type Database = DrizzleContext<PgliteQueryResultHKT>;

/** What the aggregate says of itself, plus the version to store: the rest of the row is the adapter's. */
type VersionedInvoice = Invoice['state'] & { readonly version: number };

/**
 * The repository a consuming project would write: no transaction in sight, every statement
 * scoped to the tenant of the work in progress, audit columns stamped from its actor.
 */
export class DrizzleInvoiceRepository implements Repository<Invoice> {
  constructor(
    private readonly context: Database,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Invoice | undefined> {
    const [row] = await this.context
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
      const written = expected === 0 ? await this.#insert(state) : await this.#update(state, expected);
      return written.length;
    });
  }

  #insert(state: VersionedInvoice) {
    const row = { ...state, ...tenantScopeOf(this.scope), ...stampCreation(this.scope, this.clock) };
    return this.context.executor().insert(invoices).values(row).onConflictDoNothing().returning({ id: invoices.id });
  }

  #update(state: VersionedInvoice, expected: number) {
    return this.context
      .executor()
      .update(invoices)
      .set({ ...state, ...stampUpdate(this.scope, this.clock) })
      .where(and(eq(invoices.id, state.id), eq(invoices.version, expected), ownTenant(this.scope)))
      .returning({ id: invoices.id });
  }
}

function ownTenant(scope: ExecutionScope): SQL {
  return eq(invoices.tenantId, tenantScopeOf(scope).tenantId);
}

export interface InvoiceSummary {
  readonly id: string;
  readonly amount: number;
  readonly status: 'draft' | 'issued';
}

/** The one field a client may sort invoices by. The identifier always breaks the ties. */
export type InvoiceSort = 'amount';

/**
 * The list query of a read port, in both variants of `PageRequest`. The order is total: the
 * primary key follows the sort field, in the same direction. Without it, rows of equal amount
 * have no defined order, and a page could repeat or skip one of them.
 */
export class DrizzleInvoiceQueries {
  constructor(
    private readonly context: Database,
    private readonly scope: ExecutionScope,
  ) {}

  list(request: PageRequest<InvoiceSort>): Promise<Page<InvoiceSummary>> {
    return request.kind === 'offset' ? this.#byOffset(request) : this.#byCursor(request);
  }

  async #byOffset(request: OffsetPageRequest<InvoiceSort>): Promise<Page<InvoiceSummary>> {
    const db = this.context.executor();
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
  async #byCursor(request: CursorPageRequest<InvoiceSort>): Promise<Page<InvoiceSummary>> {
    const direction = directionOf(request);
    const after = request.cursor === undefined ? undefined : beyond(positionOf(request.cursor), direction);
    const rows = await this.context
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

interface InvoicePosition {
  readonly amount: number;
  readonly id: string;
}

function directionOf(request: PageRequest<InvoiceSort>): SortDirection {
  return request.sort[0]?.direction ?? 'asc';
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

/** A cursor comes back from a client: what it decodes to is checked before it reaches a statement. */
function positionOf(cursor: string): InvoicePosition {
  const { amount, id } = decodeCursor(cursor);
  if (typeof amount !== 'number' || typeof id !== 'string') {
    throw new InvalidPageRequestError('The cursor of a page is the nextCursor of a previous page');
  }
  return { amount, id };
}

function toSummary(row: typeof invoices.$inferSelect): InvoiceSummary {
  return { id: row.id, amount: row.amount, status: row.status };
}

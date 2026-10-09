import type { Knex } from 'knex';
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
  auditRow,
  insertIgnoringConflict,
  optimisticUpdate,
  schemaNameOf,
  tenantColumn,
  tenantRow,
  type AuditRow,
  type KnexContext,
  type TenantRow,
} from '../../src/index.js';

export class InvoiceAlreadyIssued extends DomainError {
  readonly code = 'INVOICE_ALREADY_ISSUED';
}

interface InvoiceState {
  id: string;
  amount: number;
  status: 'draft' | 'issued';
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

  static rehydrate(state: InvoiceState): Invoice {
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

  get state(): InvoiceState {
    return { id: this.id, amount: this.#amount, status: this.#status };
  }
}

/** One schema per bounded context: `billing-core` owns `billing_core.invoices`. */
export const BILLING = schemaNameOf('billing-core');

/** What the migration of the context would contain. */
export async function createInvoicesTable(knex: Knex): Promise<void> {
  await knex.schema.createSchemaIfNotExists(BILLING);
  await knex.schema.withSchema(BILLING).createTable('invoices', (table) => {
    table.text('id').primary();
    table.integer('amount').notNullable();
    table.text('status').notNullable();
    table.integer('version').notNullable();
    tenantColumn(table);
    auditColumns(table);
    // The order of the list below, tie-breaker included, so a page is read from the index.
    table.index(['tenant_id', 'amount', 'id'], 'invoices_tenant_amount_idx');
  });
}

interface VersionedInvoice extends InvoiceState {
  version: number;
}

export interface InvoiceRow extends VersionedInvoice, TenantRow, AuditRow {}

function invoicesOf(context: KnexContext): Knex.QueryBuilder<InvoiceRow, InvoiceRow[]> {
  return context.executor()<InvoiceRow, InvoiceRow[]>('invoices').withSchema(BILLING);
}

/**
 * The repository a consuming project would write: no transaction in sight, every statement
 * scoped to the tenant of the work in progress, audit columns stamped from its actor.
 */
export class KnexInvoiceRepository implements Repository<Invoice> {
  constructor(
    private readonly context: KnexContext,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Invoice | undefined> {
    const row = await invoicesOf(this.context).where({ id, ...this.#ownTenant() }).first();
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
      return expected === 0 ? this.#insert(state) : this.#update(state, expected);
    });
  }

  async #insert(state: VersionedInvoice): Promise<number> {
    const row = { ...state, ...this.#ownTenant(), ...auditRow(stampCreation(this.scope, this.clock)) };
    const inserted = await insertIgnoringConflict(this.context.executor(), invoicesOf(this.context), {
      row,
      conflict: 'id',
    });
    return inserted ? 1 : 0;
  }

  #update(state: VersionedInvoice, expected: number): Promise<number> {
    return invoicesOf(this.context)
      .where({ id: state.id, version: expected, ...this.#ownTenant() })
      .update({ ...state, ...auditRow(stampUpdate(this.scope, this.clock)) });
  }

  #ownTenant(): TenantRow {
    return tenantRow(tenantScopeOf(this.scope));
  }
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
export class KnexInvoiceQueries {
  constructor(
    private readonly context: KnexContext,
    private readonly scope: ExecutionScope,
  ) {}

  async list(request: PageRequest<InvoiceSort>): Promise<Page<InvoiceSummary>> {
    return request.kind === 'offset' ? this.#byOffset(request) : this.#byCursor(request);
  }

  async #byOffset(request: OffsetPageRequest<InvoiceSort>): Promise<Page<InvoiceSummary>> {
    const rows = await this.#ownInvoices()
      .orderBy(totalOrder(directionOf(request)))
      .limit(request.limit)
      .offset(request.offset);
    const counted = await this.#ownInvoices().count<{ total: string | number }[]>({ total: '*' }).first();
    return pageOf(rows.map(toSummary), { total: Number(counted?.total ?? 0) });
  }

  /** One row more than asked tells whether a page follows, without counting. */
  async #byCursor(request: CursorPageRequest<InvoiceSort>): Promise<Page<InvoiceSummary>> {
    const direction = directionOf(request);
    const query = this.#ownInvoices().orderBy(totalOrder(direction)).limit(request.limit + 1);
    const rows = await (request.cursor === undefined ? query : beyond(query, positionOf(request.cursor), direction));
    const items = rows.slice(0, request.limit);
    const last = items.at(-1);
    const more = rows.length > request.limit && last !== undefined;
    return pageOf(items.map(toSummary), more ? { nextCursor: encodeCursor({ amount: last.amount, id: last.id }) } : {});
  }

  #ownInvoices(): Knex.QueryBuilder<InvoiceRow, InvoiceRow[]> {
    return invoicesOf(this.context).where(tenantRow(tenantScopeOf(this.scope)));
  }
}

interface InvoicePosition {
  readonly amount: number;
  readonly id: string;
}

function directionOf(request: PageRequest<InvoiceSort>): SortDirection {
  return request.sort[0]?.direction ?? 'asc';
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

/** A cursor comes back from a client: what it decodes to is checked before it reaches a statement. */
function positionOf(cursor: string): InvoicePosition {
  const { amount, id } = decodeCursor(cursor);
  if (typeof amount !== 'number' || typeof id !== 'string') {
    throw new InvalidPageRequestError('The cursor of a page is the nextCursor of a previous page');
  }
  return { amount, id };
}

function toSummary(row: InvoiceRow): InvoiceSummary {
  return { id: row.id, amount: row.amount, status: row.status };
}

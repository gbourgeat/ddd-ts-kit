import { EntitySchema, LessThan, MoreThan, type FindOptionsWhere } from 'typeorm';
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
  type AuditStamp,
  type Clock,
  type CursorPageRequest,
  type ExecutionScope,
  type OffsetPageRequest,
  type Page,
  type PageRequest,
  type Repository,
  type SortDirection,
  type TenantScoped,
} from '@ddd-ts-kit/kernel';
import {
  auditColumns,
  insertIgnoringConflict,
  optimisticUpdate,
  schemaNameOf,
  tenantColumn,
  type TypeOrmContext,
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

interface VersionedInvoice extends InvoiceState {
  version: number;
}

export interface InvoiceRow extends VersionedInvoice, TenantScoped, AuditStamp {}

/** One schema per bounded context: `billing-core` owns `billing_core.invoices`. */
export const invoices = new EntitySchema<InvoiceRow>({
  name: 'Invoice',
  tableName: 'invoices',
  schema: schemaNameOf('billing-core'),
  columns: {
    id: { type: 'text', primary: true },
    amount: { type: 'int' },
    status: { type: 'text' },
    version: { type: 'int' },
    ...tenantColumn(),
    ...auditColumns(),
  },
  // The order of the list below, tie-breaker included, so a page is read from the index.
  indices: [{ name: 'invoices_tenant_amount_idx', columns: ['tenantId', 'amount', 'id'] }],
});

/**
 * The repository a consuming project would write: no transaction in sight, every statement
 * scoped to the tenant of the work in progress, audit columns stamped from its actor.
 */
export class TypeOrmInvoiceRepository implements Repository<Invoice> {
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
      return expected === 0 ? this.#insert(state) : this.#update(state, expected);
    });
  }

  async #insert(state: VersionedInvoice): Promise<number> {
    const row = { ...state, ...tenantScopeOf(this.scope), ...stampCreation(this.scope, this.clock) };
    return (await insertIgnoringConflict(this.context.manager(), invoices, row)) ? 1 : 0;
  }

  async #update(state: VersionedInvoice, expected: number): Promise<number> {
    const guarded = { id: state.id, version: expected, ...tenantScopeOf(this.scope) };
    const row = { ...state, ...stampUpdate(this.scope, this.clock) };
    return (await this.context.manager().update(invoices, guarded, row)).affected ?? 0;
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
export class TypeOrmInvoiceQueries {
  constructor(
    private readonly context: TypeOrmContext,
    private readonly scope: ExecutionScope,
  ) {}

  async list(request: PageRequest<InvoiceSort>): Promise<Page<InvoiceSummary>> {
    return request.kind === 'offset' ? this.#byOffset(request) : this.#byCursor(request);
  }

  async #byOffset(request: OffsetPageRequest<InvoiceSort>): Promise<Page<InvoiceSummary>> {
    const [rows, total] = await this.context.manager().findAndCount(invoices, {
      where: tenantScopeOf(this.scope),
      order: totalOrder(directionOf(request)),
      take: request.limit,
      skip: request.offset,
    });
    return pageOf(rows.map(toSummary), { total });
  }

  /** One row more than asked tells whether a page follows, without counting. */
  async #byCursor(request: CursorPageRequest<InvoiceSort>): Promise<Page<InvoiceSummary>> {
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

interface InvoicePosition {
  readonly amount: number;
  readonly id: string;
}

function directionOf(request: PageRequest<InvoiceSort>): SortDirection {
  return request.sort[0]?.direction ?? 'asc';
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

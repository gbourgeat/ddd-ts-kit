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
  type TenantScoped,
} from '@ddd-ts-kit/kernel';
import { optimisticUpdate, type PrismaContext } from '../../src/index.js';
import type { Prisma } from '../generated/client/client.js';

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

type Database = PrismaContext<Prisma.TransactionClient>;

interface VersionedInvoice extends InvoiceState {
  version: number;
}

/**
 * The repository a consuming project would write: no transaction in sight, every statement
 * scoped to the tenant of the work in progress, audit columns stamped from its actor.
 */
export class PrismaInvoiceRepository implements Repository<Invoice> {
  constructor(
    private readonly context: Database,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Invoice | undefined> {
    // findFirst, not findUnique: the tenant is part of every condition, and it is not part of the key.
    const row = await this.context.client().invoice.findFirst({ where: { id, ...tenantScopeOf(this.scope) } });
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
      const written = expected === 0 ? await this.#insert(state) : await this.#update(state, expected);
      return written.count;
    });
  }

  #insert(state: VersionedInvoice): Promise<Prisma.BatchPayload> {
    const row = { ...state, ...tenantScopeOf(this.scope), ...stampCreation(this.scope, this.clock) };
    return this.context.client().invoice.createMany({ data: [row], skipDuplicates: true });
  }

  #update(state: VersionedInvoice, expected: number): Promise<Prisma.BatchPayload> {
    return this.context.client().invoice.updateMany({
      where: { id: state.id, version: expected, ...tenantScopeOf(this.scope) },
      data: { ...state, ...stampUpdate(this.scope, this.clock) },
    });
  }
}

function statusOf(stored: string): 'draft' | 'issued' {
  return stored === 'issued' ? 'issued' : 'draft';
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
export class PrismaInvoiceQueries {
  constructor(
    private readonly context: Database,
    private readonly scope: ExecutionScope,
  ) {}

  async list(request: PageRequest<InvoiceSort>): Promise<Page<InvoiceSummary>> {
    return request.kind === 'offset' ? this.#byOffset(request) : this.#byCursor(request);
  }

  async #byOffset(request: OffsetPageRequest<InvoiceSort>): Promise<Page<InvoiceSummary>> {
    const { invoice } = this.context.client();
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
  async #byCursor(request: CursorPageRequest<InvoiceSort>): Promise<Page<InvoiceSummary>> {
    const direction = directionOf(request);
    const tenant = tenantScopeOf(this.scope);
    const rows = await this.context.client().invoice.findMany({
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

interface InvoicePosition {
  readonly amount: number;
  readonly id: string;
}

function directionOf(request: PageRequest<InvoiceSort>): SortDirection {
  return request.sort[0]?.direction ?? 'asc';
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

/** A cursor comes back from a client: what it decodes to is checked before it reaches a statement. */
function positionOf(cursor: string): InvoicePosition {
  const { amount, id } = decodeCursor(cursor);
  if (typeof amount !== 'number' || typeof id !== 'string') {
    throw new InvalidPageRequestError('The cursor of a page is the nextCursor of a previous page');
  }
  return { amount, id };
}

function toSummary(row: { id: string; amount: number; status: string }): InvoiceSummary {
  return { id: row.id, amount: row.amount, status: statusOf(row.status) };
}

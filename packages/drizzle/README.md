# @ddd-ts-kit/drizzle

Drizzle adapters of the kernel and events ports on PostgreSQL: a unit of work that
repositories never see, the transactional outbox store, the processed-event store, and one
database schema per bounded context. Drizzle is the default persistence of the kit, not a
requirement: everything here implements ports, and another ORM is another adapter passing the
same contract suites.

```
npm i @ddd-ts-kit/drizzle drizzle-orm
```

Works with every drizzle PostgreSQL driver (node-postgres, postgres-js, PGlite, Neon): the
functions are generic over the database type, so `executor()` is typed exactly like your `db`.

## Schema

The tables are plain drizzle definitions: export them from the schema files drizzle-kit reads
and they are created by your own migrations.

```ts
// platform/database/schema.ts
import { contextSchema, outboxTable, processedEventsTable } from '@ddd-ts-kit/drizzle/postgres';

export const outbox = outboxTable('messaging'); // messaging.outbox; no argument: public.outbox
export const processedEvents = processedEventsTable('messaging');

// contexts/order-management/infrastructure/persistence/schema.ts
export const orderManagement = contextSchema('order-management'); // schema order_management
export const orders = orderManagement.table('orders', {
  id: text('id').primaryKey(),
  status: text('status').notNull(),
  version: integer('version').notNull(),
});
```

`outbox` is indexed for the relay (pending records by next attempt, partial index);
`processed_events` has `(consumer, event_id)` as its primary key.

## Composition root

```ts
// main.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { InMemoryCommandBus, SystemClock, unitOfWorkMiddleware } from '@ddd-ts-kit/kernel';
import { OutboxPublisher, OutboxRelay } from '@ddd-ts-kit/events';
import {
  createDrizzleUnitOfWork,
  DrizzleOutboxStore,
  DrizzleProcessedEventStore,
} from '@ddd-ts-kit/drizzle/postgres';

const db = drizzle(process.env.DATABASE_URL);
const unitOfWork = createDrizzleUnitOfWork(db);

// Every command runs in one transaction; handlers do not know it.
const commandBus = new InMemoryCommandBus().use(unitOfWorkMiddleware(unitOfWork));

const outboxStore = new DrizzleOutboxStore(unitOfWork, { table: outbox });
const publisher = new OutboxPublisher(outboxStore); // what handlers publish to
const processed = new DrizzleProcessedEventStore(unitOfWork, { table: processedEvents });
const orders = new DrizzleOrderRepository(unitOfWork);

const relay = new OutboxRelay({ store: outboxStore, publisher: broker, clock: new SystemClock() });
relay.start({ intervalMs: 500 });
```

`unitOfWork.run(work)` opens `db.transaction` and keeps the transaction in an
`AsyncLocalStorage`; a nested `run` joins the outer transaction. Because `append` uses the
current transaction, an event published by a handler that then fails is rolled back with the
business write: that is the whole point of the outbox.

## Repository

A repository receives the context, never a transaction. `executor()` is the transaction of the
unit of work when there is one and `db` otherwise.

```ts
// contexts/order-management/infrastructure/persistence/drizzle-order.repository.ts
import { and, eq } from 'drizzle-orm';
import type { NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import { optimisticUpdate, type DrizzleContext } from '@ddd-ts-kit/drizzle/postgres';

export class DrizzleOrderRepository implements OrderRepository {
  constructor(private readonly context: DrizzleContext<NodePgQueryResultHKT>) {}

  async findById(id: string): Promise<Order | undefined> {
    const [row] = await this.context.executor().select().from(orders).where(eq(orders.id, id));
    return row === undefined ? undefined : OrderMapper.toDomain(row); // sets order.version
  }

  async save(order: Order): Promise<void> {
    const db = this.context.executor();
    await optimisticUpdate(order, async ({ expected, next }) => {
      const row = { ...OrderMapper.toRow(order), version: next };
      const written =
        expected === 0
          ? await db.insert(orders).values(row).onConflictDoNothing().returning({ id: orders.id })
          : await db
              .update(orders)
              .set(row)
              .where(and(eq(orders.id, order.id), eq(orders.version, expected)))
              .returning({ id: orders.id });
      return written.length;
    });
  }
}
```

`optimisticUpdate` gives the version to expect and the version to write, raises a
`ConcurrencyError` (a `DomainError` with code `CONCURRENCY_CONFLICT`) when the guarded
statement wrote no row, and moves `order.version` on otherwise. If your database was created
with a relational schema (`drizzle(url, { schema })`), type the context as
`DrizzleContext<NodePgQueryResultHKT, typeof schema>` to keep `executor().query`.

## Audit columns, tenant scoping and pages

The standard persistence shapes of the kernel, on drizzle. `auditColumns()` and `tenantColumn()`
are column helpers to spread into a table: their keys are those of the kernel `AuditStamp` and
`TenantScoped`, so a stamp spreads into an insert as it is, and the four columns have the same
names in every project (`created_at`, `created_by`, `updated_at`, `updated_by`, `tenant_id`),
which is what lets a dashboard, an export or the audit package be written once.

```ts
import { auditColumns, contextSchema, tenantColumn } from '@ddd-ts-kit/drizzle/postgres';

export const invoices = contextSchema('billing-core').table(
  'invoices',
  {
    id: text('id').primaryKey(),
    amount: integer('amount').notNull(),
    status: text('status').$type<'draft' | 'issued'>().notNull(),
    version: integer('version').notNull(),
    ...tenantColumn(),
    ...auditColumns(),
  },
  (table) => [index('invoices_tenant_amount_idx').on(table.tenantId, table.amount, table.id)],
);
```

```ts
import { stampCreation, stampUpdate, tenantScopeOf } from '@ddd-ts-kit/kernel';

export class DrizzleInvoiceRepository implements Repository<Invoice> {
  constructor(
    private readonly context: DrizzleContext<NodePgQueryResultHKT>,
    private readonly scope: ExecutionScope, // EXECUTION_SCOPE
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Invoice | undefined> {
    const [row] = await this.context
      .executor()
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), ownTenant(this.scope)));
    return row === undefined ? undefined : InvoiceMapper.toDomain(row);
  }

  async save(invoice: Invoice): Promise<void> {
    await optimisticUpdate(invoice, async ({ expected, next }) => {
      const state = { ...InvoiceMapper.toRow(invoice), version: next };
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

const ownTenant = (scope: ExecutionScope) => eq(invoices.tenantId, tenantScopeOf(scope).tenantId);
```

A list query takes the kernel `PageRequest` and answers a `Page`, in both variants:

```ts
import { decodeCursor, encodeCursor, pageOf } from '@ddd-ts-kit/kernel';

export class DrizzleInvoiceQueries {
  list(request: PageRequest<'amount'>): Promise<Page<InvoiceSummary>> {
    return request.kind === 'offset' ? this.#byOffset(request) : this.#byCursor(request);
  }

  async #byOffset(request: OffsetPageRequest<'amount'>): Promise<Page<InvoiceSummary>> {
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

  async #byCursor(request: CursorPageRequest<'amount'>): Promise<Page<InvoiceSummary>> {
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

const directionOf = (request: PageRequest<'amount'>) => request.sort[0]?.direction ?? 'asc';

// The primary key follows the sort field, in the same direction: the order is total.
function totalOrder(direction: SortDirection): SQL[] {
  const toward = direction === 'asc' ? asc : desc;
  return [toward(invoices.amount), toward(invoices.id)];
}

// The rows after a position, as a tuple comparison: the tie-breaker decides among equals.
function beyond({ amount, id }: { amount: number; id: string }, direction: SortDirection) {
  const past = direction === 'asc' ? gt : lt;
  return or(past(invoices.amount, amount), and(eq(invoices.amount, amount), past(invoices.id, id)));
}

function positionOf(cursor: string): { amount: number; id: string } {
  const { amount, id } = decodeCursor(cursor);
  if (typeof amount !== 'number' || typeof id !== 'string') {
    throw new InvalidPageRequestError('The cursor of a page is the nextCursor of a previous page');
  }
  return { amount, id };
}
```

The rules these examples hold, and that the tests of this package check on a real database:

- **Audit columns** are filled by the adapter, never by the aggregate: `stampCreation(scope,
  clock)` on insert, `stampUpdate(scope, clock)` on update, which leaves `created_at` and
  `created_by` alone. The actor is the one of the execution scope: the user of the request, or
  `system:<consumer>` for a consumed event.
- **The tenant is part of every statement**: written on insert, and in the condition of every
  read and every update, the version guard included. A row of another tenant is not found, and
  an update aimed at it writes nothing, which `optimisticUpdate` reports as a
  `ConcurrencyError`. Work that names no tenant raises `NoCurrentTenantError` before any SQL.
- **A list has a total order.** The primary key follows the sort field, in the same direction,
  as a tie-breaker: rows equal on the sort field otherwise have no defined order, and a page
  could repeat or skip one of them. The index covers `(tenant_id, <sort field>, id)`.
- **A cursor is a position, not a page number**: the sort value and the id of the last row,
  written by `encodeCursor`, compared as a tuple (`amount > :amount OR (amount = :amount AND id
  > :id)`). One row more than `limit` is fetched to know whether a page follows, so no count is
  needed, and a row inserted before the cursor does not shift the next page as it does with an
  offset. A cursor comes back from a client: `decodeCursor` refuses what it did not write, and
  the adapter checks the types of the position before they reach a statement.
- **An offset page answers `total`**, a cursor page `nextCursor`. Offer the offset form for
  small, browsable lists and the cursor form for anything that grows.

## Outbox and idempotency

- `DrizzleOutboxStore.claimBatch` selects the due rows `FOR UPDATE SKIP LOCKED` and leases
  them in the same short transaction by pushing `next_attempt_at` forward (`leaseMs`, default
  30 s), so several relays share the work without waiting for each other, and the records of a
  relay that died come back when the lease expires. Delivery is at least once, unordered.
- `DrizzleProcessedEventStore.markProcessed` is an `INSERT ... ON CONFLICT DO NOTHING`. Run
  the consumer inside the unit of work: the mark then commits with the effects of the handler,
  and disappears with them if it fails.

## Testing an adapter

The stores of this package pass `outboxStoreContract` and `processedEventStoreContract` of
`@ddd-ts-kit/testing/contracts` on PGlite (PostgreSQL in process, no container). Hold your
repositories to `repositoryContract` the same way, next to their in-memory fake.

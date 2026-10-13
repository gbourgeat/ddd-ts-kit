**English** · [Français](README.fr.md)

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

## Where it sits in an application

Nothing here is imported from `domain/` or `application/`. A handler depends on the repository
port of its domain; the adapter of that port, in `infrastructure/`, runs its statements on the
`Database` of the project; the platform builds the unit of work once and binds it.

![A bounded context holds a handler, the repository port of the domain and the drizzle repository that implements it; createDrizzleUnitOfWork gives one object that is both the UnitOfWork the command bus runs each command in and the Database whose executor() the repository and the stores query through; it opens db.transaction() on a drizzle database of any PostgreSQL driver, whose tables drizzle-kit migrations create](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/drizzle-place-in-an-application.svg)

The one idea to keep: **every statement goes through `executor()`**. Inside a unit of work it
is the transaction of that unit of work, so the row of the aggregate, the outbox record of the
event it published and the processed-event mark of a consumer commit or roll back together.
Outside one (a query, a script) it is the database itself.

## Schema

The tables are plain drizzle definitions: export them from the schema files drizzle-kit reads
and they are created by your own migrations.

<!-- checked sample -->
```ts
// platform/database/schema.ts
import { integer, text } from 'drizzle-orm/pg-core';
import { contextSchema, outboxTable, processedEventsTable } from '@ddd-ts-kit/drizzle/postgres';

export const outbox = outboxTable('messaging'); // messaging.outbox; no argument: public.outbox
export const processedEvents = processedEventsTable('messaging');

// contexts/order-management/infrastructure/persistence/order-management.schema.ts
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

`DrizzleContext` is the handle repositories and stores run their queries on. It is generic
over the drizzle database, so the project names its own database with a class, which is then
the injection token:

<!-- checked sample -->
```ts
// platform/database/database.ts
import type { PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { DrizzleContext } from '@ddd-ts-kit/drizzle/postgres';

export abstract class Database extends DrizzleContext<PgQueryResultHKT> {}
```

This is the class the CLI writes: typed on the driver-neutral base, so the same repositories
run on node-postgres in production and on PGlite in the tests, the connection being typed
`PgDatabase<PgQueryResultHKT>`. A project bound to one driver may name its kind instead
(`DrizzleContext<NodePgQueryResultHKT>`), which types the raw result of `execute` exactly.

`createDrizzleUnitOfWork(db)` gives one object that is both the kernel `UnitOfWork` and that
`Database`. Bind it to both:

```ts
// platform/database/persistence.module.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { defineContextModule } from '@ddd-ts-kit/di';
import { IntegrationEventPublisher, ProcessedEventStore, UnitOfWork } from '@ddd-ts-kit/kernel';
import { OutboxPublisher, OutboxStore } from '@ddd-ts-kit/events';
import {
  createDrizzleUnitOfWork,
  DrizzleOutboxStore,
  DrizzleProcessedEventStore,
} from '@ddd-ts-kit/drizzle/postgres';
import { Database } from '@/platform/database/database';
import { outbox, processedEvents } from '@/platform/database/schema';

const db: PgDatabase<PgQueryResultHKT> = drizzle(process.env.DATABASE_URL);
const unitOfWork = createDrizzleUnitOfWork(db);

export const persistenceModule = defineContextModule({
  name: 'persistence',
  register(builder) {
    builder.rebind(UnitOfWork).toValue(unitOfWork);
    builder.bind(Database).toValue(unitOfWork);
    builder
      .bind(OutboxStore)
      .toFactory((resolve) => new DrizzleOutboxStore(resolve(Database), { table: outbox }));
    builder
      .rebind(ProcessedEventStore)
      .toFactory((resolve) => new DrizzleProcessedEventStore(resolve(Database), { table: processedEvents }));
    builder.rebind(IntegrationEventPublisher).toClass(OutboxPublisher, [OutboxStore]);
  },
});
```

```ts
// main.ts
const app = createApplication({ modules: [kernelModule(), persistenceModule, contextModule('order-management', orderManagementDeclarations)] });
```

List the module after `kernelModule()`: `rebind` replaces its in-memory defaults. The command
bus of the kernel module runs every command in the bound `UnitOfWork`; handlers do not know it.
`contextModule` of `@ddd-ts-kit/di` turns the declared classes of a context into its module.

A project written by the CLI holds the same wiring in two files:
`platform/database/persistence-over.ts` builds the unit of work and the two stores once, and
`platform/platform.module.ts` binds them, the outbox publisher being given to
`kernelModule({ eventPublisher })`.

The factories pass the tables of the `messaging` schema. With the tables in `public`, the
stores need no option and the class is bound directly:
`builder.bind(OutboxStore).toClass(DrizzleOutboxStore, [Database])`,
`builder.rebind(ProcessedEventStore).toClass(DrizzleProcessedEventStore, [Database])`.

The relay reads the same store and hands the records to the broker:

```ts
const relay = new OutboxRelay({ store: app.resolve(OutboxStore), publisher: broker, clock: app.resolve(Clock) });
relay.start({ intervalMs: 500 });
```

`unitOfWork.run(work)` opens `db.transaction` and keeps the transaction in an
`AsyncLocalStorage`; a nested `run` joins the outer transaction. Because `append` uses the
current transaction, an event published by a handler that then fails is rolled back with the
business write: that is the whole point of the outbox.

`run` is built on `withinUnitOfWork` of the kernel. The domain events of the aggregates saved
inside it wait until `work` has returned, then are dispatched inside the transaction, before
the commit: their handlers see every save, and what they write commits or rolls back with it.
If `work`, a handler or the commit fails, nothing is left: no row, no outbox record, no handler
run after the commit. Handlers declared `after-commit` run once the transaction has committed.
A nested `run` joins the unit of work in progress: one dispatch, at the end of the outermost.
A `run` called directly (a consumer, a script) has the same timing as a command.
`unitOfWorkContract` of `@ddd-ts-kit/testing/contracts` proves it on PGlite, with a deferred
constraint for the commit that fails. The README of `@ddd-ts-kit/kernel` draws this timeline
([Domain events and the unit of work](../kernel/README.md#domain-events-and-the-unit-of-work)).

## Repository

The port lives in the domain, the adapter in infrastructure. A repository receives the
database, never a transaction: `executor()` is the transaction of the unit of work when there
is one and `db` otherwise.

```ts
// Instead of: a transaction handed down by the caller, which every port and every handler would then carry
save(order: Order, transaction: PgTransaction<PgQueryResultHKT>): Promise<void>;

// Write: the database, whose executor() is the transaction of the unit of work in progress
constructor(private readonly database: Database) {}
```

The domain side, an aggregate that knows nothing of rows, and its port:

<!-- checked sample -->
```ts
// contexts/order-management/domain/order.aggregate.ts
import { AggregateRoot, ConceptError, Repository } from '@ddd-ts-kit/kernel';

export type OrderStatus = 'open' | 'placed';

export class OrderError extends ConceptError {
  static alreadyPlaced(orderId: string) {
    return OrderError.refusal('ORDER_ALREADY_PLACED', `Order ${orderId} is already placed.`, { orderId });
  }
}

export class Order extends AggregateRoot {
  private constructor(
    id: string,
    private status: OrderStatus,
  ) {
    super(id);
  }

  static open(id: string): Order {
    return new Order(id, 'open');
  }

  /** Rebuilds a stored order: used by the mapper only. */
  static rehydrate(id: string, status: OrderStatus): Order {
    return new Order(id, status);
  }

  get currentStatus(): OrderStatus {
    return this.status;
  }

  place(): void {
    if (this.status === 'placed') {
      throw OrderError.alreadyPlaced(this.id);
    }

    this.status = 'placed';
  }
}

// contexts/order-management/domain/repositories/order.repository.ts: findById and save come from Repository
export abstract class OrderRepository extends Repository<Order> {}
```

The infrastructure side, the table, the mapper and the adapter:

<!-- checked sample -->
```ts
// contexts/order-management/infrastructure/persistence/drizzle-order.repository.ts
import { and, eq } from 'drizzle-orm';
import { integer, text, type PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { AggregateRoot } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { contextSchema, DrizzleContext, optimisticUpdate } from '@ddd-ts-kit/drizzle/postgres';

// The aggregate and its port of the previous sample, reduced to their shape.
type OrderStatus = 'open' | 'placed';
declare class Order extends AggregateRoot {
  static rehydrate(id: string, status: OrderStatus): Order;
  get currentStatus(): OrderStatus;
}
abstract class OrderRepository {
  abstract findById(id: string): Promise<Order | undefined>;
  abstract save(order: Order): Promise<void>;
}

// platform/database/database.ts: the injection token of the database
abstract class Database extends DrizzleContext<PgQueryResultHKT> {}

// order-management.schema.ts: the table of the schema sample, with a typed status
const orders = contextSchema('order-management').table('orders', {
  id: text('id').primaryKey(),
  status: text('status').$type<OrderStatus>().notNull(),
  version: integer('version').notNull(),
});

type OrderRow = typeof orders.$inferSelect;

// order.mapper.ts: the row never leaves infrastructure
const OrderMapper = {
  toDomain(row: OrderRow): Order {
    const order = Order.rehydrate(row.id, row.status);

    order.version = row.version; // the version optimisticUpdate will expect

    return order;
  },

  toRow(order: Order, version: number): OrderRow {
    return { id: order.id, status: order.currentStatus, version };
  },
};

@Repository(OrderRepository)
export class DrizzleOrderRepository implements OrderRepository {
  constructor(private readonly database: Database) {}

  async findById(id: string): Promise<Order | undefined> {
    // executor(): the transaction of the unit of work in progress, or the database outside one
    const [row] = await this.database.executor().select().from(orders).where(eq(orders.id, id));

    return row === undefined ? undefined : OrderMapper.toDomain(row);
  }

  async save(order: Order): Promise<void> {
    const db = this.database.executor();

    await optimisticUpdate(order, async ({ expected, next }) => {
      const row = OrderMapper.toRow(order, next);
      const written =
        expected === 0
          ? await db.insert(orders).values(row).onConflictDoNothing().returning({ id: orders.id })
          : await db
              .update(orders)
              .set(row)
              .where(and(eq(orders.id, order.id), eq(orders.version, expected)))
              .returning({ id: orders.id });

      return written.length; // 0 rows: optimisticUpdate throws ConcurrencyError
    });
  }
}
```

In the explicit style, without the decorator, the same binding is one line of
`<context>.module.ts`:
`builder.bind(OrderRepository).toClass(DrizzleOrderRepository, [Database])`.

`optimisticUpdate` gives the version to expect and the version to write, raises a
`ConcurrencyError` (a `DomainError` with code `CONCURRENCY_CONFLICT`) when the guarded
statement wrote no row, and moves `order.version` on otherwise. If your database was created
with a relational schema (`drizzle(url, { schema })`), declare `Database` as
`DrizzleContext<PgQueryResultHKT, typeof schema>` to keep `executor().query`.

| `expected` | Statement | No row written means |
|---|---|---|
| `0`: never saved | `INSERT ... ON CONFLICT DO NOTHING` | the id is taken |
| `n` | `UPDATE ... SET version = n + 1 WHERE id = ... AND version = n` | another transaction saved it since it was read |

## Audit columns, tenant scoping and pages

The standard persistence shapes of the kernel, on drizzle. `auditColumns()` and `tenantColumn()`
are column helpers to spread into a table: their keys are those of the kernel `AuditStamp` and
`TenantScoped`, so a stamp spreads into an insert as it is, and the columns have the same
names in every project (`created_at`, `created_by`, `updated_at`, `updated_by`, `tenant_id`),
which is what lets a dashboard, an export or the audit package be written once.

The table, then the repository. It reads through `tenantCondition` and writes through
`ownTenantCondition`, the two conditions of [Tenant isolation](#tenant-isolation):

<!-- checked sample -->
```ts
import { and, eq } from 'drizzle-orm';
import { index, integer, text, type PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { AggregateRoot, Clock, ExecutionScope, stampCreation, stampUpdate, tenantScopeOf } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import {
  auditColumns,
  contextSchema,
  DrizzleContext,
  optimisticUpdate,
  ownTenantCondition,
  tenantColumn,
  tenantCondition,
} from '@ddd-ts-kit/drizzle/postgres';

// The aggregate, its port and the database, reduced to their shape.
type InvoiceStatus = 'draft' | 'issued';
declare class Invoice extends AggregateRoot {
  static rehydrate(id: string, amount: number, status: InvoiceStatus): Invoice;
  get amount(): number;
  get status(): InvoiceStatus;
}
abstract class InvoiceRepository {
  abstract findById(id: string): Promise<Invoice | undefined>;
  abstract save(invoice: Invoice): Promise<void>;
}
abstract class Database extends DrizzleContext<PgQueryResultHKT> {}

// contexts/billing-core/infrastructure/persistence/invoices.ts
export const invoices = contextSchema('billing-core').table(
  'invoices',
  {
    id: text('id').primaryKey(),
    amount: integer('amount').notNull(),
    status: text('status').$type<InvoiceStatus>().notNull(),
    version: integer('version').notNull(),
    ...tenantColumn(),
    ...auditColumns(),
  },
  // the order of the list queries, tie-breaker included, so a page is read from the index
  (table) => [index('invoices_tenant_amount_idx').on(table.tenantId, table.amount, table.id)],
);

/** What the aggregate says of itself, plus the version to store: the rest of the row is the adapter's. */
interface VersionedInvoice {
  readonly id: string;
  readonly amount: number;
  readonly status: InvoiceStatus;
  readonly version: number;
}

@Repository(InvoiceRepository)
export class DrizzleInvoiceRepository implements InvoiceRepository {
  constructor(
    private readonly database: Database,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Invoice | undefined> {
    const [row] = await this.database
      .executor()
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), tenantCondition(invoices.tenantId, this.scope)));

    if (row === undefined) {
      return undefined;
    }

    const invoice = Invoice.rehydrate(row.id, row.amount, row.status);

    invoice.version = row.version;

    return invoice;
  }

  async save(invoice: Invoice): Promise<void> {
    await optimisticUpdate(invoice, async ({ expected, next }) => {
      const state = { id: invoice.id, amount: invoice.amount, status: invoice.status, version: next };
      const written = expected === 0 ? await this.insert(state) : await this.update(state, expected);

      return written.length;
    });
  }

  private insert(state: VersionedInvoice) {
    // tenant_id from the work in progress, created_* and updated_* from its actor and the Clock
    const row = { ...state, ...tenantScopeOf(this.scope), ...stampCreation(this.scope, this.clock) };

    return this.database.executor().insert(invoices).values(row).onConflictDoNothing().returning({ id: invoices.id });
  }

  private update(state: VersionedInvoice, expected: number) {
    return this.database
      .executor()
      .update(invoices)
      .set({ ...state, ...stampUpdate(this.scope, this.clock) }) // leaves created_at and created_by alone
      .where(
        and(
          eq(invoices.id, state.id),
          eq(invoices.version, expected),
          ownTenantCondition(invoices.tenantId, this.scope),
        ),
      )
      .returning({ id: invoices.id });
  }
}
```

A search query takes the kernel `PageRequest` and answers a `Page`, in both variants:

```ts
// contexts/billing-core/application/ports/invoice-queries.port.ts
export abstract class InvoiceQueries {
  abstract search(request: PageRequest<'amount'>): Promise<Page<InvoiceSummary>>;
}
```

<!-- checked sample -->
```ts
// contexts/billing-core/infrastructure/persistence/drizzle-invoice-queries.reader.ts
import { and, asc, desc, eq, gt, lt, or, type SQL } from 'drizzle-orm';
import { index, integer, text, type PgQueryResultHKT } from 'drizzle-orm/pg-core';
import {
  ExecutionScope,
  InvalidPageRequestError,
  decodeCursor,
  encodeCursor,
  pageOf,
  type CursorPageRequest,
  type OffsetPageRequest,
  type Page,
  type PageRequest,
  type SortDirection,
} from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { contextSchema, DrizzleContext, tenantColumn, tenantCondition } from '@ddd-ts-kit/drizzle/postgres';

// The port of the application, the database and the table of the previous samples, reduced to their shape.
interface InvoiceSummary {
  readonly id: string;
  readonly amount: number;
}
abstract class InvoiceQueries {
  abstract search(request: PageRequest<'amount'>): Promise<Page<InvoiceSummary>>;
}
abstract class Database extends DrizzleContext<PgQueryResultHKT> {}
const invoices = contextSchema('billing-core').table(
  'invoices',
  { id: text('id').primaryKey(), amount: integer('amount').notNull(), ...tenantColumn() },
  (table) => [index('invoices_tenant_amount_idx').on(table.tenantId, table.amount, table.id)],
);

@Repository(InvoiceQueries)
export class DrizzleInvoiceQueries implements InvoiceQueries {
  constructor(
    private readonly database: Database,
    private readonly scope: ExecutionScope,
  ) {}

  search(request: PageRequest<'amount'>): Promise<Page<InvoiceSummary>> {
    return request.kind === 'offset' ? this.byOffset(request) : this.byCursor(request);
  }

  private async byOffset(request: OffsetPageRequest<'amount'>): Promise<Page<InvoiceSummary>> {
    const db = this.database.executor();
    const own = tenantCondition(invoices.tenantId, this.scope);
    const rows = await db
      .select()
      .from(invoices)
      .where(own)
      .orderBy(...totalOrder(directionOf(request)))
      .limit(request.limit)
      .offset(request.offset);

    return pageOf(rows.map(toSummary), { total: await db.$count(invoices, own) });
  }

  private async byCursor(request: CursorPageRequest<'amount'>): Promise<Page<InvoiceSummary>> {
    const direction = directionOf(request);
    const after = request.cursor === undefined ? undefined : beyond(positionOf(request.cursor), direction);
    const rows = await this.database
      .executor()
      .select()
      .from(invoices)
      .where(and(tenantCondition(invoices.tenantId, this.scope), after))
      .orderBy(...totalOrder(direction))
      .limit(request.limit + 1); // one row more than asked: it says whether a page follows
    const items = rows.slice(0, request.limit);
    const last = items.at(-1);
    const more = rows.length > request.limit && last !== undefined;

    return pageOf(items.map(toSummary), more ? { nextCursor: encodeCursor({ amount: last.amount, id: last.id }) } : {});
  }
}

const directionOf = (request: PageRequest<'amount'>): SortDirection => request.sort[0]?.direction ?? 'asc';

const toSummary = (row: typeof invoices.$inferSelect): InvoiceSummary => ({ id: row.id, amount: row.amount });

// The primary key follows the sort field, in the same direction: the order is total.
function totalOrder(direction: SortDirection): SQL[] {
  const toward = direction === 'asc' ? asc : desc;

  return [toward(invoices.amount), toward(invoices.id)];
}

// The rows after a position, as a tuple comparison: the tie-breaker decides among equals.
function beyond({ amount, id }: { amount: number; id: string }, direction: SortDirection): SQL | undefined {
  const past = direction === 'asc' ? gt : lt;

  return or(past(invoices.amount, amount), and(eq(invoices.amount, amount), past(invoices.id, id)));
}

// A cursor comes back from a client: what it decodes to is checked before it reaches a statement.
function positionOf(cursor: string): { amount: number; id: string } {
  const { amount, id } = decodeCursor(cursor);

  if (typeof amount !== 'number' || typeof id !== 'string') {
    throw new InvalidPageRequestError('The cursor of a page is the nextCursor of a previous page');
  }

  return { amount, id };
}
```

A read adapter over the database is declared with `@Repository`, as the ones the CLI
generates: its kind is `repository`. Declared with `@Adapter` it would be `external`, and a
generated platform puts a retry and a time limit around every `external` and `gateway`
adapter, which a statement of the unit of work must not get.

What the two kinds of page do when a row is inserted between two reads:

![Invoices sorted by amount then id: an offset page 2 read after an insertion shows inv-f a second time, while a cursor page that starts after the position (120, inv-f) of the last row of page 1 shows the same rows whatever was inserted before it, and fetches one row more than the limit to know that a page follows](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/drizzle-keyset-pages.svg)

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

## Tenant isolation

Two strategies on drizzle, both proven by `tenantIsolationContract` of
`@ddd-ts-kit/testing/contracts`; schema per tenant and database per tenant are shipped for knex
only ([Multitenancy](../../docs/concepts/multitenancy.md) has the table).

![The execution scope names the tenant of the work; first line, the repository puts it in every statement with tenantCondition, ownTenantCondition and tenantScopeOf; second line, the unit of work begins each transaction with tenantSession, which sets the tenant for that transaction only, and the policies declared with the table let it see and write the rows of that tenant alone](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/drizzle-tenant-isolation.svg)

**Shared tables.** A `tenant_id` column (`tenantColumn()`) and the condition of the kit in every
statement instead of one written by hand:

```ts
// Instead of: a condition written by hand, which an elevation of platform staff cannot widen
.where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantScopeOf(this.scope).tenantId)))

// Write, for reads: the tenant of the work, or the tenants of an elevation
.where(and(eq(invoices.id, id), tenantCondition(invoices.tenantId, this.scope)))
// and for updates and deletes: the one tenant of the work, which an elevation never widens
.where(and(eq(invoices.id, state.id), eq(invoices.version, expected), ownTenantCondition(invoices.tenantId, this.scope)))
```

Inserts spread `tenantScopeOf(this.scope)`. A read model of tenant data passes `tenant: { scope,
column: table.tenantId }` to `DrizzleReadModelTable` and `DrizzleReadModelStore`.

**Row-level security**, the second line: the policies (one per command: a select sees the reach of
the work, an insert, an update and a delete only its one tenant) are declared with the table, so
drizzle-kit generates them, and the unit of work sets the tenant of each transaction.

<!-- checked sample -->
```ts
// contexts/billing-core/infrastructure/persistence/invoices.ts
import { integer, text } from 'drizzle-orm/pg-core';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { ExecutionScope } from '@ddd-ts-kit/kernel';
import {
  contextSchema,
  createDrizzleUnitOfWork,
  forceRowLevelSecurity,
  tenantColumn,
  tenantPolicies,
  tenantSession,
} from '@ddd-ts-kit/drizzle/postgres';

export const invoices = contextSchema('billing-core')
  .table(
    'invoices',
    {
      id: text('id').primaryKey(),
      amount: integer('amount').notNull(),
      version: integer('version').notNull(),
      ...tenantColumn(),
    },
    // tenant_isolation_select, _insert, _update and _delete: drizzle-kit writes them into the migration
    (table) => [...tenantPolicies(table.tenantId)],
  )
  .enableRLS();

// platform/database/persistence-over.ts: each transaction starts by setting the tenant of the work
declare const db: PgDatabase<PgQueryResultHKT>;
declare const executionScope: ExecutionScope;

export const unitOfWork = createDrizzleUnitOfWork(db, undefined, { begin: tenantSession(executionScope) });

// The one statement drizzle-kit does not write, for a custom migration (drizzle-kit generate --custom):
// alter table "billing_core"."invoices" force row level security;
export const forced = forceRowLevelSecurity(invoices);
```

drizzle-kit does not force the policies on the owner of the table: `forceRowLevelSecurity(invoices)`
is the statement of a custom migration (`drizzle-kit generate --custom`), or the application
connects with a role that does not own the tables. In every case that role is not a superuser and
has no `BYPASSRLS`, and every statement runs inside the unit of work: one outside of a transaction
carries no setting and sees nothing.

## Criteria

`criteriaToDrizzle(plan, columns)` turns a criteria plan of the kernel into the parts of a
query: `where` (the filters, the scope of the actor and the keyset of a cursor page),
`counted` (the filters and the scope alone, for a total), `orderBy` (the total order ended by
the tie-breaker), `limit` and `offset`. `predicateToDrizzle(predicate, columns)` gives one
condition. `columns` maps each field of the read model to its column, and is the only source
of identifiers: every value is a parameter encoded by its column, a text search is
`like $1 escape $2` with `%`, `_` and `\` escaped.

A read port declares what a caller may ask with `defineCriteria`; a query of your own on the
table of a read model plans the criteria, then hands the plan to the translator:

<!-- checked sample -->
```ts
import { and, eq } from 'drizzle-orm';
import { text, timestamp, type PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { defineCriteria, pageOfPlan, planCriteria, type Page, type ScopedCriteria } from '@ddd-ts-kit/kernel';
import { contextSchema, criteriaToDrizzle, DrizzleContext, readModelColumns } from '@ddd-ts-kit/drizzle/postgres';

// application/ports/appointment-list.port.ts: the row, and what a caller may filter and sort by
export interface AppointmentRow {
  readonly id: string;
  readonly status: string;
  readonly startsAt: Date;
}

export const appointmentCriteria = defineCriteria<AppointmentRow>({
  fields: {
    id: { type: 'string' },
    status: { type: 'string', filter: ['eq', 'in'], sortable: true },
    startsAt: { type: 'instant', filter: ['gte', 'lt', 'between'], sortable: true },
  },
  defaultSort: [{ field: 'startsAt', direction: 'asc' }],
  tieBreaker: 'id',
});

abstract class Database extends DrizzleContext<PgQueryResultHKT> {}

// infrastructure/persistence/appointment-list.schema.ts
export const appointmentList = contextSchema('scheduling').table('appointment_list', {
  id: text('id').primaryKey(),
  status: text('status').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true, mode: 'date' }).notNull(),
  ...readModelColumns(), // last_event_id, last_event_at, last_event_version, deleted
});

// the only source of identifiers: a field the map does not name never reaches a statement
const COLUMNS = { id: appointmentList.id, status: appointmentList.status, startsAt: appointmentList.startsAt };

// infrastructure/persistence/drizzle-appointment-queries.reader.ts
export async function searchAppointments(
  database: Database,
  criteria: ScopedCriteria<AppointmentRow>,
): Promise<Page<AppointmentRow>> {
  const plan = planCriteria(appointmentCriteria, criteria); // refuses what the definition does not open

  if (plan.empty) {
    return pageOfPlan(plan, []); // the access scope reaches no row: no statement at all
  }

  const { where, counted, orderBy, limit, offset } = criteriaToDrizzle(plan, COLUMNS);
  const live = eq(appointmentList.deleted, false); // a removed row stays in the table, flagged
  const db = database.executor();
  const rows = await db
    .select(COLUMNS)
    .from(appointmentList)
    .where(and(where, live))
    .orderBy(...orderBy)
    .limit(limit)
    .offset(offset);

  // An offset page counts its total; a cursor page knows what follows from the extra row.
  const total = plan.kind === 'offset' ? await db.$count(appointmentList, and(counted, live)) : undefined;

  return pageOfPlan(plan, rows, total);
}
```

A cursor page is fetched one row longer than asked, which is how `pageOfPlan` knows whether
another follows; an offset page takes its total from `db.$count(table, counted)`, passed as
the third argument of `pageOfPlan`. A field declared `nullable` is ordered `nulls last`
ascending and `nulls first` descending.

**Strings.** A text column is ordered and compared by range in the collation of the column;
criteria order strings by code point. Declare the text columns that are sorted or compared
with `gt`, `lt` or `between` with `COLLATE "C"` (a `customType` whose `dataType` is `text collate "C"`, or the migration): the index then serves the sort, and the
order is the same as in the fake. **Decimals** are a `numeric` column and a string in the
row; they read back in the scale of the column. **Instants** are `timestamptz` and a `Date`.
An integer is `integer`: a `bigint` comes back as a string from the driver.

## Read models

The adapter of a read model port extends `DrizzleReadModelStore` and adds nothing: it gets
`get`, `upsertIfNewer`, `delete` and `search` from it.

<!-- checked sample -->
```ts
import { text, timestamp, type PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { ReadModelStore, type CriteriaDefinition } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { contextSchema, DrizzleContext, DrizzleReadModelStore, readModelColumns } from '@ddd-ts-kit/drizzle/postgres';

// The row, its criteria and the database of the previous samples, reduced to their shape.
interface AppointmentRow {
  readonly id: string;
  readonly status: string;
  readonly startsAt: Date;
}
declare const appointmentCriteria: CriteriaDefinition<AppointmentRow>;
abstract class AppointmentList extends ReadModelStore<AppointmentRow> {}
abstract class Database extends DrizzleContext<PgQueryResultHKT> {}

// infrastructure/persistence/appointment-list.schema.ts
export const appointmentList = contextSchema('scheduling').table('appointment_list', {
  id: text('id').primaryKey(),
  status: text('status').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true, mode: 'date' }).notNull(),
  ...readModelColumns(), // last_event_id, last_event_at, last_event_version, deleted
});

// infrastructure/persistence/drizzle-appointment-list.repository.ts
@Repository(AppointmentList)
export class DrizzleAppointmentList extends DrizzleReadModelStore<AppointmentRow, PgQueryResultHKT> implements AppointmentList {
  constructor(database: Database) {
    super(database, {
      table: appointmentList,
      key: appointmentList.id,
      columns: { id: appointmentList.id, status: appointmentList.status, startsAt: appointmentList.startsAt },
      definition: appointmentCriteria,
    });
  }
}
```

Every write goes through `TableReadModelStore` of the kernel: a row is written only if its
event is newer than the one it holds, on the executor of the unit of work, so the row and the
processed-event mark commit together. A removed row stays in the table with `deleted` set:
a query of your own on the table leaves those rows out, and so does a unique index
(`WHERE NOT deleted`). `store.table` is what `ProjectionRebuild` takes; the rebuild is
PostgreSQL only (a copy `<table>__rebuild` made `LIKE ... INCLUDING ALL`, the keys written
meanwhile in `<table>__touched`, the swap by rename in one transaction) and its guarantees
and limits are in the README of `@ddd-ts-kit/kernel` ([Rebuild](../kernel/README.md#rebuild)).
The store passes `criteriaContract` and `readModelStoreContract` of
`@ddd-ts-kit/testing/contracts`, on PGlite and on PostgreSQL 18.

## Outbox and idempotency

- `DrizzleOutboxStore.claimBatch` selects the due rows `FOR UPDATE SKIP LOCKED` and leases
  them in the same short transaction by pushing `next_attempt_at` forward (`leaseMs`, default
  30 s), so several relays share the work without waiting for each other, and the records of a
  relay that died come back when the lease expires. Delivery is at least once and, by default,
  unordered: `ordering: 'per-key'` of `OutboxRelay`, given a `keyOf` (typically the aggregate
  id), keeps the records of one key in order, with a single relay ([Ordering per key](../events/README.md#ordering-per-key)).
- `DrizzleProcessedEventStore.markProcessed` is an `INSERT ... ON CONFLICT DO NOTHING`. Run
  the consumer inside the unit of work: the mark then commits with the effects of the handler,
  and disappears with them if it fails. `consume` of `@ddd-ts-kit/events` does exactly that
  ([Consume idempotently](../events/README.md#consume-idempotently)).
- A multi-tenant project declares `tenantOutboxTable('messaging')` instead of `outboxTable`: the
  same table and a nullable `tenant_id`, which the store, given that table, fills from the tenant
  of each event, so that its consumers run in that tenant. Switching an existing project is one
  generated migration that adds the column.

## Event store

<!-- checked sample -->
```ts
import type { PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { createDrizzleEventSourcing, DrizzleContext, eventStoreTables } from '@ddd-ts-kit/drizzle/postgres';

// src/contexts/scheduling/infrastructure/persistence/scheduling.schema.ts, read by drizzle-kit
export const { events, head, snapshots, checkpoints, subjectKeys } = eventStoreTables('scheduling');

// the composition root: the database of the project, then one store per port
declare const database: DrizzleContext<PgQueryResultHKT>;

export const stores = createDrizzleEventSourcing(database, { schema: 'scheduling' });
// stores.events, stores.snapshots, stores.checkpoints, stores.subjectKeys
```

`eventStoreTables` declares the tables drizzle-kit creates in a migration of the project, with
the columns of `eventStoreTablesSql` of the kernel.

Each statement runs on the executor of the context: an append joins the transaction of the
unit of work, so the stream and the outbox records its events publish commit together
(`eventStoreUnitOfWorkContract`). Appends take the head of the store, a row locked until their
transaction ends: positions are given in commit order, without gaps, and two appends never run
side by side, whatever their streams. PostgreSQL only. The stores are the ones of the kernel
(`PostgresEventStore` and its companions), held to `eventStoreContract` here; how an
event-sourced aggregate uses them: the README of `@ddd-ts-kit/kernel`, section
[Event sourcing](../kernel/README.md#event-sourcing).

## Background jobs

`DrizzleJobStore` is the `JobStore` of `@ddd-ts-kit/scheduling`: the background jobs of a
context in `jobsTable('scheduling')`, which the schema files of drizzle-kit include so that a
migration creates it. `add` runs on the executor of the context, inside the transaction of the
command that enqueues; claims select the due rows `FOR UPDATE SKIP LOCKED` and lease them.

<!-- checked sample -->
```ts
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { kernelModule } from '@ddd-ts-kit/di';
import { createDrizzleUnitOfWork, DrizzleJobStore, DrizzleProcessStore, jobsTable, processesTable } from '@ddd-ts-kit/drizzle/postgres';

// scheduling.schema.ts, read by drizzle-kit: scheduling.background_jobs and scheduling.process_instances
export const schedulingJobs = jobsTable('scheduling');
export const schedulingProcesses = processesTable('scheduling');

// the composition root
declare const db: PgDatabase<PgQueryResultHKT>;
const unitOfWork = createDrizzleUnitOfWork(db);

export const kernel = kernelModule({
  unitOfWork,
  jobStore: new DrizzleJobStore(unitOfWork, schedulingJobs),
  processStore: new DrizzleProcessStore(unitOfWork, schedulingProcesses),
});
```

It passes `jobStoreContract`, its unit of work suite included, on PGlite and, in the integration
job of CI, on PostgreSQL behind a pool of five connections, where concurrent claims race for
real. What the jobs
guarantee: [Background jobs](../../docs/concepts/background-jobs.md).

## Process managers

`DrizzleProcessStore` is the `ProcessStore` of the kernel, on `processesTable(schema)`: a first
save inserts, a next one updates at the previous version, and a save that changes no row throws
`ConcurrencyError`, in the transaction of the step. It passes `processStoreContract`. The
sample of [Background jobs](#background-jobs) binds it with `kernelModule({ processStore })`.

## Testing an adapter

The unit of work of this package passes `unitOfWorkContract`, and its stores
`outboxStoreContract`, `processedEventStoreContract` and `jobStoreContract`, of `@ddd-ts-kit/testing/contracts` on
PGlite (PostgreSQL in process, no container). Hold your repositories to `repositoryContract`
the same way, next to their in-memory fake.

The criteria translator and the read model store also run on a real server when
`DDD_TS_KIT_TEST_DATABASE_URL` is set, through `drizzle-orm/node-postgres`, each spec file in a
database of its own that it drops afterwards (last run: PostgreSQL 18):

```
DDD_TS_KIT_TEST_DATABASE_URL=postgresql://user:password@localhost:5432/postgres npx vitest run packages/drizzle
```

## See also

- [Persistence](../../docs/tools/persistence.md): choosing an ORM, and what each adapter package verified
- [Aggregates](../../docs/concepts/aggregates.md#optimistic-concurrency): optimistic concurrency, seen from the domain
- [The transactional outbox](../../docs/concepts/transactional-outbox.md): why the outbox record commits with the business write
- [Multitenancy](../../docs/concepts/multitenancy.md#isolation-four-strategies): the four isolation strategies
- [`@ddd-ts-kit/typeorm`](../typeorm/README.md): the same pieces on TypeORM

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
constraint for the commit that fails.

## Repository

The port lives in the domain, the adapter in infrastructure. A repository receives the
database, never a transaction: `executor()` is the transaction of the unit of work when there
is one and `db` otherwise.

```ts
// contexts/order-management/domain/repositories/order.repository.ts
import { Repository } from '@ddd-ts-kit/kernel';

export abstract class OrderRepository extends Repository<Order> {}
```

```ts
// contexts/order-management/infrastructure/persistence/drizzle-order.repository.ts
import { and, eq } from 'drizzle-orm';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { optimisticUpdate } from '@ddd-ts-kit/drizzle/postgres';

@Repository(OrderRepository)
export class DrizzleOrderRepository implements OrderRepository {
  constructor(private readonly database: Database) {}

  async findById(id: string): Promise<Order | undefined> {
    const [row] = await this.database.executor().select().from(orders).where(eq(orders.id, id));

    return row === undefined ? undefined : OrderMapper.toDomain(row); // sets order.version
  }

  async save(order: Order): Promise<void> {
    const db = this.database.executor();

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

In the explicit style, without the decorator, the same binding is one line of
`<context>.module.ts`:
`builder.bind(OrderRepository).toClass(DrizzleOrderRepository, [Database])`.

`optimisticUpdate` gives the version to expect and the version to write, raises a
`ConcurrencyError` (a `DomainError` with code `CONCURRENCY_CONFLICT`) when the guarded
statement wrote no row, and moves `order.version` on otherwise. If your database was created
with a relational schema (`drizzle(url, { schema })`), declare `Database` as
`DrizzleContext<PgQueryResultHKT, typeof schema>` to keep `executor().query`.

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
import { Clock, ExecutionScope, stampCreation, stampUpdate, tenantScopeOf } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';

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
      .where(and(eq(invoices.id, id), ownTenant(this.scope)));

    return row === undefined ? undefined : InvoiceMapper.toDomain(row);
  }

  async save(invoice: Invoice): Promise<void> {
    await optimisticUpdate(invoice, async ({ expected, next }) => {
      const state = { ...InvoiceMapper.toRow(invoice), version: next };
      const written = expected === 0 ? await this.insert(state) : await this.update(state, expected);

      return written.length;
    });
  }

  private insert(state: VersionedInvoice) {
    const row = { ...state, ...tenantScopeOf(this.scope), ...stampCreation(this.scope, this.clock) };

    return this.database.executor().insert(invoices).values(row).onConflictDoNothing().returning({ id: invoices.id });
  }

  private update(state: VersionedInvoice, expected: number) {
    return this.database
      .executor()
      .update(invoices)
      .set({ ...state, ...stampUpdate(this.scope, this.clock) })
      .where(and(eq(invoices.id, state.id), eq(invoices.version, expected), ownTenant(this.scope)))
      .returning({ id: invoices.id });
  }
}

const ownTenant = (scope: ExecutionScope) => eq(invoices.tenantId, tenantScopeOf(scope).tenantId);
```

A search query takes the kernel `PageRequest` and answers a `Page`, in both variants:

```ts
// contexts/billing-core/application/ports/invoice-queries.port.ts
export abstract class InvoiceQueries {
  abstract search(request: PageRequest<'amount'>): Promise<Page<InvoiceSummary>>;
}
```

```ts
// contexts/billing-core/infrastructure/persistence/drizzle-invoice-queries.reader.ts
import { ExecutionScope, decodeCursor, encodeCursor, pageOf } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';

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
    const rows = await db
      .select()
      .from(invoices)
      .where(ownTenant(this.scope))
      .orderBy(...totalOrder(directionOf(request)))
      .limit(request.limit)
      .offset(request.offset);

    return pageOf(rows.map(toSummary), { total: await db.$count(invoices, ownTenant(this.scope)) });
  }

  private async byCursor(request: CursorPageRequest<'amount'>): Promise<Page<InvoiceSummary>> {
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

A read adapter over the database is declared with `@Repository`, as the ones the CLI
generates: its kind is `repository`. Declared with `@Adapter` it would be `external`, and a
generated platform puts a retry and a time limit around every `external` and `gateway`
adapter, which a statement of the unit of work must not get.

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

## Criteria

`criteriaToDrizzle(plan, columns)` turns a criteria plan of the kernel into the parts of a
query: `where` (the filters, the scope of the actor and the keyset of a cursor page),
`counted` (the filters and the scope alone, for a total), `orderBy` (the total order ended by
the tie-breaker), `limit` and `offset`. `predicateToDrizzle(predicate, columns)` gives one
condition. `columns` maps each field of the read model to its column, and is the only source
of identifiers: every value is a parameter encoded by its column, a text search is
`like $1 escape $2` with `%`, `_` and `\` escaped.

```ts
// infrastructure/persistence/drizzle-appointment-queries.reader.ts
async search(criteria: ScopedCriteria<AppointmentRow>): Promise<Page<AppointmentRow>> {
  const plan = planCriteria(appointmentCriteria, criteria);

  if (plan.empty) {
    return pageOfPlan(plan, []);
  }

  const { where, orderBy, limit, offset } = criteriaToDrizzle(plan, COLUMNS);
  const rows = await this.database.executor().select().from(appointments).where(where).orderBy(...orderBy).limit(limit).offset(offset);

  return pageOfPlan(plan, rows);
}
```

A cursor page is fetched one row longer than asked, which is how `pageOfPlan` knows whether
another follows; an offset page takes its total from `db.$count(table, counted)`. A field
declared `nullable` is ordered `nulls last` ascending and `nulls first` descending.

**Strings.** A text column is ordered and compared by range in the collation of the column;
criteria order strings by code point. Declare the text columns that are sorted or compared
with `gt`, `lt` or `between` with `COLLATE "C"` (a `customType` whose `dataType` is `text collate "C"`, or the migration): the index then serves the sort, and the
order is the same as in the fake. **Decimals** are a `numeric` column and a string in the
row; they read back in the scale of the column. **Instants** are `timestamptz` and a `Date`.
An integer is `integer`: a `bigint` comes back as a string from the driver.

## Read models

```ts
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
and limits are in the README of `@ddd-ts-kit/kernel` ("Rebuild"). The store passes
`criteriaContract` and `readModelStoreContract` of `@ddd-ts-kit/testing/contracts`, on PGlite
and on PostgreSQL 18.

## Outbox and idempotency

- `DrizzleOutboxStore.claimBatch` selects the due rows `FOR UPDATE SKIP LOCKED` and leases
  them in the same short transaction by pushing `next_attempt_at` forward (`leaseMs`, default
  30 s), so several relays share the work without waiting for each other, and the records of a
  relay that died come back when the lease expires. Delivery is at least once, unordered.
- `DrizzleProcessedEventStore.markProcessed` is an `INSERT ... ON CONFLICT DO NOTHING`. Run
  the consumer inside the unit of work: the mark then commits with the effects of the handler,
  and disappears with them if it fails.
- A multi-tenant project declares `tenantOutboxTable('messaging')` instead of `outboxTable`: the
  same table and a nullable `tenant_id`, which the store, given that table, fills from the tenant
  of each event, so that its consumers run in that tenant. Switching an existing project is one
  generated migration that adds the column.

## Testing an adapter

The unit of work of this package passes `unitOfWorkContract`, and its stores
`outboxStoreContract` and `processedEventStoreContract`, of `@ddd-ts-kit/testing/contracts` on
PGlite (PostgreSQL in process, no container). Hold your repositories to `repositoryContract`
the same way, next to their in-memory fake.

The criteria translator and the read model store also run on a real server when
`DDD_TS_KIT_TEST_DATABASE_URL` is set, through `drizzle-orm/node-postgres`, each spec file in a
database of its own that it drops afterwards (last run: PostgreSQL 18):

```
DDD_TS_KIT_TEST_DATABASE_URL=postgresql://user:password@localhost:5432/postgres npx vitest run packages/drizzle
```

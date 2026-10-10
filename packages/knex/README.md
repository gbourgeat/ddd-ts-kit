# @ddd-ts-kit/knex

Knex adapters of the kernel and events ports: a unit of work that repositories never see, the
transactional outbox store, the processed-event store, a migration helper for their tables,
and one database schema per bounded context. Same pieces as `@ddd-ts-kit/drizzle`, for projects
that build their SQL with knex.

```
npm i @ddd-ts-kit/knex knex pg
```

PostgreSQL first. MySQL 8 and SQLite work through the same code, see
[Dialect coverage](#dialect-coverage) for what is tested and how.

## Tables

The consuming project owns its migrations. `createOutboxTables` is a helper to call from one of
them:

```ts
// migrations/20260301100000_outbox.ts
import type { Knex } from 'knex';
import { createOutboxTables, dropOutboxTables } from '@ddd-ts-kit/knex';

export const up = (knex: Knex) => createOutboxTables(knex, { schema: 'messaging' });
export const down = (knex: Knex) => dropOutboxTables(knex, { schema: 'messaging' });
```

Without `schema` the tables live in the default schema of the connection. `outboxTable` and
`processedEventsTable` rename them. If you would rather not call a library from a migration,
this is the equivalent on PostgreSQL:

```ts
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    create schema if not exists "messaging";

    create table "messaging"."outbox" (
      "id" varchar(191) primary key,
      "sequence" bigserial,
      "type" text not null,
      "version" integer not null,
      "occurred_at" text not null,
      "payload" jsonb,
      "traceparent" text,
      "correlation_id" text,
      "status" varchar(16) not null default 'pending',
      "attempts" integer not null default 0,
      "next_attempt_at" timestamptz(3) not null,
      "last_error_code" text,
      "published_at" timestamptz(3),
      "created_at" timestamptz(3) not null default current_timestamp(3)
    );
    create index "outbox_pending_idx" on "messaging"."outbox" ("next_attempt_at", "sequence")
      where status = 'pending';

    create table "messaging"."processed_events" (
      "consumer" varchar(191) not null,
      "event_id" varchar(191) not null,
      "processed_at" timestamptz(3) not null default current_timestamp(3),
      primary key ("consumer", "event_id")
    );
  `);
}
```

`outbox` is indexed for the relay (pending records by next attempt, partial index);
`processed_events` has `(consumer, event_id)` as its primary key. `occurred_at` is text on
purpose: the envelope comes back exactly as published, offset included.

One schema per bounded context: `schemaNameOf('order-management')` gives `order_management`,
to pass to `knex.schema.createSchemaIfNotExists`, `knex.schema.withSchema` and
`.withSchema(...)` on queries. Contexts never join each other's tables.

## Composition root

`createKnexUnitOfWork(db)` gives one object that is two ports: the kernel `UnitOfWork`, and
`KnexContext`, the handle repositories and stores run their queries on. Bind it to both:

```ts
// platform/database/persistence.module.ts
import knex from 'knex';
import { defineContextModule } from '@ddd-ts-kit/di';
import { IntegrationEventPublisher, ProcessedEventStore, UnitOfWork } from '@ddd-ts-kit/kernel';
import { OutboxPublisher, OutboxStore } from '@ddd-ts-kit/events';
import {
  createKnexUnitOfWork,
  KnexContext,
  KnexOutboxStore,
  KnexProcessedEventStore,
} from '@ddd-ts-kit/knex';

const db = knex({ client: 'pg', connection: process.env.DATABASE_URL });
const unitOfWork = createKnexUnitOfWork(db);

export const persistenceModule = defineContextModule({
  name: 'persistence',
  register(builder) {
    builder.rebind(UnitOfWork).toValue(unitOfWork);
    builder.bind(KnexContext).toValue(unitOfWork);
    builder.bind(OutboxStore).toClass(KnexOutboxStore, [KnexContext]);
    builder.rebind(ProcessedEventStore).toClass(KnexProcessedEventStore, [KnexContext]);
    builder.rebind(IntegrationEventPublisher).toClass(OutboxPublisher, [OutboxStore]);
  },
});
```

```ts
// main.ts
const app = createApplication({ modules: [kernelModule(), persistenceModule, contextModule('billing', billingDeclarations)] });
```

List the module after `kernelModule()`: `rebind` replaces its in-memory defaults. The command
bus of the kernel module runs every command in the bound `UnitOfWork`; handlers do not know it.
`contextModule` of `@ddd-ts-kit/di` turns the declared classes of a context into its module.

A project written by the CLI holds the same wiring in two files:
`platform/database/persistence-over.ts` builds the unit of work and the two stores once, and
`platform/platform.module.ts` binds them, the outbox publisher being given to
`kernelModule({ eventPublisher })`.

`toClass` builds the stores with their default options (tables `outbox` and
`processed_events` in the default schema of the connection). A store with options is built by
a factory:

```ts
builder
  .bind(OutboxStore)
  .toFactory((resolve) => new KnexOutboxStore(resolve(KnexContext), { schema: 'messaging' }));
builder
  .rebind(ProcessedEventStore)
  .toFactory((resolve) => new KnexProcessedEventStore(resolve(KnexContext), { schema: 'messaging' }));
```

The relay reads the same store and hands the records to the broker:

```ts
const relay = new OutboxRelay({ store: app.resolve(OutboxStore), publisher: broker, clock: app.resolve(Clock) });
relay.start({ intervalMs: 500 });
```

`unitOfWork.run(work)` opens `knex.transaction` and keeps the transaction in an
`AsyncLocalStorage`; a nested `run` joins the outer transaction (no savepoint). Because
`append` uses the current transaction, an event published by a handler that then fails is
rolled back with the business write: that is the whole point of the outbox.
`createKnexUnitOfWork(db, { isolationLevel: 'repeatable read' })` forwards the transaction
configuration of knex.

`KnexContext` is an abstract class, so it is its own injection token. A project with two
databases gives each a class of its own (`export abstract class Ledger extends KnexContext {}`
in `platform/database/`) and binds each to its unit of work.

## Repository

The port lives in the domain, the adapter in infrastructure. A repository receives the context,
never a transaction: `executor()` is the transaction of the unit of work when there is one and
the root knex instance otherwise.

```ts
// contexts/billing-core/domain/repositories/invoice.repository.ts
import { Repository } from '@ddd-ts-kit/kernel';

export abstract class InvoiceRepository extends Repository<Invoice> {}
```

```ts
// contexts/billing-core/infrastructure/persistence/knex-invoice.repository.ts
import type { Knex } from 'knex';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { insertIgnoringConflict, KnexContext, optimisticUpdate, schemaNameOf } from '@ddd-ts-kit/knex';

const BILLING = schemaNameOf('billing-core'); // billing_core

interface InvoiceRow {
  id: string;
  amount: number;
  status: 'draft' | 'issued';
  version: number;
}

@Repository(InvoiceRepository, [KnexContext])
export class KnexInvoiceRepository implements InvoiceRepository {
  constructor(private readonly context: KnexContext) {}

  async findById(id: string): Promise<Invoice | undefined> {
    const row = await invoicesOf(this.context).where({ id }).first();

    if (row === undefined) {
      return undefined;
    }

    const invoice = Invoice.rehydrate(row);
    invoice.version = row.version;

    return invoice;
  }

  async save(invoice: Invoice): Promise<void> {
    await optimisticUpdate(invoice, async ({ expected, next }) => {
      const row = { ...invoice.state, version: next };

      if (expected === 0) {
        const inserted = await insertIgnoringConflict(this.context.executor(), invoicesOf(this.context), { row, conflict: 'id' });

        return inserted ? 1 : 0;
      }

      return invoicesOf(this.context).where({ id: invoice.id, version: expected }).update(row);
    });
  }
}

// A function, not a method: see below.
function invoicesOf(context: KnexContext): Knex.QueryBuilder<InvoiceRow, InvoiceRow[]> {
  return context.executor()<InvoiceRow, InvoiceRow[]>('invoices').withSchema(BILLING);
}
```

**No method of an adapter answers a query builder.** A knex builder is thenable, and what
wraps an adapter from outside (the spans of `@ddd-ts-kit/tracing`, an aspect) reads a method
that answered a thenable as asynchronous: from its second call the method answers a promise
of the rows, and `.where(...)` on it fails. The table is therefore reached through a function
of the module, as the repository the CLI generates does, and a private method that runs a
statement is declared `async`.

In the explicit style, without the decorator, the same binding is one line of
`<context>.module.ts`:
`builder.bind(InvoiceRepository).toClass(KnexInvoiceRepository, [KnexContext])`.

`optimisticUpdate` gives the version to expect and the version to write, raises a
`ConcurrencyError` (a `DomainError` with code `CONCURRENCY_CONFLICT`) when the guarded
statement wrote no row, and moves `invoice.version` on otherwise. `insertIgnoringConflict`
inserts unless the key exists and says whether it did; unlike a caught unique violation it
leaves the surrounding PostgreSQL transaction usable, and it hides the one place where the
dialects differ (`RETURNING` on PostgreSQL and SQLite, the affected-row count on MySQL).

## Audit columns, tenant scoping and pages

The standard persistence shapes of the kernel, on knex. Four small helpers, so that the columns
have the same names in every project (`created_at`, `created_by`, `updated_at`, `updated_by`,
`tenant_id`), which is what lets a dashboard, an export or the audit package be written once:
`auditColumns(table)` and `tenantColumn(table)` for the migration, `auditRow(stamp)` and
`tenantRow(scoped)` to turn the kernel `AuditStamp` and `TenantScoped` into those column names,
since a knex row is keyed by column.

```ts
import { auditColumns, tenantColumn } from '@ddd-ts-kit/knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.withSchema(BILLING).createTable('invoices', (table) => {
    table.text('id').primary();
    table.integer('amount').notNullable();
    table.text('status').notNullable();
    table.integer('version').notNullable();
    tenantColumn(table);
    auditColumns(table);
    table.index(['tenant_id', 'amount', 'id'], 'invoices_tenant_amount_idx');
  });
}
```

```ts
import { Clock, ExecutionScope, stampCreation, stampUpdate, tenantScopeOf } from '@ddd-ts-kit/kernel';
import { auditRow, tenantRow, type AuditRow, type TenantRow } from '@ddd-ts-kit/knex';

interface InvoiceRow extends VersionedInvoice, TenantRow, AuditRow {}

@Repository(InvoiceRepository, [KnexContext, ExecutionScope, Clock])
export class KnexInvoiceRepository implements InvoiceRepository {
  constructor(
    private readonly context: KnexContext,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Invoice | undefined> {
    const row = await invoicesOf(this.context).where({ id, ...this.ownTenant() }).first();

    return row === undefined ? undefined : InvoiceMapper.toDomain(row);
  }

  async save(invoice: Invoice): Promise<void> {
    await optimisticUpdate(invoice, async ({ expected, next }) => {
      const state = { ...InvoiceMapper.toRow(invoice), version: next };

      return expected === 0 ? this.insert(state) : this.update(state, expected);
    });
  }

  private async insert(state: VersionedInvoice): Promise<number> {
    const row = { ...state, ...this.ownTenant(), ...auditRow(stampCreation(this.scope, this.clock)) };
    const inserted = await insertIgnoringConflict(this.context.executor(), invoicesOf(this.context), { row, conflict: 'id' });

    return inserted ? 1 : 0;
  }

  private async update(state: VersionedInvoice, expected: number): Promise<number> {
    return invoicesOf(this.context)
      .where({ id: state.id, version: expected, ...this.ownTenant() })
      .update({ ...state, ...auditRow(stampUpdate(this.scope, this.clock)) });
  }

  private ownTenant(): TenantRow {
    return tenantRow(tenantScopeOf(this.scope));
  }
}
```

A list query takes the kernel `PageRequest` and answers a `Page`, in both variants:

```ts
// contexts/billing-core/application/ports/invoice-queries.port.ts
export abstract class InvoiceQueries {
  abstract list(request: PageRequest<'amount'>): Promise<Page<InvoiceSummary>>;
}
```

```ts
// contexts/billing-core/infrastructure/persistence/knex-invoice-queries.reader.ts
import { ExecutionScope, encodeCursor, pageOf, tenantScopeOf } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';

@Repository(InvoiceQueries, [KnexContext, ExecutionScope])
export class KnexInvoiceQueries implements InvoiceQueries {
  constructor(
    private readonly context: KnexContext,
    private readonly scope: ExecutionScope,
  ) {}

  async list(request: PageRequest<'amount'>): Promise<Page<InvoiceSummary>> {
    return request.kind === 'offset' ? this.byOffset(request) : this.byCursor(request);
  }

  private async byOffset(request: OffsetPageRequest<'amount'>): Promise<Page<InvoiceSummary>> {
    const rows = await ownInvoices(this.context, this.scope)
      .orderBy(totalOrder(directionOf(request)))
      .limit(request.limit)
      .offset(request.offset);
    const counted = await ownInvoices(this.context, this.scope).count<{ total: string | number }[]>({ total: '*' }).first();

    return pageOf(rows.map(toSummary), { total: Number(counted?.total ?? 0) });
  }

  private async byCursor(request: CursorPageRequest<'amount'>): Promise<Page<InvoiceSummary>> {
    const direction = directionOf(request);
    const query = ownInvoices(this.context, this.scope).orderBy(totalOrder(direction)).limit(request.limit + 1);
    const rows = await (request.cursor === undefined ? query : beyond(query, positionOf(request.cursor), direction));
    const items = rows.slice(0, request.limit);
    const last = items.at(-1);
    const more = rows.length > request.limit && last !== undefined;

    return pageOf(items.map(toSummary), more ? { nextCursor: encodeCursor({ amount: last.amount, id: last.id }) } : {});
  }
}

function ownInvoices(context: KnexContext, scope: ExecutionScope) {
  return invoicesOf(context).where(tenantRow(tenantScopeOf(scope)));
}

const directionOf = (request: PageRequest<'amount'>) => request.sort[0]?.direction ?? 'asc';

// The primary key follows the sort field, in the same direction: the order is total.
const totalOrder = (direction: SortDirection) => [
  { column: 'amount', order: direction },
  { column: 'id', order: direction },
];

// The rows after a position, as a tuple comparison: the tie-breaker decides among equals.
function beyond(query: Knex.QueryBuilder, { amount, id }: { amount: number; id: string }, direction: SortDirection) {
  const past = direction === 'asc' ? '>' : '<';

  return query.where((after) => {
    void after.where('amount', past, amount).orWhere((tied) => {
      void tied.where('amount', amount).where('id', past, id);
    });
  });
}
```

`positionOf(cursor)` decodes with `decodeCursor` and checks that `amount` is a number and `id`
a string, raising `InvalidPageRequestError` otherwise.

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

`criteriaToKnex(builder, plan, columns)` adds a criteria plan of the kernel to a query: the
filters and the scope of the actor, the keyset of a cursor page, the total order ended by the
tie-breaker, the window. `predicateToKnex(builder, predicate, columns)` adds the filters alone,
for a count. `columns` maps each field of the read model to its column, and is the only source
of identifiers: every value is a binding, a text search is `like ? escape ?` with `%`, `_` and
`\` escaped.

```ts
// infrastructure/persistence/knex-appointment-queries.reader.ts
async list(criteria: ScopedCriteria<AppointmentRow>): Promise<Page<AppointmentRow>> {
  const plan = planCriteria(appointmentCriteria, criteria);

  if (plan.empty) return pageOfPlan(plan, []);

  const rows = await criteriaToKnex(this.context.executor()<AppointmentRow>('appointment_list'), plan, COLUMNS);

  return pageOfPlan(plan, rows.map(toRow));
}
```

A cursor page is fetched one row longer than asked, which is how `pageOfPlan` knows whether
another follows; an offset page takes its total from a second statement
(`predicateToKnex(...).count()`). A field declared `nullable` is ordered `nulls last`
ascending and `nulls first` descending on every dialect.

**Strings.** A text column is ordered and compared by range in the collation of the column;
criteria order strings by code point. Declare the text columns that are sorted or compared
with `gt`, `lt` or `between` with `COLLATE "C"`: the index then serves the sort, and the
order is the same as in the fake. **Decimals** are a `numeric` column and a string in the
row; they read back in the scale of the column. **Instants** are `timestamptz` and a `Date`.
An integer is `integer`: a `bigint` comes back as a string from the driver.

## Read models

```ts
// the migration
await knex.schema.withSchema('scheduling').createTable('appointment_list', (table) => {
  table.text('id').primary();
  table.text('status').notNullable();
  table.datetime('starts_at', { useTz: true, precision: 3 }).notNullable();
  readModelColumns(table); // last_event_id, last_event_at, last_event_version, deleted
});

// infrastructure/persistence/knex-appointment-list.repository.ts
@Repository(AppointmentList, [KnexContext])
export class KnexAppointmentList extends KnexReadModelStore<AppointmentRow> implements AppointmentList {
  constructor(context: KnexContext) {
    super(context, {
      schema: 'scheduling',
      table: 'appointment_list',
      columns: { id: 'id', status: 'status', startsAt: 'starts_at' },
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
Criteria and read models were never run on MySQL or SQLite.

## Outbox and idempotency

- `KnexOutboxStore.claimBatch` selects the due rows `FOR UPDATE SKIP LOCKED` and leases them in
  the same short transaction by pushing `next_attempt_at` forward (`leaseMs`, default 30 s), so
  several relays share the work without waiting for each other, and the records of a relay
  that died come back when the lease expires. Delivery is at least once, unordered.
- Where the database has no `SKIP LOCKED` (SQLite), or when you pass
  `claim: 'compare-and-set'`, the claim reads the due rows and takes each one with an update
  guarded by the attempt count it read: same guarantee, no lock clause, one statement per
  record. The default is `skip-locked` on PostgreSQL and MySQL, `compare-and-set` elsewhere.
- `KnexProcessedEventStore.markProcessed` is an insert ignoring the conflict on
  `(consumer, event_id)`. Run the consumer inside the unit of work: the mark then commits with
  the effects of the handler, and disappears with them if it fails.

## Dialect coverage

What follows is about this package. The CLI generates for PostgreSQL only: `init --orm knex`
refuses `--database mysql` and `--database sqlite`.

| Database | Status |
|---|---|
| PostgreSQL | Covered by the automated suite: contract suites of `@ddd-ts-kit/testing`, repository contract, rollback, nested unit of work, concurrent claims. It runs on PGlite served over the PostgreSQL wire protocol by default, and on a real server when `DDD_TS_KIT_TEST_DATABASE_URL` is set (last run: PostgreSQL 18). |
| MySQL 8 | Not in the automated suite. The outbox and processed-event contract suites and the rollback of `append` were run once by hand against MySQL 8.4 with `mysql2`, with `skip-locked` and `compare-and-set`. |
| SQLite | Not in the automated suite. The same suites were run once by hand with `better-sqlite3`. No `SKIP LOCKED`: the claim is `compare-and-set`. No schemas: `createOutboxTables` refuses `schema`, name the tables per context instead. |
| MariaDB, CockroachDB, SQL Server, Oracle | Never run. MariaDB stores JSON as text, so the payload would come back as a string. |

## Limits

- MySQL `DATETIME` has no time zone and knex converts dates in the time zone of the process:
  give every process the same one, or set `timezone: 'Z'` on the connection.
- On MySQL 5.7 and MariaDB before 10.6 there is no `SKIP LOCKED`: pass
  `claim: 'compare-and-set'`.
- The outbox payload is serialized with `JSON.stringify`, so it must be JSON, which the
  integration event contract already requires. An `undefined` payload is stored as SQL `NULL`
  and read back as `null`.
- Ordering is not guaranteed, not even per aggregate: a failed event is retried later while its
  successors go out.

## Testing an adapter

The stores of this package pass `outboxStoreContract` and `processedEventStoreContract` of
`@ddd-ts-kit/testing/contracts`. Hold your repositories to `repositoryContract` the same way,
next to their in-memory fake. The tests of this package need no container:

```
npx vitest run packages/knex
DDD_TS_KIT_TEST_DATABASE_URL=postgresql://user:password@localhost:5432/postgres npx vitest run packages/knex
```

With the variable set, each spec file creates a database of its own on that server and drops
it afterwards, and the tests that need two real connections (a relay passing over rows locked
by another one) run instead of being skipped.

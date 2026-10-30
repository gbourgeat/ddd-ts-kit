**English** · [Français](README.fr.md)

# @ddd-ts-kit/knex

Knex adapters of the kernel and events ports: a unit of work that repositories never see, the
transactional outbox store, the processed-event store, a migration helper for their tables,
and one database schema per bounded context. Same pieces as `@ddd-ts-kit/drizzle`, for projects
that build their SQL with knex. Around them: the helpers of a repository (optimistic
concurrency, audit and tenant columns, pages), the four tenant isolation strategies, criteria
and read models, and the stores of the event store, the background jobs and the process
managers.

```
npm i @ddd-ts-kit/knex knex pg
```

PostgreSQL first. MySQL 8 and SQLite work through the same code, see
[Dialect coverage](#dialect-coverage) for what is tested and how.

## Where it sits in an application

Nothing here is imported from `domain/` or `application/`. The domain declares its repository
ports and the application its query ports; the adapters written with this package live in the
`infrastructure/` of each context, and the unit of work is built in `platform/`. One object is
the hinge: `createKnexUnitOfWork(db)` answers the `UnitOfWork` the command bus runs every
command in, and the `KnexContext` every adapter reaches the database through.

![The command bus calls run on the UnitOfWork port; repositories, readers, the stores of the package and the audit trail call executor on the KnexContext port; both ports are the one object createKnexUnitOfWork answers, which keeps the open transaction in an AsyncLocalStorage, so every statement of a command runs in one PostgreSQL transaction, one schema per context](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/knex-place-in-an-application.svg)

Instead of handing a transaction down the calls, which puts a knex type in every signature from
the handler to the adapter and makes forgetting it a silent bug, the adapter asks the context
where its statement runs:

<!-- checked sample -->
```ts
import { knex, type Knex } from 'knex';
import { createKnexUnitOfWork, KnexContext } from '@ddd-ts-kit/knex';

declare const config: { readonly databaseUrl: string };

interface InvoiceRow {
  id: string;
  status: 'draft' | 'issued';
}

// Instead of `issue(id: string, transaction: Knex.Transaction)`, threaded from the handler:
export class KnexInvoiceIssuer {
  constructor(private readonly context: KnexContext) {}

  async issue(id: string): Promise<void> {
    await invoicesOf(this.context).where({ id }).update({ status: 'issued' });
  }
}

function invoicesOf(context: KnexContext): Knex.QueryBuilder<InvoiceRow, InvoiceRow[]> {
  return context.executor()<InvoiceRow, InvoiceRow[]>('invoices').withSchema('billing_core');
}

const db = knex({ client: 'pg', connection: config.databaseUrl });
const unitOfWork = createKnexUnitOfWork(db);
const issuer = new KnexInvoiceIssuer(unitOfWork); // the unit of work is the KnexContext too

// Both updates run in the transaction `run` opened: they commit, or roll back, together.
await unitOfWork.run(async () => {
  await issuer.issue('inv-1');
  await issuer.issue('inv-2');
});

// Outside of `run`, `executor()` answers `db`: the update runs on its own.
await issuer.issue('inv-3');
```

In an application the command bus calls `run` for you, and so do the consumers of
`@ddd-ts-kit/di`, so a handler never sees it; a script, or a consumer wired by hand, calls it
itself. With the CLI, `init --orm knex` writes this wiring, see
[Composition root](#composition-root).

## Tables

The consuming project owns its migrations. `createOutboxTables` is a helper to call from one of
them:

<!-- checked sample -->
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

A multi-tenant project keeps the tenant of each event, so that its consumers run in that tenant:
`createOutboxTables(knex, { schema: 'messaging', tenant: true })` adds a nullable `tenant_id`
(`addOutboxTenantColumn(knex, { schema: 'messaging', tenantOfUnpublished: 'acme' })` is the
migration of a project that becomes multi-tenant: the events not published yet go to the tenant
the database served, or keep none and are refused by tenant-scoped consumers if it is left out), and `new KnexOutboxStore(context, { schema: 'messaging', tenant: true })` writes
it. A table that has the column is read back either way.

One schema per bounded context: `schemaNameOf('order-management')` gives `order_management`,
to pass to `knex.schema.createSchemaIfNotExists`, `knex.schema.withSchema` and
`.withSchema(...)` on queries. Contexts never join each other's tables.

## Composition root

`createKnexUnitOfWork(db)` gives one object that is two ports: the kernel `UnitOfWork`, and
`KnexContext`, the handle repositories and stores run their queries on. Bind it to both:

<!-- checked sample -->
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

declare const config: { readonly databaseUrl: string }; // the configuration of the platform

const db = knex({ client: 'pg', connection: config.databaseUrl });
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
`platform/database/persistence-over.ts` builds the unit of work and its stores once, and
`platform/composition/platform.module.ts` binds them, the outbox publisher being given to
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

`run` is built on `withinUnitOfWork` of the kernel. The domain events of the aggregates saved
inside it wait until `work` has returned, then are dispatched inside the transaction, before
the commit: their handlers see every save, and what they write commits or rolls back with it.
If `work`, a handler or the commit fails, nothing is left: no row, no outbox record, no handler
run after the commit. Handlers declared `after-commit` run once the transaction has committed.
A nested `run` joins the unit of work in progress: one dispatch, at the end of the outermost.
A `run` called directly (a consumer, a script) has the same timing as a command.
`unitOfWorkContract` of `@ddd-ts-kit/testing/contracts` proves it, with a deferred constraint
for the commit that fails; on a real PostgreSQL (`DDD_TS_KIT_TEST_DATABASE_URL`) it also proves
that the rows of a `before-commit` handler are invisible from another connection and visible
to the `after-commit` handlers.

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

<!-- checked sample -->
```ts
// contexts/billing-core/infrastructure/persistence/knex-invoice.repository.ts
import type { Knex } from 'knex';
import { AggregateRoot } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { insertIgnoringConflict, KnexContext, optimisticUpdate, schemaNameOf } from '@ddd-ts-kit/knex';

const BILLING = schemaNameOf('billing-core'); // billing_core

interface InvoiceRow {
  id: string;
  amount: number;
  status: 'draft' | 'issued';
  version: number;
}

// What the domain of the context holds, declared so that this file reads alone.
type InvoiceState = Omit<InvoiceRow, 'version'>;

declare class Invoice extends AggregateRoot {
  static rehydrate(state: InvoiceState): Invoice;
  readonly state: InvoiceState;
}

declare abstract class InvoiceRepository {
  abstract findById(id: string): Promise<Invoice | undefined>;
  abstract save(invoice: Invoice): Promise<void>;
}

@Repository(InvoiceRepository)
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
statement is declared `async`:

<!-- checked sample -->
```ts
import type { Knex } from 'knex';
import { KnexContext } from '@ddd-ts-kit/knex';

interface InvoiceRow {
  id: string;
  amount: number;
}

// Instead of a method that answers the builder: once a span wraps the adapter, the second call
// of `invoices()` answers a promise of the rows, and `.where(...)` on it throws.
export class FragileInvoiceTotals {
  constructor(private readonly context: KnexContext) {}

  async totalOf(id: string): Promise<number | undefined> {
    return (await this.invoices().where({ id }).first())?.amount;
  }

  private invoices(): Knex.QueryBuilder<InvoiceRow, InvoiceRow[]> {
    return this.context.executor()<InvoiceRow, InvoiceRow[]>('invoices');
  }
}

// Write: the table is reached through a function of the module, and every method is async.
export class KnexInvoiceTotals {
  constructor(private readonly context: KnexContext) {}

  async totalOf(id: string): Promise<number | undefined> {
    return (await invoicesOf(this.context).where({ id }).first())?.amount;
  }
}

function invoicesOf(context: KnexContext): Knex.QueryBuilder<InvoiceRow, InvoiceRow[]> {
  return context.executor()<InvoiceRow, InvoiceRow[]>('invoices');
}
```

In the explicit style, without the decorator, the same binding is one line of
`<context>.module.ts`:
`builder.bind(InvoiceRepository).toClass(KnexInvoiceRepository, [KnexContext])`.

`optimisticUpdate` gives the version to expect and the version to write, raises a
`ConcurrencyError` (a `DomainError` with code `CONCURRENCY_CONFLICT`) when the guarded
statement wrote no row, and moves `invoice.version` on otherwise. `insertIgnoringConflict`
inserts unless the key exists and says whether it did; unlike a caught unique violation it
leaves the surrounding PostgreSQL transaction usable, and it hides the one place where the
dialects differ (`RETURNING` on PostgreSQL and SQLite, the affected-row count on MySQL).

![Two transactions load invoice inv-1 at version 3; the first saves, its update matches version 3 and the row moves to version 4; the second saves afterwards, its update still expects version 3, writes no row, and optimisticUpdate throws ConcurrencyError, code CONCURRENCY_CONFLICT](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/persistence-optimistic-concurrency.svg)

The second writer is refused instead of silently overwriting the first. Nothing retries it for
you: the caller receives the `ConcurrencyError` and decides whether to load the invoice again.

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

@Repository(InvoiceRepository)
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

A search query takes the kernel `PageRequest` and answers a `Page`, in both variants:

```ts
// contexts/billing-core/application/ports/invoice-queries.port.ts
export abstract class InvoiceQueries {
  abstract search(request: PageRequest<'amount'>): Promise<Page<InvoiceSummary>>;
}
```

```ts
// contexts/billing-core/infrastructure/persistence/knex-invoice-queries.reader.ts
import { ExecutionScope, encodeCursor, pageOf, tenantScopeOf } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';

@Repository(InvoiceQueries)
export class KnexInvoiceQueries implements InvoiceQueries {
  constructor(
    private readonly context: KnexContext,
    private readonly scope: ExecutionScope,
  ) {}

  async search(request: PageRequest<'amount'>): Promise<Page<InvoiceSummary>> {
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

What the cursor buys, on invoices sorted by amount, when a row is inserted between two pages:

![Invoices in total order by amount then id; page 1 reads four rows for a limit of 3 and keeps the position of the last, amount 40 and id inv-7, as its cursor; after an invoice of 10 is inserted, page 2 by offset 3 reads inv-7 a second time, while page 2 after the cursor compares the position as a tuple and answers inv-9, inv-2 and inv-4, nothing repeated, nothing skipped, no count](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/knex-cursor-page.svg)

## Tenant isolation

Four strategies, chosen per project ([Multitenancy](../../docs/concepts/multitenancy.md) says
when each fits). Every one of them is proven here by `tenantIsolationContract` of
`@ddd-ts-kit/testing/contracts`, on PGlite and on PostgreSQL.

![The four strategies from the most shared to the most separated, and the helpers of each: shared tables with tenantColumn, tenantTable, ownTenantTable, tenantRow and whereTenant; row-level security with enableTenantIsolation or tenantIsolationStatements, tenantSession and a role without BYPASSRLS; schema per tenant with tenantSchemaOf, tenantSchemaTable, tenantOfMigration, migrateTenantSchema and tenantSearchPath; database per tenant with TenantDatabases, createTenantRoutedUnitOfWork and migrateEveryTenant](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/knex-tenant-isolation-helpers.svg)

**Shared tables.** One table per aggregate, a `tenant_id` column, and every statement confined
by the kit instead of by a condition written by hand:

```ts
const INVOICES = { schema: BILLING, table: 'invoices' };

// reads: the tenant of the work, or the tenants of an elevation
const row = await tenantTable<InvoiceRow>(this.context, this.scope, INVOICES).where({ id }).first();
// updates and deletes: the one tenant of the work, which an elevation never widens
await ownTenantTable<InvoiceRow>(this.context, this.scope, INVOICES).where({ id, version: expected }).update(changes);
// inserts name the tenant themselves
const inserted = { ...state, ...tenantRow(tenantScopeOf(this.scope)), ...auditRow(stampCreation(this.scope, this.clock)) };
```

`whereTenant(builder, scope)` is the condition alone, for a builder of your own. Work that names
no tenant raises `NoCurrentTenantError` before any SQL. The three keep the condition a conjunct of
the statement: SQL binds `and` before `or`, so `.orWhere*` and `.or` at the top of their builder
throw `UngroupedOrError` and the alternatives go in a group,
`.where((either) => either.where(a).orWhere(b))`; the text of a `whereRaw`, or a `knex.raw` given
to a where, is kept in parentheses as one conjunct, with its bindings; `clearWhere()` and
`clear('where')` throw `ClearedTenantConditionError`. An `orHaving` applies after the where, and
is free. A read model of tenant data passes
`tenant: scope` to `KnexReadModelTable` and `KnexReadModelStore`: each row is written with the
tenant of the work and every read and write is confined to it (keys stay unique across tenants;
a rebuild, which runs in no tenant, is refused).

A measure grouped by a scoped query, then filtered, sorted and paged by its output columns,
selects from it with `derivedTable(context, grouped, 'occupancy')`: the grouped query is the one
that reaches the table, through `tenantTable`. A project of one customer that becomes
multi-tenant adds the column to each table of tenant data in a migration,
`addTenantColumn(knex, { schema, table, tenantOfExistingRows: 'acme' })`: the rows already there
go to that tenant (refused when there are rows and no tenant), then the column is required and
indexed; a table that already has it is left alone.

**Row-level security**, a second line on shared tables: the database itself refuses a row of
another tenant, even to a statement that forgot its condition.

```ts
// the migration that creates the table
await enableTenantIsolation(knex, INVOICES); // enable, force on the owner, one policy per command

// the composition root
const unitOfWork = createKnexUnitOfWork(knex, undefined, { begin: tenantSession(executionScope) });
```

`tenantSession` sets the tenant settings for each transaction only (`set_config(..., true)`), so
a pooled connection never carries a tenant into the next one: `ddd_ts_kit.tenant_id`, and for an
elevation `ddd_ts_kit.reach` (the tenants listed) or `ddd_ts_kit.every_tenant`. There is one
policy per command: a select sees the tenant of the work and what an elevation reaches; an
insert, an update and a delete only ever touch the tenant of the work, so an elevated
`delete from invoices` without a condition removes no other tenant's row.
`tenantIsolationStatements(target)` gives the SQL for a migration written by hand. Three
conditions hold it: the application connects with a role that is **not a superuser and has no
`BYPASSRLS`** (both ignore every policy); every statement runs **inside the unit of work** (a
statement outside of a transaction carries no setting and sees nothing, so queries go through the
unit of work too); migrations run as the owner, outside of it.

**Schema per tenant.** The tables of a context exist once per tenant, in `<schema>__<tenant>`
(`tenantSchemaOf('billing', 'acme')`; a tenant id that a schema name could not hold as it is, is
refused rather than altered). `tenantSchemaTable(context, scope, { schema: BILLING, table:
'invoices' })` reaches the tenant's copy. The tenant migrations live in a directory of their own
and name their schema from the tenant they run for:

```ts
export async function up(knex: Knex): Promise<void> {
  const schema = tenantSchemaOf(BILLING, tenantOfMigration(knex));

  await knex.schema.createSchemaIfNotExists(schema);
  await knex.schema.withSchema(schema).createTable('invoices', (table) => { /* ... */ });
}
```

`migrateTenantSchema(knex, tenantId, { directory: 'migrations/tenant' })` applies them for one
tenant and records them in `migrations__<tenant>`, so each tenant moves on its own and a new
tenant is provisioned by its first run. `tenantSearchPath(scope, [BILLING])` is a `begin` that
sets the search path of each transaction to the tenant's schemas only, for SQL that names no
schema. An elevation does not reach several schemas at once: staff read one tenant at a time.

**Database per tenant.** `new TenantDatabases({ connectionOf: (tenantId) => configOf(tenantId),
maxTenants: 20 })` opens one knex (one bounded pool) per tenant on first use. At most
`maxTenants` instances exist at once, those still closing included, so the server never has to
accept more than `maxTenants * pool.max` connections per instance of the application. Work holds
the instance of its tenant by a lease (`databases.lease(tenantId, (knex) => ...)`): an instance is
closed only when no work holds it, the least recently used first, and work for another tenant
waits for a place instead of opening beyond the bound. `createTenantRoutedUnitOfWork(databases,
scope)` is the unit of work and `KnexContext`: each transaction holds a lease on the database of
the tenant of the work until it ends; every statement runs inside it
(`StatementOutsideUnitOfWorkError` otherwise, so queries go through the unit of work too), work
that names no tenant reaches no database, and work of another tenant never joins an open
transaction (`CrossTenantUnitOfWorkError`). `migrateEveryTenant(databases, directory, migrate)`
applies the migrations to every tenant of a `TenantDirectory`, stopping at the first failure and
naming its tenant.

## Criteria

`criteriaToKnex(builder, plan, columns)` adds a criteria plan of the kernel to a query: the
filters and the scope of the actor, the keyset of a cursor page, the total order ended by the
tie-breaker, the window. `predicateToKnex(builder, predicate, columns)` adds the filters alone,
for a count. `columns` maps each field of the read model to its column, and is the only source
of identifiers: every value is a binding, a text search is `like ? escape ?` with `%`, `_` and
`\` escaped.

```ts
// infrastructure/persistence/knex-appointment-queries.reader.ts
async search(criteria: ScopedCriteria<AppointmentRow>): Promise<Page<AppointmentRow>> {
  const plan = planCriteria(appointmentCriteria, criteria);

  if (plan.empty) {
    return pageOfPlan(plan, []);
  }

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
@Repository(AppointmentList)
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

## Personal data erasure

The erasure of a data subject from the tables of a context, from the `personalFields` declarations
written next to its mappers (`@ddd-ts-kit/kernel`, "Personal data"): `KnexPersonalDataErasure` implements
the `PersonalDataErasure` port over the executor of the unit of work. The port of the context extends the one of the kernel, and
its adapter extends this class.

```ts
// infrastructure/persistence/person.personal-fields.ts
export const personPersonalFields = personalFields<PersonRow, TenantTableTarget>(PERSONS, {
  subject: 'id',
  fields: ['display_name', 'email'],
  erasure: 'row',
});

// application/ports/identity-erasure.port.ts
export abstract class IdentityErasure extends PersonalDataErasure {}

// infrastructure/persistence/knex-identity-erasure.repository.ts
@Repository(IdentityErasure)
export class KnexIdentityErasure extends KnexPersonalDataErasure implements IdentityErasure {
  constructor(database: KnexContext, scope: ExecutionScope, files: FileStorage) {
    super(database, { name: 'identity.persons', declarations: [personPersonalFields], tenant: scope, files });
  }
}
```

`erase(subject)` deletes the files the rows name from the storage first, then deletes the rows of
the subject (`row`) or pseudonymises them (`pseudonymise`: a text column reads `[erased]`, a column
of any other type reads nothing, a file column nothing), and answers how many rows it reached, none
the second time. With `tenant`, every statement is confined to the tenant of the work and never
widened by an elevation (`tenant_id`, or the `column` of the target); without it, the table holds the rows of every tenant. A subject
that is not an opaque identifier is refused before any statement, and a declaration that names file
columns without a file storage is refused when the adapter is built. The types of the columns are read once from the database (`columnInfo`), so that a text and a number are pseudonymised each its own way. A personal column
that is not a text has to accept null, or the rows are erased with `row`: a declaration that would
pseudonymise one that does not is refused before any file or row is touched
(`NotNullablePersonalColumnError`). The adapter passes
`personalDataErasureContract` of `@ddd-ts-kit/testing`, as the in-memory one does, on PGlite and
PostgreSQL. What an erasure does not reach, and the whole chain (`eraseDataSubject`: the key, every
copy in every tenant, the rebuilds), is in the README of the kernel ("Personal data").

`KnexPersonalDataExport` answers the right of access and to portability from the same declarations:
`exportOf(subject)` hands over one `PersonalDataRecord` per row about the subject in every declared
table, under `<name>.<table>`, with each personal column and each file column (by its key) as plain
data, by their SQL names, no other column and nothing of anyone else; a row pseudonymised already
answers what it reads. The same `tenant` option confines every statement to the tenant of the work, a
subject that is not an opaque identifier is refused before any statement, and the adapter passes
`personalDataExportContract`. The port of the context extends `PersonalDataExport` of the kernel and
its adapter extends this class with `name`, `declarations` and `tenant` (`KnexPersonalDataExportOptions`);
`generate repository --personal` writes both adapters, and `exportDataSubject` of the kernel gathers
every export into one dated document. Wrap the adapter with `auditedPersonalDataExport` of
`@ddd-ts-kit/audit` where it is bound, so that each handover leaves an entry.

The same declarations give the storage limitation (GDPR article 5(1)(e)): a declaration with
`retention: { after: 'ended_at', months: 36 }` says how long its rows keep the person, counted from a
date column of the row, and `purgeExpired(now)` of the erasure adapter erases, as the declaration
says, the rows whose date is older than the period; a row whose date is empty never expires, and a
second run reaches nothing. It confines itself to the tenant of the work when the work names one,
and reaches every tenant when it names none, as the nightly job of the platform does: a tenant left
out of a list would keep what it should not. The adapter implements `PersonalDataRetention` of the
kernel and passes `personalDataRetentionContract`; `purgeExpiredPersonalData` of the kernel runs
every copy, and `auditedPersonalDataRetention` of `@ddd-ts-kit/audit` records each purge.

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

The life of one record in the `outbox` table. The relay of `@ddd-ts-kit/events` drives it through
`claimBatch`, `markPublished` and `markFailed`; `retryDead`, `purgePublished` and `stats` are
called by an operator or a scheduled job, never by the relay:

![A record is appended pending by the commit of the command; the relay claims it when due and publishes it, then marks it published, and purgePublished removes it later; a failed publication leaves it pending, retried after an exponential backoff; after the last attempt it is dead until retryDead puts it back pending; stats counts pending, failed and dead records](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/transactional-outbox-record-lifecycle.svg)

## Event store

```ts
// a migration of the project
export const up = (knex) => createEventStoreTables(knex, { schema: 'scheduling' });

// the composition root
const { events, snapshots, checkpoints, subjectKeys } = createKnexEventSourcing(unitOfWork, { schema: 'scheduling' });
```

`createEventStoreTables` runs `eventStoreTablesSql` of the kernel: `stored_events`,
`stored_events_head`, `stream_snapshots`, `subscription_checkpoints` and `subject_keys`, in the
schema of the context. `createKnexEventSourcing` refuses a knex that does not speak PostgreSQL.

Each statement runs on the executor of the context: an append joins the transaction of the
unit of work, so the stream and the outbox records its events publish commit together
(`eventStoreUnitOfWorkContract`). Appends take the head of the store, a row locked until their
transaction ends: positions are given in commit order, without gaps, and two appends never run
side by side, whatever their streams. PostgreSQL only. The stores are the ones of the kernel
(`PostgresEventStore` and its companions), held to `eventStoreContract` here; how an
event-sourced aggregate uses them: the README of `@ddd-ts-kit/kernel`, section "Event sourcing".

## Background jobs

`KnexJobStore` is the `JobStore` of `@ddd-ts-kit/scheduling` on PostgreSQL: the background jobs
of a context in a table of its schema, `createJobTable(knex, { schema })` called from a
migration. `add` runs on the executor of the context, so a job enqueued by a command is written
by the transaction of the command; claims select the due rows `FOR UPDATE SKIP LOCKED` in a
short transaction of their own and lease them. Bind it in the composition root:

```ts
kernelModule({ unitOfWork, jobStore: new KnexJobStore(unitOfWork, { schema: 'scheduling' }) });
```

```ts
// migrations/20261013090000_background-jobs.js
export const up = (knex) => createJobTable(knex, { schema: 'scheduling' });
export const down = (knex) => dropJobTable(knex, { schema: 'scheduling' });
```

The store passes `jobStoreContract`, its unit of work suite included, on PGlite and on
PostgreSQL. MySQL and SQLite are not covered: the table uses `jsonb` and a partial index.
What the jobs guarantee: [Background jobs](../../docs/concepts/background-jobs.md).

## Process managers

`KnexProcessStore` is the `ProcessStore` of the kernel: one row per tenant, process and correlation key
in `process_instances`, created by `createProcessTable(knex, { schema })` from a migration
(`dropProcessTable` is its `down`). A first save inserts, ignoring a row a concurrent first save
wrote; a next one updates the row at the previous version; a save that changes no row throws
`ConcurrencyError`. It runs on the executor of the context, in the transaction of the step, and
passes `processStoreContract` with its unit of work.

With `tenant` (the `ExecutionScope`), the store keeps each instance in the tenant of the work that
saves it: the table keys a row by its tenant too, the empty text outside any, so two tenants may
use the same correlation key; an instance of another tenant is neither found nor changed, and
work that names no tenant is refused with `NoCurrentTenantError`.

## Dialect coverage

What follows is about this package. The CLI generates for PostgreSQL only: `init --orm knex`
refuses `--database mysql` and `--database sqlite`.

| Database | Status |
|---|---|
| PostgreSQL | Covered by the automated suite: contract suites of `@ddd-ts-kit/testing`, repository contract, rollback, nested unit of work, concurrent claims. It runs on PGlite served over the PostgreSQL wire protocol by default, and on a real server when `DDD_TS_KIT_TEST_DATABASE_URL` is set (last run: PostgreSQL 18). |
| MySQL 8 | Not in the automated suite. The outbox and processed-event contract suites and the rollback of `append` were run once by hand against MySQL 8.4 with `mysql2`, with `skip-locked` and `compare-and-set`. |
| SQLite | Automated, in the unit run: the outbox and processed-event contract suites run on an in-memory database through `better-sqlite3`, with no container and no environment variable (`test/stores.sqlite.spec.ts`). No `SKIP LOCKED`: the claim is `compare-and-set`. No schemas: `createOutboxTables` refuses `schema`, name the tables per context instead. |
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

The unit of work of this package passes `unitOfWorkContract`, and its stores
`outboxStoreContract` and `processedEventStoreContract`, of `@ddd-ts-kit/testing/contracts`.
Hold your repositories to `repositoryContract` the same way, next to their in-memory fake: the
same suite then proves that the fake the handlers are tested with behaves as the adapter that
runs in production (found after a save, kept apart, later saves stored, unsaved changes ignored,
an unseen change refused with `CONCURRENCY_CONFLICT`).

<!-- checked sample -->
```ts
// contexts/billing-core/test/integration/knex-invoice.repository.spec.ts
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { knex } from 'knex';
import { AggregateRoot } from '@ddd-ts-kit/kernel';
import { createKnexUnitOfWork, KnexContext } from '@ddd-ts-kit/knex';
import { repositoryContract } from '@ddd-ts-kit/testing/contracts';

// The aggregate and the adapter of the context, declared so that this file reads alone.
declare class Invoice extends AggregateRoot {
  static draft(id: string, amount: number): Invoice;
  addCharge(amount: number): void;
  readonly state: { readonly amount: number; readonly status: 'draft' | 'issued' };
}

declare class KnexInvoiceRepository {
  constructor(context: KnexContext);
  findById(id: string): Promise<Invoice | undefined>;
  save(invoice: Invoice): Promise<void>;
}

declare const testDatabaseUrl: string; // a database of the test run, migrated

const db = knex({ client: 'pg', connection: testDatabaseUrl });
let next = 0;

afterAll(() => db.destroy());

repositoryContract<Invoice>(
  { describe, it, expect, beforeEach, afterEach },
  {
    name: 'KnexInvoiceRepository',
    createRepository: async () => {
      await db('invoices').withSchema('billing_core').delete();

      return new KnexInvoiceRepository(createKnexUnitOfWork(db));
    },
    createAggregate: () => Invoice.draft(`inv-${(next += 1)}`, 100),
    mutate: (invoice) => invoice.addCharge(50),
    idOf: (invoice) => invoice.id,
    stateOf: (invoice) => invoice.state,
  },
);
```

The tests of this package need no container:

```
npx vitest run packages/knex
DDD_TS_KIT_TEST_DATABASE_URL=postgresql://user:password@localhost:5432/postgres npx vitest run packages/knex
```

With the variable set, each spec file creates a database of its own on that server and drops
it afterwards, and the tests that need two real connections (a relay passing over rows locked
by another one) run instead of being skipped.

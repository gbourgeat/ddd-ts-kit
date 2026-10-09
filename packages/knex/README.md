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

```ts
// main.ts
import knex from 'knex';
import { InMemoryCommandBus, SystemClock, unitOfWorkMiddleware } from '@ddd-ts-kit/kernel';
import { OutboxPublisher, OutboxRelay } from '@ddd-ts-kit/events';
import { createKnexUnitOfWork, KnexOutboxStore, KnexProcessedEventStore } from '@ddd-ts-kit/knex';

const db = knex({ client: 'pg', connection: process.env.DATABASE_URL });
const unitOfWork = createKnexUnitOfWork(db);

// Every command runs in one transaction; handlers do not know it.
const commandBus = new InMemoryCommandBus().use(unitOfWorkMiddleware(unitOfWork));

const outboxStore = new KnexOutboxStore(unitOfWork, { schema: 'messaging' });
const publisher = new OutboxPublisher(outboxStore); // what handlers publish to
const processed = new KnexProcessedEventStore(unitOfWork, { schema: 'messaging' });
const invoices = new KnexInvoiceRepository(unitOfWork);

const relay = new OutboxRelay({ store: outboxStore, publisher: broker, clock: new SystemClock() });
relay.start({ intervalMs: 500 });
```

`unitOfWork.run(work)` opens `knex.transaction` and keeps the transaction in an
`AsyncLocalStorage`; a nested `run` joins the outer transaction (no savepoint). Because
`append` uses the current transaction, an event published by a handler that then fails is
rolled back with the business write: that is the whole point of the outbox.
`createKnexUnitOfWork(db, { isolationLevel: 'repeatable read' })` forwards the transaction
configuration of knex.

## Repository

A repository receives the context, never a transaction. `executor()` is the transaction of the
unit of work when there is one and the root knex instance otherwise.

```ts
// contexts/billing-core/infrastructure/persistence/knex-invoice.repository.ts
import type { Knex } from 'knex';
import type { Repository } from '@ddd-ts-kit/kernel';
import {
  insertIgnoringConflict,
  optimisticUpdate,
  schemaNameOf,
  type KnexContext,
} from '@ddd-ts-kit/knex';

const BILLING = schemaNameOf('billing-core'); // billing_core

interface InvoiceRow {
  id: string;
  amount: number;
  status: 'draft' | 'issued';
  version: number;
}

export class KnexInvoiceRepository implements Repository<Invoice> {
  constructor(private readonly context: KnexContext) {}

  async findById(id: string): Promise<Invoice | undefined> {
    const row = await this.#invoices().where({ id }).first();
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
        const inserted = await insertIgnoringConflict(this.context.executor(), this.#invoices(), { row, conflict: 'id' });
        return inserted ? 1 : 0;
      }
      return this.#invoices().where({ id: invoice.id, version: expected }).update(row);
    });
  }

  #invoices(): Knex.QueryBuilder<InvoiceRow, InvoiceRow[]> {
    return this.context.executor()<InvoiceRow, InvoiceRow[]>('invoices').withSchema(BILLING);
  }
}
```

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
import { stampCreation, stampUpdate, tenantScopeOf } from '@ddd-ts-kit/kernel';
import { auditRow, tenantRow, type AuditRow, type TenantRow } from '@ddd-ts-kit/knex';

interface InvoiceRow extends VersionedInvoice, TenantRow, AuditRow {}

export class KnexInvoiceRepository implements Repository<Invoice> {
  constructor(
    private readonly context: KnexContext,
    private readonly scope: ExecutionScope, // EXECUTION_SCOPE
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Invoice | undefined> {
    const row = await this.#invoices().where({ id, ...this.#ownTenant() }).first();
    return row === undefined ? undefined : InvoiceMapper.toDomain(row);
  }

  async save(invoice: Invoice): Promise<void> {
    await optimisticUpdate(invoice, async ({ expected, next }) => {
      const state = { ...InvoiceMapper.toRow(invoice), version: next };
      return expected === 0 ? this.#insert(state) : this.#update(state, expected);
    });
  }

  async #insert(state: VersionedInvoice): Promise<number> {
    const row = { ...state, ...this.#ownTenant(), ...auditRow(stampCreation(this.scope, this.clock)) };
    const inserted = await insertIgnoringConflict(this.context.executor(), this.#invoices(), { row, conflict: 'id' });
    return inserted ? 1 : 0;
  }

  #update(state: VersionedInvoice, expected: number): Promise<number> {
    return this.#invoices()
      .where({ id: state.id, version: expected, ...this.#ownTenant() })
      .update({ ...state, ...auditRow(stampUpdate(this.scope, this.clock)) });
  }

  #ownTenant(): TenantRow {
    return tenantRow(tenantScopeOf(this.scope));
  }
}
```

A list query takes the kernel `PageRequest` and answers a `Page`, in both variants:

```ts
import { decodeCursor, encodeCursor, pageOf } from '@ddd-ts-kit/kernel';

export class KnexInvoiceQueries {
  async list(request: PageRequest<'amount'>): Promise<Page<InvoiceSummary>> {
    return request.kind === 'offset' ? this.#byOffset(request) : this.#byCursor(request);
  }

  async #byOffset(request: OffsetPageRequest<'amount'>): Promise<Page<InvoiceSummary>> {
    const rows = await this.#ownInvoices()
      .orderBy(totalOrder(directionOf(request)))
      .limit(request.limit)
      .offset(request.offset);
    const counted = await this.#ownInvoices().count<{ total: string | number }[]>({ total: '*' }).first();
    return pageOf(rows.map(toSummary), { total: Number(counted?.total ?? 0) });
  }

  async #byCursor(request: CursorPageRequest<'amount'>): Promise<Page<InvoiceSummary>> {
    const direction = directionOf(request);
    const query = this.#ownInvoices().orderBy(totalOrder(direction)).limit(request.limit + 1);
    const rows = await (request.cursor === undefined ? query : beyond(query, positionOf(request.cursor), direction));
    const items = rows.slice(0, request.limit);
    const last = items.at(-1);
    const more = rows.length > request.limit && last !== undefined;
    return pageOf(items.map(toSummary), more ? { nextCursor: encodeCursor({ amount: last.amount, id: last.id }) } : {});
  }

  #ownInvoices() {
    return invoicesOf(this.context).where(tenantRow(tenantScopeOf(this.scope)));
  }
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

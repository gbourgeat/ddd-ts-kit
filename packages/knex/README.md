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

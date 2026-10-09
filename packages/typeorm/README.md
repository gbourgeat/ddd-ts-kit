# @ddd-ts-kit/typeorm

TypeORM adapters of the kernel and events ports: a unit of work that repositories never see,
the transactional outbox store, the processed-event store, their tables as `EntitySchema`
objects, and one database schema per bounded context. Same pieces as `@ddd-ts-kit/drizzle`, for
projects on TypeORM.

```
npm i @ddd-ts-kit/typeorm typeorm pg
```

Everything here uses `EntitySchema`, not decorated classes: no `reflect-metadata` import, no
`experimentalDecorators`, and rows stay plain objects that a mapper turns into aggregates.
PostgreSQL first; see [Dialect coverage](#dialect-coverage) for MySQL and SQLite.

## Schema

The tables are `EntitySchema` objects: add them to the `entities` of the data source and
`typeorm migration:generate` writes their DDL into a migration of your project.

```ts
// platform/database/entities.ts
import { outboxEntity, processedEventEntity, schemaNameOf } from '@ddd-ts-kit/typeorm';

export const outbox = outboxEntity({ schema: 'messaging' }); // messaging.outbox
export const processedEvents = processedEventEntity({ schema: 'messaging' });

// contexts/billing-core/infrastructure/persistence/invoice.entity.ts
import { EntitySchema } from 'typeorm';

export interface InvoiceRow {
  id: string;
  amount: number;
  status: 'draft' | 'issued';
  version: number;
}

export const invoices = new EntitySchema<InvoiceRow>({
  name: 'Invoice',
  tableName: 'invoices',
  schema: schemaNameOf('billing-core'), // billing_core
  columns: {
    id: { type: 'text', primary: true },
    amount: { type: 'int' },
    status: { type: 'text' },
    version: { type: 'int' },
  },
});
```

Options of both factories: `schema` (none: the default schema of the connection), `dialect`
(`postgres` by default, `mysql`, `sqlite`: it picks the JSON and timestamp column types),
`tableName`, and `name`, the entity name. The entity name defaults to `OutboxRecord` or
`ProcessedEvent`, suffixed with the schema (`OutboxRecord_messaging`), so each context can
register an outbox of its own in the same data source.

`outbox` is indexed for the relay (pending records by next attempt, partial index on
PostgreSQL and SQLite); `processed_events` has `(consumer, event_id)` as its primary key.
TypeORM does not create schemas: create them in the migration (`CREATE SCHEMA IF NOT EXISTS`).

## Composition root

```ts
// main.ts
import { DataSource } from 'typeorm';
import { InMemoryCommandBus, SystemClock, unitOfWorkMiddleware } from '@ddd-ts-kit/kernel';
import { OutboxPublisher, OutboxRelay } from '@ddd-ts-kit/events';
import {
  createTypeOrmUnitOfWork,
  TypeOrmOutboxStore,
  TypeOrmProcessedEventStore,
} from '@ddd-ts-kit/typeorm';

const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [outbox, processedEvents, invoices],
});
await dataSource.initialize();
const unitOfWork = createTypeOrmUnitOfWork(dataSource);

// Every command runs in one transaction; handlers do not know it.
const commandBus = new InMemoryCommandBus().use(unitOfWorkMiddleware(unitOfWork));

const outboxStore = new TypeOrmOutboxStore(unitOfWork, { entity: outbox });
const publisher = new OutboxPublisher(outboxStore); // what handlers publish to
const processed = new TypeOrmProcessedEventStore(unitOfWork, { entity: processedEvents });
const invoiceRepository = new TypeOrmInvoiceRepository(unitOfWork);

const relay = new OutboxRelay({ store: outboxStore, publisher: broker, clock: new SystemClock() });
relay.start({ intervalMs: 500 });
```

`unitOfWork.run(work)` opens `dataSource.transaction` and keeps the transactional
`EntityManager` in an `AsyncLocalStorage`; a nested `run` joins the outer transaction (no
savepoint). Because `append` uses the current manager, an event published by a handler that
then fails is rolled back with the business write: that is the whole point of the outbox.
`createTypeOrmUnitOfWork(dataSource, 'REPEATABLE READ')` sets the isolation level.

Pass to a store the very entity the data source registers. Without `entity`, a store uses
`outboxEntity()` or `processedEventEntity()`, which TypeORM matches by name with the default
entity in the default schema.

## Repository

A repository receives the context, never a transaction. `manager()` is the transactional
manager of the unit of work when there is one and `dataSource.manager` otherwise.

```ts
// contexts/billing-core/infrastructure/persistence/typeorm-invoice.repository.ts
import type { Repository } from '@ddd-ts-kit/kernel';
import { insertIgnoringConflict, optimisticUpdate, type TypeOrmContext } from '@ddd-ts-kit/typeorm';

export class TypeOrmInvoiceRepository implements Repository<Invoice> {
  constructor(private readonly context: TypeOrmContext) {}

  async findById(id: string): Promise<Invoice | undefined> {
    const row = await this.context.manager().findOneBy(invoices, { id });
    if (row === null) {
      return undefined;
    }
    const invoice = Invoice.rehydrate(row);
    invoice.version = row.version;
    return invoice;
  }

  async save(invoice: Invoice): Promise<void> {
    const manager = this.context.manager();
    await optimisticUpdate(invoice, async ({ expected, next }) => {
      const row = { ...invoice.state, version: next };
      if (expected === 0) {
        return (await insertIgnoringConflict(manager, invoices, row)) ? 1 : 0;
      }
      const updated = await manager.update(invoices, { id: invoice.id, version: expected }, row);
      return updated.affected ?? 0;
    });
  }
}
```

`optimisticUpdate` gives the version to expect and the version to write, raises a
`ConcurrencyError` (a `DomainError` with code `CONCURRENCY_CONFLICT`) when the guarded
statement wrote no row, and moves `invoice.version` on otherwise. `insertIgnoringConflict`
inserts unless the key exists and says whether it did; unlike a caught unique violation it
leaves the surrounding PostgreSQL transaction usable. Do not use `manager.save` for an
aggregate: it reads before writing and decides by itself between insert and update, which
defeats the version guard. TypeORM's own `@VersionColumn` is not used for the same reason: the
version belongs to the aggregate.

## Audit columns, tenant scoping and pages

The standard persistence shapes of the kernel, on TypeORM. `auditColumns(dialect?)` and
`tenantColumn()` are column options to spread into the `columns` of an `EntitySchema`: their
properties are those of the kernel `AuditStamp` and `TenantScoped`, so a stamp spreads into an
insert as it is, and the columns have the same names in every project (`created_at`,
`created_by`, `updated_at`, `updated_by`, `tenant_id`), which is what lets a dashboard, an
export or the audit package be written once.

```ts
import type { AuditStamp, TenantScoped } from '@ddd-ts-kit/kernel';
import { auditColumns, schemaNameOf, tenantColumn } from '@ddd-ts-kit/typeorm';

interface InvoiceRow extends VersionedInvoice, TenantScoped, AuditStamp {}

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
  indices: [{ name: 'invoices_tenant_amount_idx', columns: ['tenantId', 'amount', 'id'] }],
});
```

```ts
import { stampCreation, stampUpdate, tenantScopeOf } from '@ddd-ts-kit/kernel';

export class TypeOrmInvoiceRepository implements Repository<Invoice> {
  constructor(
    private readonly context: TypeOrmContext,
    private readonly scope: ExecutionScope, // EXECUTION_SCOPE
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Invoice | undefined> {
    const row = await this.context.manager().findOneBy(invoices, { id, ...tenantScopeOf(this.scope) });
    return row === null ? undefined : InvoiceMapper.toDomain(row);
  }

  async save(invoice: Invoice): Promise<void> {
    await optimisticUpdate(invoice, async ({ expected, next }) => {
      const state = { ...InvoiceMapper.toRow(invoice), version: next };
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
```

TypeORM's `@CreateDateColumn` and `@UpdateDateColumn` are not used: they take the time of the
database server, not of the `Clock`, and know nothing of who acts.

A list query takes the kernel `PageRequest` and answers a `Page`, in both variants:

```ts
import { LessThan, MoreThan, type FindOptionsWhere } from 'typeorm';
import { decodeCursor, encodeCursor, pageOf } from '@ddd-ts-kit/kernel';

export class TypeOrmInvoiceQueries {
  async list(request: PageRequest<'amount'>): Promise<Page<InvoiceSummary>> {
    return request.kind === 'offset' ? this.#byOffset(request) : this.#byCursor(request);
  }

  async #byOffset(request: OffsetPageRequest<'amount'>): Promise<Page<InvoiceSummary>> {
    const [rows, total] = await this.context.manager().findAndCount(invoices, {
      where: tenantScopeOf(this.scope),
      order: totalOrder(directionOf(request)),
      take: request.limit,
      skip: request.offset,
    });
    return pageOf(rows.map(toSummary), { total });
  }

  async #byCursor(request: CursorPageRequest<'amount'>): Promise<Page<InvoiceSummary>> {
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

const directionOf = (request: PageRequest<'amount'>) => request.sort[0]?.direction ?? 'asc';

// The primary key follows the sort field, in the same direction: the order is total.
const totalOrder = (direction: SortDirection) => ({ amount: direction, id: direction });

// The rows after a position, as a tuple comparison. A list of conditions is an OR in TypeORM,
// so each alternative restates the tenant.
function beyond(
  { amount, id }: { amount: number; id: string },
  direction: SortDirection,
  tenant: TenantScoped,
): FindOptionsWhere<InvoiceRow>[] {
  const past = direction === 'asc' ? MoreThan : LessThan;
  return [
    { ...tenant, amount: past(amount) },
    { ...tenant, amount, id: past(id) },
  ];
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

- `TypeOrmOutboxStore.claimBatch` selects the due rows `FOR UPDATE SKIP LOCKED`
  (`setLock('pessimistic_write').setOnLocked('skip_locked')`) and leases them in the same short
  transaction by pushing `next_attempt_at` forward (`leaseMs`, default 30 s), so several relays
  share the work without waiting for each other, and the records of a relay that died come
  back when the lease expires. Delivery is at least once, unordered.
- Where the database has no `SKIP LOCKED` (SQLite), or when you pass
  `claim: 'compare-and-set'`, the claim reads the due rows and takes each one with an update
  guarded by the attempt count it read: same guarantee, no lock clause, one statement per
  record. The default is `skip-locked` for the `postgres`, `aurora-postgres`, `cockroachdb`,
  `mysql` and `aurora-mysql` drivers, `compare-and-set` for every other one.
- `TypeOrmProcessedEventStore.markProcessed` is an insert ignoring the conflict on
  `(consumer, event_id)`. Run the consumer inside the unit of work: the mark then commits with
  the effects of the handler, and disappears with them if it fails.

## Dialect coverage

| Database | Status |
|---|---|
| PostgreSQL | Covered by the automated suite: contract suites of `@ddd-ts-kit/testing`, repository contract, rollback, nested unit of work, concurrent claims. It runs on PGlite served over the PostgreSQL wire protocol by default, and on a real server when `DDD_TS_KIT_TEST_DATABASE_URL` is set (last run: PostgreSQL 18). |
| MySQL 8 | Not in the automated suite. The outbox and processed-event contract suites and the rollback of `append` were run once by hand against MySQL 8.4 with `mysql2`, entities built with `dialect: 'mysql'`, with `skip-locked` and `compare-and-set`. |
| SQLite | Not in the automated suite. The same suites were run once by hand with the `better-sqlite3` driver, entities built with `dialect: 'sqlite'`. No `SKIP LOCKED`: the claim is `compare-and-set`. No schemas: leave `schema` out and name the tables per context. |
| MariaDB, CockroachDB, SQL Server, Oracle, MongoDB | Never run. |

## Limits

- Tested with TypeORM 1.1. The peer range also admits 0.3, on which nothing was run.
- An `EntitySchema` is static: the column types depend on the `dialect` you pass, not on the
  data source it is registered in.
- A JSON `null` payload is stored as SQL `NULL` and read back as `null`.
- On MySQL 5.7 there is no `SKIP LOCKED`: pass `claim: 'compare-and-set'`.
- `synchronize: true` is for tests. In production the tables come from your migrations.
- Ordering is not guaranteed, not even per aggregate: a failed event is retried later while its
  successors go out.

## Testing an adapter

The stores of this package pass `outboxStoreContract` and `processedEventStoreContract` of
`@ddd-ts-kit/testing/contracts`. Hold your repositories to `repositoryContract` the same way,
next to their in-memory fake. The tests of this package need no container:

```
npx vitest run packages/typeorm
DDD_TS_KIT_TEST_DATABASE_URL=postgresql://user:password@localhost:5432/postgres npx vitest run packages/typeorm
```

With the variable set, each spec file creates a database of its own on that server and drops
it afterwards, and the tests that need two real connections (a relay passing over rows locked
by another one) run instead of being skipped.

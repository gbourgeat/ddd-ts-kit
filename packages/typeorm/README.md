**English** · [Français](README.fr.md)

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
// platform/database/schema.ts
import { outboxEntity, processedEventEntity, schemaNameOf } from '@ddd-ts-kit/typeorm';

export const outbox = outboxEntity({ schema: 'messaging' }); // messaging.outbox
export const processedEvents = processedEventEntity({ schema: 'messaging' });

// contexts/billing-core/infrastructure/persistence/invoice-row.schema.ts
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

`createTypeOrmUnitOfWork(dataSource)` gives one object that is two ports: the kernel
`UnitOfWork`, and `TypeOrmContext`, the handle repositories and stores run their queries on.
Bind it to both:

```ts
// platform/database/persistence.module.ts
import { DataSource } from 'typeorm';
import { defineContextModule } from '@ddd-ts-kit/di';
import { IntegrationEventPublisher, ProcessedEventStore, UnitOfWork } from '@ddd-ts-kit/kernel';
import { OutboxPublisher, OutboxStore } from '@ddd-ts-kit/events';
import {
  createTypeOrmUnitOfWork,
  TypeOrmContext,
  TypeOrmOutboxStore,
  TypeOrmProcessedEventStore,
} from '@ddd-ts-kit/typeorm';

export const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [outbox, processedEvents, invoices],
});
const unitOfWork = createTypeOrmUnitOfWork(dataSource);

export const persistenceModule = defineContextModule({
  name: 'persistence',
  register(builder) {
    builder.rebind(UnitOfWork).toValue(unitOfWork);
    builder.bind(TypeOrmContext).toValue(unitOfWork);
    builder
      .bind(OutboxStore)
      .toFactory((resolve) => new TypeOrmOutboxStore(resolve(TypeOrmContext), { entity: outbox }));
    builder
      .rebind(ProcessedEventStore)
      .toFactory((resolve) => new TypeOrmProcessedEventStore(resolve(TypeOrmContext), { entity: processedEvents }));
    builder.rebind(IntegrationEventPublisher).toClass(OutboxPublisher, [OutboxStore]);
  },
  onStart: async () => {
    await dataSource.initialize();
  },
  onStop: () => dataSource.destroy(),
});
```

```ts
// main.ts
const app = createApplication({ modules: [kernelModule(), persistenceModule, contextModule('billing', billingDeclarations)] });

const relay = new OutboxRelay({ store: app.resolve(OutboxStore), publisher: broker, clock: app.resolve(Clock) });
relay.start({ intervalMs: 500 });
```

List the module after `kernelModule()`: `rebind` replaces its in-memory defaults. The command
bus of the kernel module runs every command in the bound `UnitOfWork`; handlers do not know it.
`contextModule` of `@ddd-ts-kit/di` turns the declared classes of a context into its module.

A project written by the CLI holds the same wiring in two files:
`platform/database/persistence-over.ts` builds the unit of work and the two stores once, and
`platform/platform.module.ts` binds them, the outbox publisher being given to
`kernelModule({ eventPublisher })`.

Pass to a store the very entity the data source registers. Without `entity`, a store uses
`outboxEntity()` or `processedEventEntity()`, which TypeORM matches by name with the default
entity in the default schema; the class is then bound directly:
`builder.bind(OutboxStore).toClass(TypeOrmOutboxStore, [TypeOrmContext])`,
`builder.rebind(ProcessedEventStore).toClass(TypeOrmProcessedEventStore, [TypeOrmContext])`.

`unitOfWork.run(work)` opens `dataSource.transaction` and keeps the transactional
`EntityManager` in an `AsyncLocalStorage`; a nested `run` joins the outer transaction (no
savepoint). Because `append` uses the current manager, an event published by a handler that
then fails is rolled back with the business write: that is the whole point of the outbox.
`createTypeOrmUnitOfWork(dataSource, 'REPEATABLE READ')` sets the isolation level.

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

`TypeOrmContext` is an abstract class, so it is its own injection token. A project with two
data sources gives each a class of its own (`export abstract class Ledger extends TypeOrmContext {}`
in `platform/database/`) and binds each to its unit of work.

## Repository

The port lives in the domain, the adapter in infrastructure. A repository receives the context,
never a transaction: `manager()` is the transactional manager of the unit of work when there
is one and `dataSource.manager` otherwise.

```ts
// contexts/billing-core/domain/repositories/invoice.repository.ts
import { Repository } from '@ddd-ts-kit/kernel';

export abstract class InvoiceRepository extends Repository<Invoice> {}
```

```ts
// contexts/billing-core/infrastructure/persistence/type-orm-invoice.repository.ts
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { insertIgnoringConflict, optimisticUpdate, TypeOrmContext } from '@ddd-ts-kit/typeorm';

@Repository(InvoiceRepository)
export class TypeOrmInvoiceRepository implements InvoiceRepository {
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

In the explicit style, without the decorator, the same binding is one line of
`<context>.module.ts`:
`builder.bind(InvoiceRepository).toClass(TypeOrmInvoiceRepository, [TypeOrmContext])`.

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
import { Clock, ExecutionScope, stampCreation, stampUpdate, tenantScopeOf } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';

@Repository(InvoiceRepository)
export class TypeOrmInvoiceRepository implements InvoiceRepository {
  constructor(
    private readonly context: TypeOrmContext,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Invoice | undefined> {
    const row = await this.context.manager().findOneBy(invoices, { id, ...tenantScopeOf(this.scope) });

    return row === null ? undefined : InvoiceMapper.toDomain(row);
  }

  async save(invoice: Invoice): Promise<void> {
    await optimisticUpdate(invoice, async ({ expected, next }) => {
      const state = { ...InvoiceMapper.toRow(invoice), version: next };

      return expected === 0 ? this.insert(state) : this.update(state, expected);
    });
  }

  private async insert(state: VersionedInvoice): Promise<number> {
    const row = { ...state, ...tenantScopeOf(this.scope), ...stampCreation(this.scope, this.clock) };

    return (await insertIgnoringConflict(this.context.manager(), invoices, row)) ? 1 : 0;
  }

  private async update(state: VersionedInvoice, expected: number): Promise<number> {
    const guarded = { id: state.id, version: expected, ...tenantScopeOf(this.scope) };
    const row = { ...state, ...stampUpdate(this.scope, this.clock) };

    return (await this.context.manager().update(invoices, guarded, row)).affected ?? 0;
  }
}
```

TypeORM's `@CreateDateColumn` and `@UpdateDateColumn` are not used: they take the time of the
database server, not of the `Clock`, and know nothing of who acts.

A search query takes the kernel `PageRequest` and answers a `Page`, in both variants:

```ts
// contexts/billing-core/application/ports/invoice-queries.port.ts
export abstract class InvoiceQueries {
  abstract search(request: PageRequest<'amount'>): Promise<Page<InvoiceSummary>>;
}
```

```ts
// contexts/billing-core/infrastructure/persistence/type-orm-invoice-queries.reader.ts
import { LessThan, MoreThan, type FindOptionsWhere } from 'typeorm';
import { ExecutionScope, encodeCursor, pageOf, tenantScopeOf } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';

@Repository(InvoiceQueries)
export class TypeOrmInvoiceQueries implements InvoiceQueries {
  constructor(
    private readonly context: TypeOrmContext,
    private readonly scope: ExecutionScope,
  ) {}

  async search(request: PageRequest<'amount'>): Promise<Page<InvoiceSummary>> {
    return request.kind === 'offset' ? this.byOffset(request) : this.byCursor(request);
  }

  private async byOffset(request: OffsetPageRequest<'amount'>): Promise<Page<InvoiceSummary>> {
    const [rows, total] = await this.context.manager().findAndCount(invoices, {
      where: tenantScopeOf(this.scope),
      order: totalOrder(directionOf(request)),
      take: request.limit,
      skip: request.offset,
    });

    return pageOf(rows.map(toSummary), { total });
  }

  private async byCursor(request: CursorPageRequest<'amount'>): Promise<Page<InvoiceSummary>> {
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

`criteriaToTypeOrm(builder, plan, { alias })` adds a criteria plan of the kernel to a
`SelectQueryBuilder` on the entity of a read model: the filters and the scope of the actor,
the keyset of a cursor page, the total order ended by the tie-breaker, the window.
`predicateToTypeOrm(builder, predicate, { alias })` adds the filters alone, for a count. The
fields of the read model are the properties of the entity (`properties` renames those that
differ). Every value is a named parameter; the only text composed is `alias.property` with an
operator of a closed list, both from the adapter. A text search is `LIKE :p ESCAPE :e` with
`%`, `_` and `\` escaped.

```ts
// infrastructure/persistence/type-orm-appointment-queries.reader.ts
async search(criteria: ScopedCriteria<AppointmentRow>): Promise<Page<AppointmentRow>> {
  const plan = planCriteria(appointmentCriteria, criteria);

  if (plan.empty) {
    return pageOfPlan(plan, []);
  }

  const builder = this.context.manager().createQueryBuilder(appointmentList, 'row');

  return pageOfPlan(plan, await criteriaToTypeOrm(builder, plan, { alias: 'row' }).getMany());
}
```

A cursor page is fetched one row longer than asked, which is how `pageOfPlan` knows whether
another follows; an offset page takes its total from `predicateToTypeOrm(...).getCount()`. A
field declared `nullable` is ordered `NULLS LAST` ascending and `NULLS FIRST` descending. Two
criteria in one query take distinct parameter names with the `parameters` option.

**Strings.** A text column is ordered and compared by range in the collation of the column;
criteria order strings by code point. Declare the text columns that are sorted or compared
with `gt`, `lt` or `between` with `collation: 'C'`: the index then serves the sort, and the
order is the same as in the fake. **Decimals** are a `numeric` column and a string in the
row; they read back in the scale of the column. **Instants** are `timestamptz` and a `Date`.
An integer is `integer`: a `bigint` comes back as a string from the driver.

## Read models

```ts
// infrastructure/persistence/appointment-list.schema.ts
export const appointmentList = new EntitySchema<AppointmentRow & ReadModelStamps>({
  name: 'AppointmentRow',
  tableName: 'appointment_list',
  schema: 'scheduling',
  columns: {
    id: { type: 'text', primary: true },
    status: { type: 'text' },
    startsAt: { name: 'starts_at', type: 'timestamp with time zone', precision: 3 },
    ...readModelColumns(), // last_event_id, last_event_at, last_event_version, deleted
  },
});

// infrastructure/persistence/type-orm-appointment-list.repository.ts
@Repository(AppointmentList)
export class TypeOrmAppointmentList extends TypeOrmReadModelStore<AppointmentRow> implements AppointmentList {
  constructor(context: TypeOrmContext) {
    super(context, { entity: appointmentList, definition: appointmentCriteria });
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

The table is written through its entity; the copy of a rebuild, which has none, is written by
column through the same query builder.

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

## Event store

```ts
const dataSource = new DataSource({ type: 'postgres', entities: [...eventStoreEntities({ schema: 'scheduling' })] });

const { events, snapshots, checkpoints, subjectKeys } = createTypeOrmEventSourcing(unitOfWork, { schema: 'scheduling' });
```

`eventStoreEntities` declares the tables as `EntitySchema`s, so `typeorm migration:generate`
creates them with the columns of `eventStoreTablesSql` of the kernel. The stores never load them
as entities. `createTypeOrmEventSourcing` refuses a data source that is not PostgreSQL.

Each statement runs on the executor of the context: an append joins the transaction of the
unit of work, so the stream and the outbox records its events publish commit together
(`eventStoreUnitOfWorkContract`). Appends take the head of the store, a row locked until their
transaction ends: positions are given in commit order, without gaps, and two appends never run
side by side, whatever their streams. PostgreSQL only. The stores are the ones of the kernel
(`PostgresEventStore` and its companions), held to `eventStoreContract` here; how an
event-sourced aggregate uses them: the README of `@ddd-ts-kit/kernel`, section "Event sourcing".

## Dialect coverage

What follows is about this package. The CLI generates for PostgreSQL only: `init --orm typeorm`
refuses `--database mysql` and `--database sqlite`.

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

The unit of work of this package passes `unitOfWorkContract`, and its stores
`outboxStoreContract` and `processedEventStoreContract`, of `@ddd-ts-kit/testing/contracts`. Hold your repositories to `repositoryContract` the same way,
next to their in-memory fake. The tests of this package need no container:

```
npx vitest run packages/typeorm
DDD_TS_KIT_TEST_DATABASE_URL=postgresql://user:password@localhost:5432/postgres npx vitest run packages/typeorm
```

With the variable set, each spec file creates a database of its own on that server and drops
it afterwards, and the tests that need two real connections (a relay passing over rows locked
by another one) run instead of being skipped.

# @ddd-ts-kit/prisma

Prisma adapters of the kernel and events ports: a unit of work that repositories never see,
the transactional outbox store, the processed-event store, and the models of their tables as
a schema fragment to copy. Same pieces as `@ddd-ts-kit/drizzle`, for projects on Prisma.

```
npm i @ddd-ts-kit/prisma @prisma/client @prisma/adapter-pg
npm i -D prisma
```

The package imports no Prisma code: it is typed structurally against the few methods it calls,
so it works with your generated client, wherever you generate it, and with an extended client
(`$extends`). PostgreSQL first; see [Dialect coverage](#dialect-coverage) for MySQL and SQLite.

## Schema

Prisma has one schema, yours. The package ships the models to copy into it, one file per
provider:

```
node_modules/@ddd-ts-kit/prisma/prisma/outbox.postgresql.prisma
node_modules/@ddd-ts-kit/prisma/prisma/outbox.mysql.prisma
node_modules/@ddd-ts-kit/prisma/prisma/outbox.sqlite.prisma
```

```prisma
// prisma/schema.prisma (PostgreSQL fragment)
model OutboxRecord {
  id            String    @id
  sequence      BigInt    @unique @default(autoincrement())
  type          String
  version       Int
  occurredAt    String    @map("occurred_at")
  payload       Json?
  traceparent   String?
  correlationId String?   @map("correlation_id")
  status        String    @default("pending")
  attempts      Int       @default(0)
  nextAttemptAt DateTime  @map("next_attempt_at") @db.Timestamptz(3)
  lastErrorCode String?   @map("last_error_code")
  publishedAt   DateTime? @map("published_at") @db.Timestamptz(3)
  createdAt     DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)

  @@index([status, nextAttemptAt, sequence])
  @@map("outbox")
}

model ProcessedEvent {
  consumer    String
  eventId     String   @map("event_id")
  processedAt DateTime @default(now()) @map("processed_at") @db.Timestamptz(3)

  @@id([consumer, eventId])
  @@map("processed_events")
}
```

`prisma migrate dev` then creates the tables in a migration of your project. Keep the field
names, the stores are typed against them; model names, table names and column names are yours.

One schema per bounded context: list the schemas in the datasource, put each model in its own
with `@@schema`, and give a context that keeps its own outbox a model name of its own.
`schemaNameOf('billing-core')` gives the name to write, `billing_core`.

```prisma
datasource db {
  provider = "postgresql"
  schemas  = ["messaging", "billing_core"]
}

model MessagingOutboxRecord {
  // ...the fields above
  @@map("outbox")
  @@schema("messaging")
}

model Invoice {
  id      String @id
  amount  Int
  status  String
  version Int

  @@map("invoices")
  @@schema("billing_core")
}
```

Contexts never relate to each other's models: no `@relation` across schemas.

## Composition root

`PrismaContext` is the client repositories and stores run their queries on. It is generic over
the transaction client of your generated client, so the project names its own database with a
class, which is then the injection token:

```ts
// platform/database/database.ts
import { PrismaContext } from '@ddd-ts-kit/prisma';
import type { Prisma } from '../../generated/prisma/client.js';

export abstract class Database extends PrismaContext<Prisma.TransactionClient> {}
```

`createPrismaUnitOfWork(prisma)` gives one object that is both the kernel `UnitOfWork` and
that `Database`. Bind it to both:

```ts
// platform/database/persistence.module.ts
import { PrismaPg } from '@prisma/adapter-pg';
import { defineContextModule } from '@ddd-ts-kit/di';
import { IntegrationEventPublisher, ProcessedEventStore, UnitOfWork } from '@ddd-ts-kit/kernel';
import { OutboxPublisher, OutboxStore } from '@ddd-ts-kit/events';
import {
  createPrismaUnitOfWork,
  PrismaOutboxStore,
  PrismaProcessedEventStore,
} from '@ddd-ts-kit/prisma';
import { PrismaClient } from '../../generated/prisma/client.js';
import { Database } from './database.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const unitOfWork = createPrismaUnitOfWork(prisma);
const outboxStore = new PrismaOutboxStore(unitOfWork, {
  delegate: (client) => client.messagingOutboxRecord,
  claim: { strategy: 'skip-locked', dialect: 'postgresql', schema: 'messaging', raw: (client) => client },
});

export const persistenceModule = defineContextModule({
  name: 'persistence',
  register(builder) {
    builder.rebind(UnitOfWork).toValue(unitOfWork);
    builder.bind(Database).toValue(unitOfWork);
    builder.bind(OutboxStore).toValue(outboxStore);
    builder.rebind(ProcessedEventStore).toFactory(
      (resolve) =>
        new PrismaProcessedEventStore(resolve(Database), { delegate: (client) => client.messagingProcessedEvent }),
    );
    builder.rebind(IntegrationEventPublisher).toClass(OutboxPublisher, [OutboxStore]);
  },
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
The stores are built here and not by `toClass`, because both need to be told how to reach
their model. The outbox store takes the unit of work itself, not only the context: its
`skip-locked` claim opens a short transaction of its own.

A project written by the CLI holds the same wiring in two files:
`platform/database/persistence-over.ts` builds the unit of work and the two stores once, and
`platform/platform.module.ts` binds them, the outbox publisher being given to
`kernelModule({ eventPublisher })`.

`unitOfWork.run(work)` opens the interactive `prisma.$transaction` and keeps the transaction
client in an `AsyncLocalStorage`; a nested `run` joins the outer transaction. `delegate` is a
function of the client because the model must be read on the transaction client inside a unit
of work and on the root client outside. Because `append` uses the current client, an event
published by a handler that then fails is rolled back with the business write: that is the
whole point of the outbox.

`createPrismaUnitOfWork(prisma, { timeout: 15_000, isolationLevel: 'RepeatableRead' })`
forwards the options of `$transaction`.

## Repository

The port lives in the domain, the adapter in infrastructure. A repository receives the
database, never a transaction: `client()` is the transaction client of the unit of work when
there is one and the root client otherwise.

```ts
// contexts/billing-core/domain/repositories/invoice.repository.ts
import { Repository } from '@ddd-ts-kit/kernel';

export abstract class InvoiceRepository extends Repository<Invoice> {}
```

```ts
// contexts/billing-core/infrastructure/persistence/prisma-invoice.repository.ts
import { Repository } from '@ddd-ts-kit/kernel/declarations';
import { optimisticUpdate } from '@ddd-ts-kit/prisma';

@Repository(InvoiceRepository, [Database])
export class PrismaInvoiceRepository implements InvoiceRepository {
  constructor(private readonly database: Database) {}

  async findById(id: string): Promise<Invoice | undefined> {
    const row = await this.database.client().invoice.findUnique({ where: { id } });

    if (row === null) {
      return undefined;
    }

    const invoice = InvoiceMapper.toDomain(row);
    invoice.version = row.version;

    return invoice;
  }

  async save(invoice: Invoice): Promise<void> {
    const invoices = this.database.client().invoice;

    await optimisticUpdate(invoice, async ({ expected, next }) => {
      const row = { ...invoice.state, version: next };
      const written =
        expected === 0
          ? await invoices.createMany({ data: [row], skipDuplicates: true })
          : await invoices.updateMany({ where: { id: invoice.id, version: expected }, data: row });

      return written.count;
    });
  }
}
```

In the explicit style, without the decorator, the same binding is one line of
`<context>.module.ts`:
`builder.bind(InvoiceRepository).toClass(PrismaInvoiceRepository, [Database])`.

`Prisma.TransactionClient` is the type of `client()` for a plain client. An extended client
(`prisma.$extends(...)`) has a transaction client type of its own, which Prisma does not make
assignable to it: declare `Database` as `PrismaContext<PrismaTransactionClient<typeof prisma>>`
instead.

`optimisticUpdate` gives the version to expect and the version to write, raises a
`ConcurrencyError` (a `DomainError` with code `CONCURRENCY_CONFLICT`) when the guarded
statement wrote no row, and moves `invoice.version` on otherwise. Use `createMany` and
`updateMany` for the guarded write: they return a count, where `create` and `update` throw,
and a thrown unique violation aborts the surrounding PostgreSQL transaction. `upsert` cannot
carry the version guard.

## Audit columns, tenant scoping and pages

The standard persistence shapes of the kernel, on Prisma. A Prisma schema has no way to share
fields between models, so there is no helper to import here: copy the five fields. Keep their
names, which are those of the kernel `AuditStamp` and `TenantScoped`, so a stamp spreads into
`data` as it is; and keep the mapped column names (`created_at`, `created_by`, `updated_at`,
`updated_by`, `tenant_id`), the same in every project, which is what lets a dashboard, an
export or the audit package be written once.

```prisma
model Invoice {
  id        String   @id
  amount    Int
  status    String
  version   Int
  tenantId  String   @map("tenant_id")
  createdAt DateTime @map("created_at") @db.Timestamptz(3)
  createdBy String   @map("created_by")
  updatedAt DateTime @map("updated_at") @db.Timestamptz(3)
  updatedBy String   @map("updated_by")

  @@index([tenantId, amount, id], map: "invoices_tenant_amount_idx")
  @@map("invoices")
  @@schema("billing_core")
}
```

No `@default(now())` and no `@updatedAt` on them: the instant is the one of the `Clock`, and
Prisma's own attributes know nothing of who acts.

```ts
import { Clock, ExecutionScope, stampCreation, stampUpdate, tenantScopeOf } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';

@Repository(InvoiceRepository, [Database, ExecutionScope, Clock])
export class PrismaInvoiceRepository implements InvoiceRepository {
  constructor(
    private readonly database: Database,
    private readonly scope: ExecutionScope,
    private readonly clock: Clock,
  ) {}

  async findById(id: string): Promise<Invoice | undefined> {
    // findFirst, not findUnique: the tenant is part of every condition, and it is not part of the key.
    const row = await this.database.client().invoice.findFirst({ where: { id, ...tenantScopeOf(this.scope) } });

    return row === null ? undefined : InvoiceMapper.toDomain(row);
  }

  async save(invoice: Invoice): Promise<void> {
    await optimisticUpdate(invoice, async ({ expected, next }) => {
      const state = { ...InvoiceMapper.toRow(invoice), version: next };
      const written = expected === 0 ? await this.insert(state) : await this.update(state, expected);

      return written.count;
    });
  }

  private insert(state: VersionedInvoice): Promise<Prisma.BatchPayload> {
    const row = { ...state, ...tenantScopeOf(this.scope), ...stampCreation(this.scope, this.clock) };

    return this.database.client().invoice.createMany({ data: [row], skipDuplicates: true });
  }

  private update(state: VersionedInvoice, expected: number): Promise<Prisma.BatchPayload> {
    return this.database.client().invoice.updateMany({
      where: { id: state.id, version: expected, ...tenantScopeOf(this.scope) },
      data: { ...state, ...stampUpdate(this.scope, this.clock) },
    });
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
// contexts/billing-core/infrastructure/persistence/prisma-invoice-queries.reader.ts
import { ExecutionScope, encodeCursor, pageOf, tenantScopeOf } from '@ddd-ts-kit/kernel';
import { Repository } from '@ddd-ts-kit/kernel/declarations';

@Repository(InvoiceQueries, [Database, ExecutionScope])
export class PrismaInvoiceQueries implements InvoiceQueries {
  constructor(
    private readonly database: Database,
    private readonly scope: ExecutionScope,
  ) {}

  async list(request: PageRequest<'amount'>): Promise<Page<InvoiceSummary>> {
    return request.kind === 'offset' ? this.byOffset(request) : this.byCursor(request);
  }

  private async byOffset(request: OffsetPageRequest<'amount'>): Promise<Page<InvoiceSummary>> {
    const { invoice } = this.database.client();
    const where = tenantScopeOf(this.scope);
    const rows = await invoice.findMany({
      where,
      orderBy: totalOrder(directionOf(request)),
      take: request.limit,
      skip: request.offset,
    });

    return pageOf(rows.map(toSummary), { total: await invoice.count({ where }) });
  }

  private async byCursor(request: CursorPageRequest<'amount'>): Promise<Page<InvoiceSummary>> {
    const direction = directionOf(request);
    const tenant = tenantScopeOf(this.scope);
    const rows = await this.database.client().invoice.findMany({
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

const directionOf = (request: PageRequest<'amount'>) => request.sort[0]?.direction ?? 'asc';

// The primary key follows the sort field, in the same direction: the order is total.
const totalOrder = (direction: SortDirection): Prisma.InvoiceOrderByWithRelationInput[] => [
  { amount: direction },
  { id: direction },
];

// The rows after a position, as a tuple comparison: the tie-breaker decides among equals.
function beyond(
  { amount, id }: { amount: number; id: string },
  direction: SortDirection,
  tenant: TenantScoped,
): Prisma.InvoiceWhereInput {
  const past = direction === 'asc' ? 'gt' : 'lt';

  return { ...tenant, OR: [{ amount: { [past]: amount } }, { amount, id: { [past]: id } }] };
}
```

`positionOf(cursor)` decodes with `decodeCursor` and checks that `amount` is a number and `id`
a string, raising `InvalidPageRequestError` otherwise. Prisma's own `cursor` option is not used:
it names a row by a unique field, where a position compares values and needs no row to still
exist.

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

`criteriaToPrisma(plan, fields?)` turns a criteria plan of the kernel into the arguments of a
`findMany`: `where` (the filters, the scope of the actor and the keyset of a cursor page),
`counted` (the filters and the scope alone, for a `count`), `orderBy` (the total order ended
by the tie-breaker), `take` and `skip`. `predicateToPrisma(predicate, fields?)` gives one
`where`. They are data, never text: Prisma binds every value. The fields of the read model
are the fields of the model; `fields` renames those that differ. The text of `contains` and
`startsWith` has its `%`, `_` and `\` escaped, which Prisma does not do.

```ts
// infrastructure/persistence/prisma-appointment-queries.reader.ts
async list(criteria: ScopedCriteria<AppointmentRow>): Promise<Page<AppointmentRow>> {
  const plan = planCriteria(appointmentCriteria, criteria);

  if (plan.empty) return pageOfPlan(plan, []);

  const { where, orderBy, take, skip } = criteriaToPrisma(plan);

  return pageOfPlan(plan, await this.database.client().appointmentRow.findMany({ where, orderBy, take, skip }));
}
```

A cursor page is fetched one row longer than asked, which is how `pageOfPlan` knows whether
another follows; an offset page takes its total from `count({ where: counted })`. A field
declared `nullable` is ordered `{ sort, nulls }`: last ascending, first descending.

**Strings.** A text column is ordered and compared by range in the collation of the column;
criteria order strings by code point. Declare the text columns that are sorted or compared
with `gt`, `lt` or `between` with `COLLATE "C"`, in the migration since the Prisma schema cannot say it (`ALTER TABLE ... ALTER COLUMN room TYPE text COLLATE "C"`): the index then serves the sort, and the
order is the same as in the fake. **Decimals** are a `Decimal` field and a string in the row: the store reads them back as
plain digits, without trailing zeros or exponent. **Instants** are `timestamptz` and a `Date`.
A `BigInt` field reads back as a number.

## Read models

The model of a read model is yours; `prisma/read-model.postgresql.prisma` of this package is
the template, with the four fields that order the events of a projection.

```prisma
model AppointmentRow {
  id               String   @id
  status           String
  startsAt         DateTime @map("starts_at") @db.Timestamptz(3)
  lastEventId      String   @map("last_event_id")
  lastEventAt      DateTime @map("last_event_at") @db.Timestamptz(3)
  lastEventVersion BigInt?  @map("last_event_version")
  deleted          Boolean  @default(false)

  @@map("appointment_list")
  @@schema("scheduling")
}
```

```ts
// infrastructure/persistence/prisma-appointment-list.repository.ts
@Repository(AppointmentList, [Database])
export class PrismaAppointmentList extends PrismaReadModelStore<AppointmentRow, Prisma.TransactionClient> implements AppointmentList {
  constructor(database: Database) {
    super(database, {
      delegate: (client) => client.appointmentRow,
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

The table is reached through its model, and the copy of a rebuild, which has no model,
through `$queryRawUnsafe` with quoted identifiers and `$n` parameters: that is why the table,
the schema and the column of each field are named. The arguments given to the model are built
from the fields of the row at run time, so `PrismaReadModelDelegate` types them as objects and
it is the generated client that validates them.

## Outbox and idempotency

`claim` is required, because a Prisma client does not tell which database it talks to:

- `{ strategy: 'skip-locked', dialect, raw, schema?, table? }` selects the due rows
  `FOR UPDATE SKIP LOCKED` and leases them in the same short transaction by pushing
  `nextAttemptAt` forward (`leaseMs`, default 30 s), so several relays share the work without
  waiting for each other, and the records of a relay that died come back when the lease
  expires. Needs PostgreSQL or MySQL 8. Prisma Client has no row-locking API, so this one
  select is raw SQL sent with `$queryRawUnsafe` (`raw: (client) => client` hands the store
  that method); `schema` and `table` are the real names of the table and must be plain
  identifiers. Everything else, the update included, is Prisma Client.
- `'compare-and-set'` reads the due rows and takes each one with an `updateMany` guarded by the
  attempt count it read: same guarantee, no raw SQL, any database, one statement per record.

`PrismaProcessedEventStore.markProcessed` is `createMany({ skipDuplicates: true })`. Run the
consumer inside the unit of work: the mark then commits with the effects of the handler, and
disappears with them if it fails.

Delivery is at least once, unordered.

## Dialect coverage

What follows is about this package. The CLI generates for PostgreSQL only: `init --orm prisma`
refuses `--database mysql` and `--database sqlite`.

| Database | Status |
|---|---|
| PostgreSQL | Covered by the automated suite, through `@prisma/adapter-pg`: contract suites of `@ddd-ts-kit/testing`, repository contract, rollback, nested unit of work, concurrent claims, both claim strategies. It runs on PGlite served over the PostgreSQL wire protocol by default, and on a real server when `DDD_TS_KIT_TEST_DATABASE_URL` is set (last run: PostgreSQL 18). |
| MySQL 8 | Not in the automated suite. The fragment is validated by `prisma validate`; the outbox and processed-event contract suites and the rollback of `append` were run once by hand against MySQL 8.4 through `@prisma/adapter-mariadb`, with `skip-locked` and `compare-and-set`. |
| SQLite | Not in the automated suite. The fragment is validated by `prisma validate`; the outbox contract suite was run once by hand through `@prisma/adapter-better-sqlite3` with `compare-and-set`, the only claim available there. The processed-event store needs the delegate shown under Limits. |
| CockroachDB, SQL Server, MongoDB | Never run. |

## Limits

What Prisma does not allow, and what the package does about it:

- **No row locking in Prisma Client.** `FOR UPDATE SKIP LOCKED` exists only as raw SQL, hence
  the `skip-locked` option that names the dialect and the table, and the `compare-and-set`
  alternative that stays inside Prisma Client.
- **Nesting is not portable.** A Prisma 7 transaction client can open a nested `$transaction`
  (a savepoint), a Prisma 6 one cannot. The package uses neither: a nested `run` joins the
  outer transaction, and `claimBatch` called inside a unit of work claims in that unit of
  work.
- **Interactive transactions are bounded in time**: 5 seconds by default, then Prisma rolls
  back. Pass `timeout` to `createPrismaUnitOfWork` for long commands. They also hold a
  connection for their whole duration.
- **A bare `null` is refused in a `Json` field**, and the sentinels that express it live in the
  generated client. The stores leave a `null` payload out, so it is stored as SQL `NULL` and
  read back as `null`; the field is therefore `Json?`.
- **No partial index in the schema language.** The fragment declares a plain index on
  `(status, nextAttemptAt, sequence)`. On PostgreSQL you may replace it by hand in the
  migration with `(next_attempt_at, sequence) WHERE status = 'pending'`.
- **No `createMany({ skipDuplicates })` on SQLite, SQL Server and MongoDB.** There the model
  does not fit `PrismaProcessedEventDelegate`; give the store a delegate that maps the unique
  violation, which SQLite tolerates inside a transaction:

  ```ts
  new PrismaProcessedEventStore(unitOfWork, {
    delegate: (client) => ({
      createMany: async ({ data }) => {
        let count = 0;
        for (const row of data) {
          try {
            await client.processedEvent.create({ data: row });
            count += 1;
          } catch (error) {
            if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
              throw error;
            }
          }
        }
        return { count };
      },
    }),
  });
  ```

- **The store cannot see the database provider**, so nothing is chosen for you: `claim` is
  required.
- Tested with Prisma 7.10 and its driver adapters. The peer range also admits Prisma 6, on
  which nothing was run.
- `stats()` is three `count` queries, not one statement: the numbers of a busy outbox may not
  add up to the same instant.

## Testing an adapter

The stores of this package pass `outboxStoreContract` and `processedEventStoreContract` of
`@ddd-ts-kit/testing/contracts`. Hold your repositories to `repositoryContract` the same way,
next to their in-memory fake. The tests of this package need no container and no manual step:

```
npx vitest run packages/prisma
DDD_TS_KIT_TEST_DATABASE_URL=postgresql://user:password@localhost:5432/postgres npx vitest run packages/prisma
```

The tests need a generated client. Each spec file first awaits
`test/support/generate.ts`, which builds a schema from the shipped PostgreSQL fragment (the
models as they are, plus a renamed copy in a `messaging` schema and the example `Invoice`),
runs `prisma generate` and `prisma migrate diff` into `test/generated/` (git-ignored), and
skips all of it when that directory is up to date. The suites themselves live in
`test/suites/` and import the generated client like application code would.

With the variable set, each spec file creates a database of its own on that server and drops
it afterwards, and the tests that need two real connections (a relay passing over rows locked
by another one) run instead of being skipped.

# Persistence: Drizzle, Knex, Prisma, TypeORM, and which database

**Summary.** In this architecture an ORM is an implementation detail of
`infrastructure/persistence/`: rows never leave it, a mapper turns them into aggregates, and
transactions belong to the application through the `UnitOfWork` port. The kit ships the same
three pieces for four libraries (a unit of work with an ambient transaction, an outbox store, a
processed-event store), all held to the same contract suites. What differs is how each library
handles transactions, migrations, type safety and raw SQL, and how far each adapter was
actually tested: PostgreSQL is covered by the automated suites for all four, MySQL 8 and
SQLite were run by hand once for three of them, and nothing else was run at all.

## What the application asks of persistence

The requirements come from the model, not from the library
([aggregates](../concepts/aggregates.md), [transactional outbox](../concepts/transactional-outbox.md)):

| Need | Why | Consequence for the tool |
|---|---|---|
| load and save one whole aggregate | `Appointment` is a consistency boundary | a mapper, not an "entity" that is both row and model |
| one transaction per command, opened by a bus middleware | the handler never sees it | an ambient transaction the repository picks up |
| optimistic concurrency on `version` | two reschedules of one appointment | "update where version matches", count the rows |
| the outbox row in the same transaction | `appointments.appointment.booked` exists if and only if the booking does | the outbox store joins the unit of work |
| the processed-event mark with the consumer's change | `notifications` handles a redelivery once | same |
| a constraint the database enforces | no double booking, whatever any process believes | raw SQL in a migration (below) |
| one schema per context, no cross-context join | `context/extractable` in [ARCHITECTURE.md](../ARCHITECTURE.md) | schema-qualified tables |

The no-double-booking invariant shows what "raw SQL" means in practice. On PostgreSQL it is an
exclusion constraint over the practitioner and the time range. None of the four libraries
expresses it in its schema language as far as this page could establish: it is written by
hand in a migration, and the repository adapter maps the violation to `SlotAlreadyTaken`.

## Comparison

Versions checked on 2026-10-10 against the npm registry.

| | Drizzle | Knex | Prisma | TypeORM |
|---|---|---|---|---|
| What it is | typed SQL builder with schema in TypeScript | SQL query builder | client generated from a schema file | ORM, data mapper or active record |
| Version | 0.45.4 stable; a 1.0 release candidate is published (`rc` tag) | 3.3.0 (June 2026) | 7.10.0 is the last 7.x; the npm `latest` tag pointed at 8.0.0-rc.22 on the day of the check | 1.1.2 (0.3.x kept under `legacy`) |
| Licence | Apache-2.0 | MIT | Apache-2.0 | MIT |
| Weekly downloads | about 27 million | about 6 million | about 19 million | about 5 million |
| Type safety of queries | inferred from the table definitions | weak: types are annotations you write | from the generated client | from entity definitions; query builder strings are unchecked |
| Transactions | callback; savepoints | callback or manual; savepoints | interactive transactions, bounded in time (5 s by default) and holding a connection | `QueryRunner` or callback |
| Row locking | in the builder | in the builder (`forUpdate().skipLocked()`) | none in the client: raw SQL | in the query builder |
| Migrations | generated from the schema diff by drizzle-kit, SQL files | hand-written JavaScript, up and down | generated from the schema diff, SQL files | generated from entities, or hand-written |
| Raw SQL | `sql` template, table objects interpolated | first class: it is a query builder | `$queryRaw`, typed SQL files | `query()` |
| Runtime weight | library only | library only | generated client plus a driver adapter | library, `reflect-metadata` with decorated entities |
| Decorators | none | none | none | optional: the kit uses `EntitySchema`, no decorator |

Reading the table for this architecture: the ORM features that matter least are the ones
ORMs advertise most. Lazy relations, identity maps, cascades and active records have no use
when an aggregate is loaded whole and mapped by hand; what matters is honest SQL, a
transaction that can be made ambient, row locks for the outbox relay and migrations you can
read.

## Selection criteria

1. **Team knowledge and existing schema.** A running application on one of the four keeps it:
   the domain does not care.
2. **How much raw SQL you expect.** Constraints, partial indexes, read models with window
   functions: Knex and Drizzle stay closest to SQL.
3. **Type safety of read models.** Query handlers may bypass aggregates and read projections
   through a port; typed queries pay off there.
4. **Transaction length.** Prisma's interactive transactions are bounded in time by default.
5. **What the kit generates for it.** Tenant scoping and the SQL audit trail are not available
   for all four (below).
6. **Version currency.** Prefer the current stable line; on the day of the check Prisma's npm
   `latest` tag carried a release candidate, so pin the version you tested.

## What this kit supports and verified

Common to the four packages ([drizzle](../../packages/drizzle/README.md),
[knex](../../packages/knex/README.md), [prisma](../../packages/prisma/README.md),
[typeorm](../../packages/typeorm/README.md)): a unit of work whose transaction repositories
never see, where a nested `run` joins the outer transaction and the domain events are
dispatched at the end of the outermost `run`, before its commit; an outbox store whose
`claimBatch` leases due rows so several relays share the work and a dead relay's rows come
back; a processed-event store whose mark commits with the handler's effects; the standard
audit columns and `tenant_id`; cursor and offset pages. The units of work pass
`unitOfWorkContract`, the stores `outboxStoreContract` and `processedEventStoreContract`; your repositories are held to `repositoryContract` next to
their in-memory fake. Delivery through the outbox is at least once and unordered.

For the read side, each of the four also ships a translator of the kernel criteria into its
query (`criteriaToDrizzle`, `criteriaToKnex`, `criteriaToPrisma`, `criteriaToTypeOrm`) and a
read model store for projections, held to `criteriaContract` and `readModelStoreContract` on
PostgreSQL; neither was run on MySQL or SQLite. The CLI does not generate them yet: see the
[read side proposal](../proposals/read-side.md) for the status per part.

### Per database

| | Drizzle | Knex | Prisma | TypeORM |
|---|---|---|---|---|
| PostgreSQL | automated: contract suites on PGlite (in process); works with node-postgres, postgres-js, PGlite, Neon drivers | automated on PGlite over the wire protocol, and on a real server when a URL is given (last run: PostgreSQL 18): contracts, rollback, nested unit of work, concurrent claims | same as Knex, through `@prisma/adapter-pg`, both claim strategies | same as Knex |
| MySQL 8 | not provided: the package is PostgreSQL only | by hand, once, against 8.4: outbox and processed-event contracts, rollback of `append` | by hand, once, against 8.4 through `@prisma/adapter-mariadb` | by hand, once, against 8.4 |
| SQLite | not provided | by hand, once (`better-sqlite3`); no `SKIP LOCKED`, no schemas | by hand, once, outbox contract only; the processed-event store needs a custom delegate | by hand, once; no `SKIP LOCKED`, no schemas |
| MariaDB, CockroachDB, SQL Server, Oracle | not provided | never run | CockroachDB, SQL Server never run | never run |
| MongoDB | not provided | not applicable | never run | never run |
| Library version tested | not stated in the README | not stated | Prisma 7.10; the peer range admits 6, on which nothing was run | TypeORM 1.1; the peer range admits 0.3, on which nothing was run |

"By hand, once" is the READMEs' own wording: those suites are not in CI, so a regression on
MySQL or SQLite would not be caught by the kit.

### What the generator and the other packages add

From [`packages/cli/README.md`](../../packages/cli/README.md) and
[`packages/audit/README.md`](../../packages/audit/README.md):

- The generated persistence of the four ORMs is written for PostgreSQL. `custom` starts on
  in-memory adapters held to the contract suites, for you to replace.
- `generate repository --tenant-scoped` is implemented for Drizzle and Knex; with another ORM
  the regular adapter is written and a note says what to add.
- The SQL audit trail exists for Knex and Drizzle, on PostgreSQL only. With Prisma, TypeORM,
  `custom` or no ORM the generated project starts on an in-memory trail behind a
  `TODO(platform)`.
- Fast adapter specs run on PGlite; Docker Compose provides the real server.

## PostgreSQL versus the others

| Database | Position in this kit | What you lose or must check |
|---|---|---|
| PostgreSQL | the default and the only one in the automated suites | nothing |
| MySQL 8 | stores run by hand once (Knex, Prisma, TypeORM) | no generated persistence, no SQL audit trail; `DATETIME` without time zone under Knex; no `SKIP LOCKED` on 5.7; one schema per context becomes one database or a table prefix |
| SQLite | stores run by hand once | no schemas, compare-and-set claim, single writer: tests and tools, not several instances |
| MongoDB, others | no adapter | `stack.orm: custom`: your own unit of work (its `run` built on `withinUnitOfWork` of the kernel), outbox store and processed-event store, each passing the contract suites; without multi-document transactions the outbox guarantee is not available |

`stack.database` accepts `postgres`, `mysql`, `sqlite`, `mongodb` and `none`
([CONFIG.md](../CONFIG.md)). `init` refuses anything but `postgres` with one of the four
ORMs: the other values go with `--orm custom`, where they record a choice and select no
package. `init --database mongodb` is accepted with `--orm custom` although the usage line of
`--help` does not list it.

## Limits and when not to use it

- **Ordering.** No store orders events, not even per aggregate; see
  [delivery and idempotency](../concepts/delivery-and-idempotency.md).
- **Prisma.** No row locking in the client (one raw `SELECT ... FOR UPDATE SKIP LOCKED`, or
  the compare-and-set claim); `claim` must be chosen by you because the client does not reveal
  its database; interactive transactions time out; no partial index in the schema language;
  `stats()` is three queries.
- **TypeORM.** An `EntitySchema` is static: column types follow the `dialect` you pass.
  `synchronize: true` is for tests only.
- **Knex.** The payload is serialized with `JSON.stringify`; MariaDB would return it as text.
- **Drizzle.** Never name a table in raw SQL: interpolate the table object so the schema
  qualification follows (persistence skill). The audit package notes that Drizzle prints the
  parameters of a failed statement in its error message: log the code, not the message.
- **All.** Migrations are forward-only and compatible with the version still running (expand,
  migrate, contract). The kit provides table definitions for each tool's own migration
  tooling; it runs no migration of its own.

When not to use an ORM adapter at all: a context with no state (a pure translator), or a read
model better served by a search engine or a cache, behind a port of its own.

## Migrations: names, merges and order

Several people add migrations at the same time, on one context or on several. Every migration
a generated project writes is named `<timestamp>_<what-it-does>`, and `npm run db:generate`
refuses to run without the description: two branches never write the same file.

| Tool | `db:generate` | Writes | A migration merged older than one already applied |
|---|---|---|---|
| drizzle-kit 0.31 | `drizzle-kit generate --name` (`migrations.prefix: 'timestamp'` in `drizzle.config.ts`) | `migrations/20261012093000_add-invoices.sql`, its snapshot `meta/20261012093000_snapshot.json`, one entry of `meta/_journal.json` | **skipped without a word**: the migrator applies the entries newer than the last one recorded |
| knex 3 | `knex migrate:make` (the ES module stub of knex, set in `knexfile.js`) | `migrations/20261012093000_add-invoices.js` | applied: knex runs every file it has not recorded |
| Prisma 7 | `prisma migrate dev --create-only --name` | `prisma/migrations/20261012093000_add_invoices/migration.sql` (Prisma turns `-` into `_`) | applied by `migrate deploy`, which runs every migration it has not recorded (its documentation; not measured here) |
| TypeORM 1.1 | `typeorm migration:generate -d <data source>`, given the path: `npm run db:generate migrations/add-invoices` | `migrations/1791829645467-add-invoices.ts` (milliseconds, and a `-`: TypeORM fixes both) | applied: TypeORM runs every migration it has not recorded |

The command takes the description after the script: `npm run db:generate add-invoices`
(`npm run db:generate -- audit-guard --custom` for a hand-written drizzle-kit migration).
The first knex migration that `init` writes is `00000000000000_initial.js`: it sorts before any
timestamp; a project created before 0.5 keeps its `0001_initial.js`, since an applied
migration is never renamed.

**Measured with drizzle-kit 0.31.11 and drizzle-orm 0.45.4 (2026-10-12)**, two copies of one
project each generating a migration, as two branches would:

- with the former default (`prefix: 'index'`), both write `0001_<random words>.sql` and
  `meta/0001_snapshot.json`: the snapshot conflicts as a file added twice;
- with `prefix: 'timestamp'`, the files and the snapshots no longer collide, but
  `meta/_journal.json` still conflicts (each branch appends an entry at the same place), and
  once merged by hand two snapshots name the same parent: `drizzle-kit check` exits 1 and
  `drizzle-kit generate` prints the collision and writes nothing (with exit code 0);
- worse, a database that applied the later migration first (the other branch was merged and
  deployed before) skips the earlier one for good: drizzle-orm's migrator applies only the
  entries whose `when` is newer than the last one it recorded. Measured on PGlite: after
  `add-payments`, then the merge of `add-invoices` generated three seconds before it, the
  database had `accounts, payments` and no `invoices`, without an error.

The kit's answer is the rule `persistence/migration-history` of `ddd-ts-kit check` (so
`npm run check:arch`, the guard of the plugin and the pipeline): every migration starts with the
number that orders it and no two share one; under drizzle-kit, the journal and the `.sql` files
match, the entries keep the order they were generated in, and each snapshot follows the one
before it. On the measured merge it reports the forked snapshot; on a journal merged in the
order of the branches it also reports the entry out of order.

**After a merge or a rebase that brought a migration from the main branch**, while yours is
not merged yet:

1. take the migrations of the main branch as they are (`.sql` files, snapshots, journal);
2. delete yours: its `.sql` file, its snapshot under `meta/` and its entry of the journal
   (drizzle-kit), or its file or directory (the other tools);
3. run `npm run db:generate <what-it-does>` again: it is generated on top of the main branch,
   with a later timestamp;
4. `npm run check:arch` reports nothing, and the branch is merged before another migration
   lands, or the steps are repeated.

A migration already merged on the main branch is never edited or regenerated: a correction is a
new migration.

**Not chosen: one migrations folder per context.** drizzle-kit can run one config per context
(its own `schema`, `out` and migrations table), so it would work, but it solves the wrong half:
two people on one context still collide, the platform tables (outbox, audit trail) belong to no
context, and `db:migrate` would become an ordered list of commands to keep in step with the
config. The timestamp, the rule and the procedure above cover a single folder and a team
working on one context alike. A context extracted as a service takes its tables with it then
(`generate service`).

## Recommendation by situation

| Situation | Choice |
|---|---|
| New project | Drizzle on PostgreSQL: the default, typed queries, SQL migrations, tenant scoping and SQL audit trail generated |
| SQL-first team, many hand-written queries, or an existing Knex code base | Knex on PostgreSQL: the "first-class stack" proven end to end by the CLI uses it |
| Existing Prisma schema | Prisma 7, with the limits above understood; plan the audit trail store yourself |
| Existing TypeORM application | TypeORM 1.x with `EntitySchema`; plan the audit trail store yourself |
| MySQL imposed | Knex or TypeORM, and run the contract suites against your server in your own CI |
| Another store | `custom`, behind the same ports, with a decision record |

## Sources

- Drizzle ORM documentation: https://orm.drizzle.team/docs/overview ; drizzle-kit configuration, `migrations.prefix`: https://orm.drizzle.team/docs/drizzle-config-file
- drizzle-kit 0.31.11 (`prepareMigrationMetadata`) and drizzle-orm 0.45.4 (`PgDialect.migrate`), knex 3.3.0 (`MigrationGenerator`, `getNewMigrations`), Prisma 7.10.0 (`migrate dev --name`), TypeORM 1.1.2 (`MigrationGenerateCommand`, `MigrationExecutor`): read in their published code on 2026-10-12.
- Knex documentation: https://knexjs.org/guide/
- Prisma documentation, transactions: https://www.prisma.io/docs/orm/prisma-client/queries/transactions
- Prisma documentation, migrations in development and production: https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production
- TypeORM documentation: https://typeorm.io
- PostgreSQL documentation, `SELECT ... FOR UPDATE SKIP LOCKED` and exclusion constraints:
  https://www.postgresql.org/docs/current/sql-select.html ,
  https://www.postgresql.org/docs/current/ddl-constraints.html
- PGlite: https://pglite.dev
- npm registry: versions, dist-tags, licences and weekly downloads read on 2026-10-10.
- Martin Fowler, Patterns of Enterprise Application Architecture, Addison-Wesley, 2002: Data
  Mapper, Unit of Work, Repository, Optimistic Offline Lock.
- Not verified: that no version of the four libraries can declare a PostgreSQL exclusion
  constraint in its schema language; the latest stable Drizzle 1.0 date.

## See also

- [Aggregates](../concepts/aggregates.md)
- [Domain building blocks](../concepts/domain-building-blocks.md)
- [Transactional outbox](../concepts/transactional-outbox.md)
- [Delivery and idempotency](../concepts/delivery-and-idempotency.md)
- [Message brokers](message-brokers.md)
- [Cache and coordination](cache-and-coordination.md)
- [Configuration](../CONFIG.md)

---
name: persistence
description: >-
  Implements or reviews the persistence of a bounded context behind repository ports.
  Repository port, ORM adapter, mapper, fake and contract suite, unit of work, optimistic
  concurrency, audit and tenant columns, read models, migrations, on Drizzle, Knex, Prisma,
  TypeORM or a custom store. Use when adding a table, a repository, a lookup, a read model
  or a migration, when replacing the in-memory adapter by a real one, when choosing an ORM,
  or when persistence types leak out of infrastructure.
argument-hint: "<context> <Aggregate>"
allowed-tools:
  - Read
  - Edit
  - Bash(npx ddd-ts-kit generate *)
  - Bash(npx ddd-ts-kit check *)
  - Bash(npx ddd-ts-kit list *)
  - Bash(npm test *)
---

# Persistence

Subject: `$ARGUMENTS`

```bash
npx ddd-ts-kit generate repository <ctx> <Aggregate> [--tenant-scoped] [--personal <column>,... [--subject <column>] [--erasure pseudonymise|row]] --json
```

writes the port (an abstract class extending the kernel `Repository<Aggregate>` in
`domain/repositories/`), the adapter of the project's ORM with its mapper and table in
`infrastructure/persistence/`, the fake, and one `repositoryContract` spec that both must
pass. `generate command --aggregate` creates it when missing. Fill the `next` places: the
lookups of the port, the columns, the mapper.

## Rules, whatever the technology

- **One repository per aggregate root**, whole-aggregate load and save. Add only the lookups
  a use case needs, named in the ubiquitous language; a screen reads through a read port.
- **Rows stay inside.** The mapper translates row to aggregate (`rehydrate`) and back; it is
  the one place where a type assertion is acceptable. No ORM type crosses the port.
- **Each context owns its tables**, in its own database schema and in a file of its own: the
  tables file of `infrastructure/persistence/` (Drizzle, Knex, TypeORM) or, on Prisma,
  `prisma/schema/<context>.prisma` beside the main `prisma/schema/schema.prisma` (a project still
  on the one `prisma/schema.prisma` of versions before 0.95 moves it first: `generate repository`
  refuses with the steps). A stored field changes its column and the mapper in one commit. No foreign key, join or
  query across contexts: reference by identifier, read through a published contract or a
  local projection fed by integration events (`context/extractable`).
- **Transactions belong to the application.** The unit of work is a middleware of the command
  bus; a repository picks up the ambient transaction, never receives one, never commits.
  Domain events are dispatched at its end, before the commit. A unit of work of your own
  builds `run` on `withinUnitOfWork` of the kernel and passes `unitOfWorkContract`.
- **Optimistic concurrency** on the aggregate's `version`: a conflicting save raises
  `ConcurrencyError`. A deadlock or a serialization failure anywhere in the transaction
  rejects the unit of work with `TransactionConflictError`, a `ConcurrencyError`: retry the
  command, never map the driver error by hand.
- **Audit and tenant columns are standard**: `created_at`, `created_by`, `updated_at`,
  `updated_by`, and `tenant_id` with `--tenant-scoped`, stamped by the adapter from the
  `ExecutionScope` and the `Clock` through the kernel helpers. The domain does not know them.
- **Files never in a table.** No binary or base64 column (`persistence/no-file-content`): the
  content lives in the `FileStorage` port (`stack.storage`), a row keeps the key, size, media
  type and checksum of its `StoredFile`, and `FileStaging` orders the write (staged before the
  transaction, recorded, moved to its key with the commit, an orphan in `staging/` purged a day
  later). `docs/concepts/file-storage.md`.
- **Multi-tenant** (`"stack.tenancy": "shared-table"`): every statement on tenant data goes
  through the helpers of the ORM package, `tenantTable` and `ownTenantTable` (Knex),
  `tenantCondition` and `ownTenantCondition` (Drizzle), `tenantWhere` and `ownTenantWhere` spread
  into the where (Prisma, TypeORM; `findFirst`, never `findUnique` or `save`: the key holds no
  tenant), `tenantScopeOf` in every inserted row, never a table straight from the executor, the
  client or the manager, a read model store built with its `tenant` option
  (`tenancy/scoped-statement`); reads may widen under an audited elevation, writes never. A
  context whose tables belong to no tenant because it decides who belongs to which (the identity
  preset) is declared `"tenancy": "control-plane"` under `contexts.<name>`, with its deviation and
  ADR: the rule leaves it alone, no suppression per statement. Row-level security, schema and database per tenant are in the packages, wired by
  hand; prove the adapter with `tenantIsolationContract`. A measure grouped then paged selects
  from the scoped query with `derivedTable`; a raw aggregate is fine in its select as a literal
  (bind a list as one value, `state = any(?)`, rather than interpolating placeholders), raw SQL
  that names a table, calls an unknown function or interpolates is not. A project that becomes
  multi-tenant migrates with `addTenantColumn` and `addOutboxTenantColumn(..., { tenantOfUnpublished })`.
  See `docs/concepts/multitenancy.md`.
- **Outbox in the same transaction** as the business write (`events/outbox-required`).
- **An event-sourced aggregate** (chosen per aggregate, `generate aggregate ... --event-sourced`)
  keeps the same port; its adapter delegates to `EventSourcedRepository` over the `EventStore`
  of the ORM package (`create<Orm>EventSourcing`), its stored events are declared in
  `<aggregate>-events.mapper.ts` with a named data type, and a change of that type is a new
  version with its upcaster (`event-sourcing/*`; `ddd-ts-kit docs --stored-events` records a
  version once its shape is final, and `docs --check` fails while one is unrecorded). When to choose it: `docs/concepts/event-sourcing.md` of the kit.
  Personal values are sealed per data subject (`personalData`, `PersonalDataCipher`); erasing
  one destroys its key in the `SubjectKeyStore`, then rebuilds the projections that hold a
  clear copy. `init --event-sourcing on` wires the stores (`persistence.eventSourcing`, schema
  `event_store`) and `src/platform/event-sourcing/`: the keys wrapped by `auditedSubjectKeys` of
  `@ddd-ts-kit/audit` when the audit trail is on, so that every erasure leaves a dated audit entry,
  and the cipher; `generate aggregate --event-sourced` is refused without it. Keep the keys in a
  store of their own in production, with a shorter backup retention than the events. What a table keeps of a person in clear is declared
  next to its mapper with `personalFields` (the subject column, the personal columns, `row` or
  `pseudonymise`, the columns that hold a file) and erased through a `PersonalDataErasure` port of
  the context (`export abstract class PatientErasure extends PersonalDataErasure {}`);
  `generate repository <ctx> <Aggregate> --personal <column>,... [--subject <column>] [--erasure row]`
  writes all of it: the columns in the storage, the declaration (`<aggregate>.personal-fields.ts`,
  spelled as the erasure of the ORM reads it), and once per context the erasure and the export: the
  ports (`extends PersonalDataErasure`, `extends PersonalDataExport`), the adapters over
  `<Orm>PersonalDataErasure` and `<Orm>PersonalDataExport`, their fakes, one spec on the test
  database and their lines in the copies and in the exports (`docs/concepts/personal-data.md` of
  the kit draws both);
  `eraseDataSubject` of the kernel runs the key, every copy in every tenant (`inEachTenant`) and
  the rebuilds, in that order; a context lists its port in
  `src/platform/privacy/data-subject-copies.ts` (its export port in `data-subject-exports.ts`;
  `init --privacy on`, the default with an ORM, writes the folder and the scripts `privacy:erase`
  and `privacy:export`), and `npm run privacy:erase -- <subject-id>` reaches them all, the key
  first when the project has an event store, then announces `privacy.data-subject.erased` through the
  outbox for the services that keep a copy (`generate erasure-handler <ctx>`); `npm run privacy:export -- <subject-id>` hands over one
  dated document (`exportDataSubject`, `PersonalDataExportDocument`), each export wrapped by
  `auditedPersonalDataExport` when the trail is on, never the values in the entry; `personalDataErasureContract` of
  `@ddd-ts-kit/testing` holds the adapter and the fake (`InMemoryPersonalData`) to the same behaviour.
  How long the rows keep the person goes on the same declaration, `retention: { after: 'ended_at',
  months: 36 }` (`generate repository ... --retention ended_at:36m`): the job `privacy.purge-expired`
  erases what outlived it every night, `npm run privacy:purge` by hand.
  The adapter of a context extends the one of its ORM package (`KnexPersonalDataErasure`,
  `DrizzlePersonalDataErasure`, `PrismaPersonalDataErasure`, `TypeOrmPersonalDataErasure`), given
  the declarations, the scope for tenant data and the file storage; a personal column that is not a
  text accepts null, or the rows are erased with `row`.
  `privacy/declared-field` (a warning) reports a column named like personal data (`email`,
  `phone`, `birth_date`, `address`... plus `privacy.vocabulary` of the config) that no declaration
  of its context names, and `privacy/subject-is-opaque` a subject that is personal data itself:
  declare the column, or record why it holds nothing of a person.
- **Searches** use the kernel `Page` and `PageRequest`; a cursor ends on a unique tie-breaker.
- **Queries may skip aggregates**: `generate query` writes a read port and an in-memory
  reader; replace the reader by an adapter that queries the tables and returns the shape of
  the port.
- **Migrations** are generated from the schema with the ORM's own tool, named by what they
  do (`npm run db:generate add-invoices`, which writes `<timestamp>_add-invoices`; it refuses
  to run without the name; under drizzle-kit a rename is never left for it to guess, since
  without a terminal it fails: add then drop in a later migration, or `-- <name> --custom`;
  never under `script` or another pseudo-terminal, where it waits), applied with
  `npm run db:migrate`, committed, forward-only, and compatible with the version still running.
  When a merge brings a migration from the main branch before yours is merged, yours is
  generated again on top: `npx ddd-ts-kit merge-trunk` does it as it brings the main branch in
  (under drizzle-kit it takes the main branch's journal and replays the branch's migrations, in
  order, under their names), and `merge-trunk --to-land`, run by the conductor before the squash
  merge, gives them their real names (renamed after the main branch's last under knex, Prisma
  and TypeORM; a migration of each side on the same table stops it: run `db:generate` again on
  the main branch). After a merge made without it, under drizzle-kit, take the main branch's
  journal (`git checkout origin/main -- migrations/meta/_journal.json`) and run
  `npx ddd-ts-kit drizzle-generate --replay` (`--base <ref>`, `origin/main` by default); it
  refuses a migration whose SQL was edited by hand and puts the folder back: generate that one
  again on top by hand and write the edit again. `persistence/migration-history` reports the forked or unordered history
  otherwise, which drizzle's migrator would skip silently. Procedure and measurements:
  `docs/tools/persistence.md`, "Migrations: names, merges and order". `drizzle-generate`
  formats the snapshot and journal it wrote with the project's formatter, and warns when the
  SQL changes a primary key in an order that fails, which `persistence/primary-key-order`
  reports until fixed: reorder it (old key dropped first) or write it with `--custom`. One
  `db:generate` writes every schema change made since the last one as one migration: to keep two
  apart (a table, then a constraint once it is filled), change the schema in two steps, with a
  `db:generate` after each; the replay refuses two such migrations of a branch rather than join
  them: generate them again one at a time, in their order. A worker of a parallel build generates a working migration only,
  `npm run db:generate working-<what>`, which the conductor replaces on the trunk at merge.

## By ORM

`stack.orm` decides what is generated. Each package provides the unit of work with an
ambient transaction, the outbox store and the processed-event store, and documents its
dialects: `@ddd-ts-kit/drizzle` (the default, PostgreSQL, one schema per context),
`@ddd-ts-kit/knex`, `@ddd-ts-kit/prisma`, `@ddd-ts-kit/typeorm`. With `none` or `custom` the
generated adapter is in-memory, held to the same contract suite, behind a `TODO(platform)`.

An outside system is not storage: a provider an environment runs without (a sandbox, a demo,
an environment for examiners, a provider not ready yet) is simulated by an adapter of
production code, `npx ddd-ts-kit generate adapter <ctx> <Port> --kind simulated`, never by a
repository nor by the fake of `test/fakes/`, which production code never imports. Its records
keep the shape the system sends and go through the translator of `infrastructure/anti-corruption/`.

Anything else (another query builder, a document store) is `stack.orm: custom`: provide in
`src/platform/database/` a `UnitOfWork`, an `OutboxStore` and a `ProcessedEventStore`, each
passing its contract suite of `@ddd-ts-kit/testing/contracts`, then the repository adapters.
Nothing in `domain/` or `application/` changes: that is the test of the boundary. A niche
store needs a decision record.

## Tests

The contract spec in `test/integration/` runs the fake and the adapter through the same
suite; adapter specs run on an in-process PostgreSQL unless a database URL is given. Add
what is specific to the adapter: every column mapped, the tenant filter, a rollback.

Finish with
`npx ddd-ts-kit check --rule layer/domain-purity --rule context/extractable --rule ports/implements-never-extends`
and the integration specs of the context.

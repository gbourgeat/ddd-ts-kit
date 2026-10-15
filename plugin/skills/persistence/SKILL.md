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
npx ddd-ts-kit generate repository <ctx> <Aggregate> [--tenant-scoped] --json
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
- **Each context owns its tables**, in its own database schema. No foreign key, join or
  query across contexts: reference by identifier, read through a published contract or a
  local projection fed by integration events (`context/extractable`).
- **Transactions belong to the application.** The unit of work is a middleware of the command
  bus; a repository picks up the ambient transaction, never receives one, never commits.
  Domain events are dispatched at its end, before the commit. A unit of work of your own
  builds `run` on `withinUnitOfWork` of the kernel and passes `unitOfWorkContract`.
- **Optimistic concurrency** on the aggregate's `version`: a conflicting save raises
  `ConcurrencyError`.
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
  `tenantCondition` and `ownTenantCondition` (Drizzle), never a table straight from the
  executor (`tenancy/scoped-statement`); reads may widen under an audited elevation, writes
  never. Row-level security, schema and database per tenant are in the packages, wired by
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
  When a merge brings a migration from the main branch before yours is merged, delete yours
  (and, under drizzle-kit, its snapshot and journal entry) and generate it again on top: `persistence/migration-history` reports the forked or
  unordered history otherwise, which drizzle's migrator would skip silently. Procedure and
  measurements: `docs/tools/persistence.md`, "Migrations: names, merges and order". A worker
  of a parallel build generates a working migration only, `npm run db:generate working-<what>`,
  which the conductor replaces on the trunk at merge.

## By ORM

`stack.orm` decides what is generated. Each package provides the unit of work with an
ambient transaction, the outbox store and the processed-event store, and documents its
dialects: `@ddd-ts-kit/drizzle` (the default, PostgreSQL, one schema per context),
`@ddd-ts-kit/knex`, `@ddd-ts-kit/prisma`, `@ddd-ts-kit/typeorm`. With `none` or `custom` the
generated adapter is in-memory, held to the same contract suite, behind a `TODO(platform)`.

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

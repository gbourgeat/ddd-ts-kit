---
name: persistence
description: >-
  Implements or reviews the persistence of a bounded context behind repository interfaces.
  Drizzle on PostgreSQL by default (schema per context, mappers, unit of work, optimistic
  concurrency, transactional outbox, migrations); Knex, Prisma or TypeORM through their
  adapter packages; any other mature ORM or database as an adapter of the same ports. Use
  when adding a table, a repository adapter, a read model or a migration, when choosing or
  replacing an ORM or database, or when persistence types leak out of infrastructure.
argument-hint: "<context> <Aggregate>"
allowed-tools:
  - Bash(npx ddd-ts-kit generate *)
  - Bash(npx ddd-ts-kit check *)
  - Bash(npx ddd-ts-kit list *)
---

# Persistence

Subject: `$ARGUMENTS`

The domain declares the repository interface; everything about storage lives in
`infrastructure/persistence/` and nowhere else.

```bash
npx ddd-ts-kit generate repository <ctx> <Aggregate> --json
```

creates the interface, the in-memory fake, the adapter for the project's ORM, the mapper and
the contract suite both must pass.

## Rules, whatever the technology

- **One repository per aggregate root**, whole-aggregate load and save. No repository for an
  inner entity.
- **Rows stay inside.** A mapper translates row to aggregate (`rehydrate`) and back. No ORM
  entity, row type or query builder crosses the repository interface.
- **Each context owns its tables**, in its own database schema. No foreign key and no join
  across contexts: reference by identifier, read through a published contract or a local
  projection fed by integration events.
- **Transactions belong to the application.** The `UnitOfWork` opens them (a bus middleware
  does it for every command); a repository picks up the current transaction from the
  context, it never receives one as a parameter and never commits.
- **Optimistic concurrency** on the aggregate's `version`: update where version matches,
  raise a concurrency conflict when no row was touched.
- **Outbox in the same transaction** as the business write, so an event is published if and
  only if the change is committed.
- **Queries may skip aggregates**: a query handler reads through a port whose adapter
  queries tables or a read model directly and returns the shape the port declares.
- **Migrations** are generated from the schema, committed, forward-only, and compatible with
  the version still running (expand, migrate, contract over several releases).

## Default: Drizzle on PostgreSQL

`@ddd-ts-kit/drizzle/postgres` provides the unit of work with an ambient transaction, the
outbox and processed-event stores and their tables, and `contextSchema('<ctx>')` for one
PostgreSQL schema per context. Tables are declared in
`infrastructure/persistence/<ctx>.schema.ts`. Never name a table in raw SQL: interpolate the
Drizzle table object so the schema qualification follows.

Fast adapter specs run on PGlite (PostgreSQL in process); the Docker Compose stack provides
the real server for `npm run dev` and for a final integration run.

## Knex, Prisma, TypeORM

`@ddd-ts-kit/knex`, `@ddd-ts-kit/prisma` and `@ddd-ts-kit/typeorm` provide the same pieces as
the Drizzle package: unit of work with an ambient transaction, outbox store, processed-event
store, table definitions for the ORM's own migration tooling. Set `stack.orm` in the config;
the scaffolder then generates repository adapters for that ORM. Each package's README states
which database dialects its tests cover.

## Anything else

Another ORM, query builder or database (Kysely, MikroORM, MongoDB, ...) fits as long as the
rules above hold. Set `stack.orm` to `custom`, then provide in `src/platform/`:

1. a `UnitOfWork` adapter with an ambient transaction (`AsyncLocalStorage`);
2. an `OutboxStore` and a `ProcessedEventStore` adapter, each passing the contract suite of
   `@ddd-ts-kit/testing/contracts`;
3. the repository adapters, each passing `repositoryContract`.

Nothing in `domain/` or `application/` changes: that is the test of whether the boundary held.
Prefer mature, maintained, widely used libraries on their current stable or LTS version; a
niche store needs an ADR.

Finish with `npx ddd-ts-kit check --rule layer/domain-purity --rule layer/application-inward --rule composition/only-in-module`
and the integration specs.

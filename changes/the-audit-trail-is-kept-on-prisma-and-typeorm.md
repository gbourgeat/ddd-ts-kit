**The audit trail of a generated project on Prisma or TypeORM is kept in its database, no longer in
the memory of the process: `@ddd-ts-kit/audit/prisma` and `@ddd-ts-kit/audit/typeorm` give
`PrismaAuditTrail` and `TypeOrmAuditTrail`, held to the same contract as the Knex and Drizzle
stores.** Until now `--orm prisma` and `--orm typeorm` started on an `InMemoryAuditTrail` behind a
`TODO(platform)`, so the proof of every command, decision, erasure, export and purge was lost when
the process stopped. The four stores share one PostgreSQL implementation (the hash chain, the head
locked per chain, the entries written at the commit of the unit of work). `auditPrismaModels(schema)`
gives the two Prisma models and `auditEntities({ schema })` the two TypeORM entities; their specs
prove that, created by the migrations of a project, they give the columns, the keys and the
indexes of `createAuditTables`. On Prisma the statements are raw ones on the client of the unit of
work, an append inside a transaction takes a savepoint, a failure of the database comes back with
its SQLSTATE as `code`, and the reader asks PostgreSQL for the instant in UTC, since the adapter of
pg reads a `timestamptz` without the offset of the session (the shared reader does so for every
store). `init --audit on` with Prisma or TypeORM writes the models in `prisma/schema.prisma` (the
`audit` schema added to the datasource) or the entities in `schema.ts`, binds the store in
`create-audit.ts`, adds `npm run db:audit-guard` for the append-only guard to paste in a
migration, and the test databases install that guard and leave the trail out of `reset()`.

To move: a project on Prisma or TypeORM with `--audit on` runs `init --force` to get the store, then
generates a migration for the two tables and adds one holding what `npm run db:audit-guard`
prints.

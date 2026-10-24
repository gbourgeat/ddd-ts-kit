**The background jobs and the process instances go to the database by default on every ORM of
the kit and with every container: `TypeOrmJobStore` and `TypeOrmProcessStore`, and one rule for
`init --queue`.** `@ddd-ts-kit/typeorm` gains the job store and the process store, with their
tables `jobEntity()` and `processEntity()`, held to `jobStoreContract` and `processStoreContract`
on PGlite and on PostgreSQL: a job enqueued by a command is written by its transaction, a claim
takes the due rows `FOR UPDATE SKIP LOCKED`, an idempotency key is unique per job name and tenant,
a step of a process manager saves its instance in its unit of work. `init --orm typeorm` now
accepts `--queue database` and writes the two entities in the `messaging` schema. And the default
of `--queue` no longer depends on the container: `database` on Knex, Drizzle, Prisma and TypeORM
with tsyringe, Nest or a platform wired by hand, `memory` with a custom persistence or none. Until
now a project under Nest or wired by hand kept its jobs in memory unless it asked otherwise.

To move: nothing for an existing project, whose `stack.queue` is kept. A new project under Nest or
wired by hand that wants its jobs in memory passes `--queue memory`.

**The background jobs and the process instances live in the database on Prisma too:
`PrismaJobStore` and `PrismaProcessStore`, and `init --orm prisma --queue database`.** The two
stores of `@ddd-ts-kit/prisma` are held to `jobStoreContract` and `processStoreContract`, on PGlite
and on PostgreSQL. A job enqueued by a command is written by the transaction of that command, so it
exists if and only if the command committed; a claim selects the due rows `FOR UPDATE SKIP LOCKED`,
the one raw statement of the store, and leases them in a short transaction; an idempotency key is
unique per job name and tenant. A step of a process manager saves its instance in the transaction
of its unit of work, refused with `ConcurrencyError` at a stale version. Their models ship in
`prisma/jobs-and-processes.postgresql.prisma`; the checkpoint of a job and the state of an
instance are JSON in a text field, since Prisma Client writes a SQL `NULL` to a `Json` field only
through the sentinel of the generated client. `init` writes the `BackgroundJob` and
`ProcessInstance` models in the `messaging` schema of `prisma/schema.prisma` and binds the stores in
`persistence-over.ts`; on Prisma with tsyringe `--queue` now defaults to `database`, as on Knex and
Drizzle, and with `--queue redis` the process instances stay in the database.

To move: a project on Prisma that keeps its jobs in memory and wants them in the database runs
`init --force --queue database` on a clean tree, then `npm run db:generate <name>` for the two new
tables.

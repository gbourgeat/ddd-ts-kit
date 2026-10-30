# Migrations: sandboxed, merged, parallel

Read under `agents.profile: regulated` or any sandbox where a command cannot reach the database,
on a branch whose trunk gained a migration since it started, or as a worker of a parallel build.
How each of the four tools names, orders and applies migrations, and what a merge breaks, is in
`docs/tools/persistence.md` of the kit, "Migrations: names, merges and order", with the
measurements; what follows is the commands and the order of the steps.

## In a sandbox

Under the sandbox of the regulated profile a command cannot reach the database, whatever
`sandbox.network` allows: `db:migrate` fails on the connection, and so does `db:generate` on
Prisma and TypeORM when `DATABASE_URL` is set to a server that does not answer (exit 3).

- Leave `DATABASE_URL` unset and `db:generate` needs no server at all: it replays the migrations
  on PostgreSQL in process (PGlite, the engine of `openTestDatabase()`), diffs them against the
  schema and writes the migration, audit guard statements included, so a sandboxed agent
  generates its own migrations. On TypeORM, build first:
  `npm run build && npm run db:generate migrations/<name>`. Drizzle generates without a
  connection too.
- `db:migrate` and the specs that name a `DATABASE_URL` stay the owner's, from a terminal outside
  the sandbox, or the CI's: hand over the command and wait.

## When the trunk brings a migration

When a merge brings a migration from the main branch before yours is merged, yours is generated
again on top.

1. `npx ddd-ts-kit merge-trunk` does it as it brings the main branch in (under drizzle-kit it
   takes the main branch's journal and replays the branch's migrations, in order, under their
   names).
2. `merge-trunk --to-land`, run by the conductor before the squash merge, gives them their real
   names (renamed after the main branch's last under knex, Prisma and TypeORM). A migration of
   each side on the same table stops it: run `db:generate` again on the main branch.
3. After a merge made without it, under drizzle-kit: take the main branch's journal
   (`git checkout origin/main -- migrations/meta/_journal.json`) and run
   `npx ddd-ts-kit drizzle-generate --replay` (`--base <ref>`, `origin/main` by default). It
   refuses a migration whose SQL was edited by hand and puts the folder back: generate that one
   again on top by hand and write the edit again. When one branch holds two migrations generated
   apart on purpose (a table, then a constraint once it is filled), the replay refuses them rather
   than join them into one: generate them again one at a time, in their order.

`persistence/migration-history` reports the forked or unordered history otherwise, which
drizzle's migrator would skip silently.

## In a parallel build

A worker generates a working migration only, `npm run db:generate working-<what>`, which the
conductor replaces on the trunk at merge.

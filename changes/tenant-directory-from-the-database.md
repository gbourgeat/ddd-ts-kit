**With the identity preset, a per-tenant job runs for every organisation, including one opened after the process started.**

Until now `init` gave the scheduler the tenants of `TENANTS`, read once when the process
started: an organisation created later (a sign-up, an operator) never got the run of a per-tenant
job (a reminder, a purge, a deadline), with no error and no log. `init` under tenancy now writes
`src/platform/composition/tenant-directory.ts`, the one place the scheduler's `TenantDirectory`
is made; `--preset identity` (and `generate context --preset identity`) replaces it by a
directory that reads the organisations of the identity context from the database at each
occurrence, on Drizzle, Knex and Prisma (the preset refuses TypeORM). A project with tenancy and
no source of tenants keeps `TENANTS`, and the documentation says plainly that a fixed list misses
a tenant created later. The adapter is integration-tested on PostgreSQL, including an
organisation opened after the first read and, on tsyringe, its run of a per-tenant job.

`privacy:erase` and `privacy:export` go through the same directory: with the identity preset they
reach the organisations of the database, not only the tenants of `TENANTS`, and they refuse to
run when the directory lists none.

A per-tenant run reading its own tenant only is now proven end to end on the real tenant-scoped
repository of a generated multi-tenant project, and the generated job spec points to that
pattern where it kept an `it.todo`.

To move: a project with tenancy regenerates its platform; a project that already holds the
identity preset and tenancy replaces `src/platform/composition/tenant-directory.ts` (or, before
this version, the `InMemoryTenantDirectory` bound in `compose-application.ts` or
`lay-foundations.ts`) by a directory over `<Orm>OrganisationTenantDirectory`. `TENANTS` is no
longer read once the organisations are the tenants.

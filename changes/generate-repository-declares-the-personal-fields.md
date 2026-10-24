**`generate repository --personal <column>,...` declares what a table keeps of a person, and writes the
erasure of its context: one command, and `npm run privacy:erase` reaches the new copy.** The named
columns join the storage and the row type of the aggregate as nullable text (the mapper writes them
empty until the aggregate carries them), and `<aggregate>.personal-fields.ts` declares them next to
the mapper with `personalFields` of the kernel: the subject column, `id` unless `--subject` names the
column that holds the id of the person, the fields, and `pseudonymise` unless `--erasure row` asks for
the row to be deleted; the declaration is spelled as the erasure of the ORM reads it, SQL names on
Knex and Prisma, properties on Drizzle and TypeORM. The first table of a context that declares
personal data brings the erasure of the context: the port
`application/ports/<context>-personal-data-erasure.port.ts` (`extends PersonalDataErasure`), the
adapter `<orm>-<context>-personal-data-erasure.repository.ts` over `<Orm>PersonalDataErasure` of the
ORM package (confined to the tenant of the work on a tenant-scoped repository), its fake, a spec that
saves two people through the repository and proves the erasure on the test database, the binding
where the context binds its adapters (the decorator in the declared style, the module file otherwise,
the factory of the hand-wired platform wrapped like any other adapter) and its line in
`src/platform/privacy/data-subject-copies.ts`. A second table of the same context joins the
declarations of that adapter. `*.personal-fields.ts` is a file of `infrastructure/persistence/` the
`naming/suffix` rule knows. Refused before anything is written: a project whose `stack.privacy` is
off (`init --force --privacy on`), `--orm none` or `custom` (no erasure adapter of the kit reads the
declaration), a column that is not one, a column the table keeps for itself, a subject listed as
personal, a mode that does not exist, `--subject` or `--erasure` without `--personal`. The CLI README,
the scaffold and persistence skills, the architecture reference and the proposal say it; a projection
keeps its rows in a read model store, not in a table of its own, so its declaration waits for the
register.

Proven end to end on generated projects: through the composed application (the container of
tsyringe, the platform wired by hand under Nest), two contexts and three tables, one person erased
from all of them in one run, in every tenant of a multi-tenant project or in the tenants given, the
key of the event store first when the project has one. That run uncovered a fault of the Knex erasure
adapter the direct tests could not see: bound in an application, every method of an adapter is
wrapped by tracing and by the aspects, and a helper that answered a query builder was awaited and its
chain broken; the helper is a function now, and the Knex spec runs the adapter wrapped the way the
platform binds it. `init --force`, which rewrites `data-subject-copies.ts`, lists the erasure of each
context again, as the port or as the factory of the hand-wired platform. The new concept page
[Personal data in a generated project](../docs/concepts/personal-data.md) draws the erasure end to
end, what stays out of reach and what the tool does not decide, in both languages.


**A Jest project starts PostgreSQL in process once per run, as a Vitest project does.** On an ORM,
`init --tests jest` writes `test/support/test-database-template.ts`, a global setup that initialises
the PGlite cluster once and saves it, and `test/support/test-database-teardown.ts`, which deletes
it, both named in `jest.config.js`; `open-test-database.ts` opens a copy of that cluster in each
spec instead of running an initdb of its own, as it already did under Vitest. On the identity
preset the integration specs under Jest take 26 CPU seconds instead of 45, for the same wall time
on a workstation (`docs/tools/test-runners.md`), and a busy machine no longer makes the hook that
opens the database outlast its timeout.

To move: in a Jest project on an ORM, copy the two files of `test/support/` from a new project
(`init --tests jest` with the same `--orm`), name them in `jest.config.js`
(`globalSetup: '<rootDir>/test/support/test-database-template.ts'`,
`globalTeardown: '<rootDir>/test/support/test-database-teardown.ts'`), and take
`inProcessPostgres()` of the new `src/platform/database/open-test-database.ts` in place of
`PGlite.create()`.

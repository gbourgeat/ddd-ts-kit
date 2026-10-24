**What a table keeps of a person can now be kept for a set time: `personalFields` takes a
`retention`, the erasure adapters of the four ORMs purge what outlived it, and a generated project
runs that purge every night, audited.** `retention: { after, days | months | years }` counts the
period from a date column of the row that is not personal data, one positive unit (refused
otherwise); a row whose date is empty never expires. The kernel adds the port
`PersonalDataRetention` (`purgeExpired(now)`), `purgeExpiredPersonalData(now, retentions)`, which
runs every copy at one instant and answers the rows each reached, `expiredBefore` and
`isPersonalDataRetention`; `InMemoryPersonalData` implements it, and
`personalDataRetentionContract` of `@ddd-ts-kit/testing` holds every adapter to it. The erasure
adapters of Knex, Drizzle, Prisma and TypeORM implement `purgeExpired` from the same declarations,
as the declaration says, files first, in the tenant of the work or in every tenant when the work
names none: the one write of the kit across tenants, chosen because a tenant left out of a list
would keep what it should not, bounded to an erasure by the date of the row, and written in the
multitenancy page. `auditedPersonalDataRetention` of `@ddd-ts-kit/audit` records each purge (`data-access`,
`personal-data:purge`, the context, `changes: { rows }`, no person). `generate repository ...
--personal ... --retention <column>:<n><d|m|y>` writes the retention in the declaration, adds a
column other than `registered_at` to the storage as a nullable timestamp, and proves the purge in the
generated spec. `init --privacy on` writes `src/platform/privacy/run-purge.ts`, schedules
`privacy.purge-expired` every night at 03:00 UTC (the privacy module on tsyringe, the platform wired
by hand), switched off by `JOB_PRIVACY_PURGE_EXPIRED_ENABLED=false`, and the script `privacy:purge`.
The concept page, the kernel, audit, ORM and CLI READMEs, the proposal and the skills say it, in
English and in French.

To move: `init --force` on a project with `--privacy on` writes the purge runner, the job and the
script; a declaration without `retention` purges nothing.

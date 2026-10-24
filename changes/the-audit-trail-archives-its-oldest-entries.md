**The oldest entries of the audit trail leave the database for the file storage, verified and
anchored: `archiveBefore(date, { files, clock })` on the four SQL stores and on
`InMemoryAuditTrail`, and a generated project archives every month what is older than the twelve
whole months it keeps online.** Each entry keeps the identifiers of a person, and a trail grows
for as long as the system lives (GDPR article 5(1)(e)). For each chain, in one transaction
holding its head, the entries after the last archive and older than the date are verified from
the anchor of the archive before them, written to one file (`audit-archives/<chain>/<from>-<to>.ndjson`,
one canonical JSON per line), recorded in the new `audit_archives` table with their last hash
and the SHA-256 of the file, then deleted: the guard of the trail lets a `DELETE` through only
for entries an archive covers, and refuses any change to the archives. A chain that does not
verify is refused (`AuditArchiveRefusedError`) and keeps every entry. `archivesOf(chain)` lists
the archives, `verifyArchive(text, archive, previous)` checks a file again, and `verifyChain`
takes `after`, the anchor the entries left in the database start from. `ArchiveAuditEntries` is
the scheduled job; `init` registers it as `audit.archive` (first day of the month, 04:00 UTC,
`JOB_AUDIT_ARCHIVE_ENABLED=false` switches it off) when the trail is in a database and the
project keeps files in a storage, and declares the archives with the rest of the trail on the
four ORMs. Archiving moves, it does not erase: how long the files are kept is the controller's
decision.

To move: a trail created before this version adds the archives once, in a migration:
`addAuditArchives(knex, { schema: 'audit' })` on Knex; on Drizzle, Prisma and TypeORM, `init
--force` declares the table, the migration of the ORM creates it, and a migration of your own
runs the statements of `auditArchiveUpgradeStatements('audit')` (the guard that lets archived
entries go, and the guard of the archives). Until then, `archiveBefore` fails on the missing
table and the job reports the failed run.

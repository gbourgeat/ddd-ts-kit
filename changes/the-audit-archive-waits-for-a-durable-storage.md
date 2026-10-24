**The monthly archive of the audit trail runs by default only when the files of the project are in
an object store, and no entry leaves the database before its file reads back from the storage as it
was written.** An archive removes the entries from the database; with `--storage local`, the default
of `init`, the files are on the disk of the server, which a redeployment may wipe and a backup may
not reach, and the proof of who did what would be lost a year after going live. A generated project
with `--storage s3` keeps the job on (`JOB_AUDIT_ARCHIVE_ENABLED=false` switches it off); one with
`--storage local` writes it off, and `JOB_AUDIT_ARCHIVE_ENABLED=true` switches it on once that disk
is durable and backed up, which `job-settings.ts` says next to the line. `archiveBefore` of the
four SQL stores and of `InMemoryAuditTrail` reads each file back and checks its digest before the
entries are removed: a storage that did not keep it is refused with the new
`AuditArchiveNotStoredError`, and the trail keeps every entry.

To move: a project generated with `--storage local` by the previous version has the job on; change
its line of `src/platform/jobs/job-settings.ts` to
`'audit.archive': { enabled: environment['JOB_AUDIT_ARCHIVE_ENABLED'] === 'true' }`, or keep it on
where the files already land on a durable, backed-up disk.

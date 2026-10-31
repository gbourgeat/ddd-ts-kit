# Register of personal data

What the system keeps of people, by context: read by `npx ddd-ts-kit docs` from the
`personalFields` declarations of each context and from the `personal` option of its integration
events, and held to the code by `docs --check`. Everything outside the markers is written by the
team and kept.

It is not the record of processing activities of GDPR article 30: that record also names the
purposes, the lawful basis, the recipients outside the system and the transfers, which no code
says. The sections after the markers are for the controller to write.

<!-- ddd-ts-kit:personal-data-register -->
<!-- /ddd-ts-kit:personal-data-register -->

## Purposes and lawful basis

TODO(domain): for each context above, why it keeps these data and on which lawful basis (GDPR article 6).

## Recipients outside the system

TODO(domain): the processors and the third parties that receive personal data (mail, payment, analytics), and the transfers outside the EEA with their safeguards.

## What the code does not purge

`npm run privacy:erase` reaches the declared copies, the records of the outbox of the events listed above and the jobs enqueued with the person as `subject`. It does not reach what the code cannot name: a message already delivered to a broker or a consumer, a field of a payload that no `personal` option lists, a job that holds a person in its payload and names no `subject`, a value a `cached` read keeps of a person, until its time to live. The jobs `events.purge-published` and `jobs.purge-finished` drop what the platform is done with past `OUTBOX_RETENTION_DAYS` and `BACKGROUND_JOBS_RETENTION_DAYS`; dead events and dead jobs wait for an operator.

TODO(domain): how long the backups, the logs, the files and the archives of the audit trail keep personal data, and who deletes them.

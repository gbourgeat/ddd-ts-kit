**`init` writes `src/platform/privacy/` and wires the event store on every stack: a generated
project erases and exports a data subject from its first minute.** `Persistence` gains
`eventSourcing` (`create<Orm>EventSourcing` in the `event_store` schema, whose tables the schema
file of Knex, Drizzle, Prisma and TypeORM now declares; the in-memory stores without a database).
`create-privacy.ts` holds the `SubjectKeyStore` of that store, wrapped by `auditedSubjectKeys` of
`@ddd-ts-kit/audit` when the audit trail is on, so that every erasure leaves a dated entry, and the
`PersonalDataCipher` over it; `privacy.module.ts` binds `EventStore`, `SnapshotStore`,
`CheckpointStore`, `SubjectKeyStore` and `PersonalDataCipher` on tsyringe, the hand-wired
`Platform` carries them as `platform.privacy`, and `platform-test.module.ts` binds the in-memory
stores, so a handler spec of an event-sourced aggregate needs no fake. A context that erases or
exports what it keeps of a person lists its port in `data-subject-copies.ts` or
`data-subject-exports.ts`; `run-erasure.ts` opens an execution context of origin `cli` with the
operator as actor, destroys the key, then runs `eraseDataSubject` of the kernel over the copies, in
every tenant with `--tenancy shared-table` (`inEachTenant`); `run-export.ts` gathers every record.
Two scripts answer the requests: `npm run privacy:erase -- <subject-id> [--operator <who-asks>]`
and `npm run privacy:export -- <subject-id>`, on the sources with the variables of `.env`, the
tenants named by `TENANTS`. What they cannot reach is said where they are written: backups, logs,
exports and a copy no context declared. No HTTP command erases yet. The architecture reference
(section 2), the CLI README, the event sourcing page and the persistence skill say it.

To move: a project generated before this version keeps its platform as it is; `npx ddd-ts-kit init
--force` rewrites the platform files of the stack, or copy `src/platform/privacy/` and the
`eventSourcing` member of `Persistence` from a fresh project, then a migration creates the tables
of the `event_store` schema (`npm run db:generate event-store`).

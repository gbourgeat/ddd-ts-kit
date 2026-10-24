**`init` writes `src/platform/privacy/` with `--privacy on`, the default with an ORM, and wires the
event store with `--event-sourcing on`: a generated project erases and exports a data subject from
its first minute, and pays no table it did not ask for.** Two choices of the stack, recorded as
`stack.privacy` and `stack.eventSourcing`, each changed later by `init --force`.

`--privacy on` writes `src/platform/privacy/`: a context that erases or exports what it keeps of a
person lists its port in `data-subject-copies.ts` or `data-subject-exports.ts`; `run-erasure.ts`
opens an execution context of origin `cli` with the operator as actor and runs `eraseDataSubject`
of the kernel over the copies, in every tenant with `--tenancy shared-table` (`inEachTenant`);
`run-export.ts` gathers every record. Two scripts answer the requests: `npm run privacy:erase --
<subject-id> [--operator <who-asks>]` and `npm run privacy:export -- <subject-id>`, on the sources
with the variables of `.env`, the tenants named by `TENANTS`. What they cannot reach is said where
they are written: backups, logs, exports and a copy no context declared. No HTTP command erases yet.
A project without personal data takes `--privacy off` and gets none of it.

`--event-sourcing on`, off unless asked, since keeping an aggregate as its events is a choice made
per aggregate: `Persistence` gains `eventSourcing` (`create<Orm>EventSourcing` in the `event_store`
schema, whose five tables the schema file of Knex, Drizzle, Prisma and TypeORM then declares; the
in-memory stores without a database), and `src/platform/event-sourcing/` holds the `SubjectKeyStore`
of that store, wrapped by `auditedSubjectKeys` of `@ddd-ts-kit/audit` when the audit trail is on, so
that every erasure leaves a dated entry, and the `PersonalDataCipher` over it; `event-sourcing.module.ts`
binds `EventStore`, `SnapshotStore`, `CheckpointStore`, `SubjectKeyStore` and `PersonalDataCipher`
on tsyringe, the hand-wired `Platform` carries them as `platform.eventSourcing`, and
`platform-test.module.ts` binds the in-memory stores, so a handler spec of an event-sourced
aggregate needs no fake. With both choices on, the erasure destroys the key first. The event store
of the kit runs on PostgreSQL through the four ORM packages: `--event-sourcing on` is refused with
`--orm custom`, with what to bind instead, and `generate aggregate --event-sourced` is refused
while the project has no event store, with the `init --force --event-sourcing on` to run. The
architecture reference (section 2), the CLI README, the config reference, the event sourcing page,
the persistence skill and the stack criteria say it.

To move: a project generated before this version keeps its platform as it is; `npx ddd-ts-kit init
--force --privacy on` writes the privacy folder and the two scripts, `npx ddd-ts-kit init --force
--event-sourcing on` the event store, then a migration creates the tables of the `event_store`
schema (`npm run db:generate event-store`).

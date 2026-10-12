# Event sourcing, per aggregate

**Summary.** An event-sourced aggregate keeps no row of state: it keeps the facts that happened
to it, in order, and its state is what replaying them gives. The kit offers it per aggregate,
never per project: the other aggregates of the context keep their state in tables, in the same
transactions. Choose it where the history is the business; it costs storage that only grows,
stored events that can never be edited, personal data that has to be sealed, and projections
that lag. This page says when to choose it and when not, how the kit builds it, and how to move
an aggregate to it and back. The rules are in [ARCHITECTURE.md](../ARCHITECTURE.md), section 4
("Event-sourced aggregates"), and `event-sourcing/*` of section 3.

## What it is

A state-persisted aggregate is saved as its current state: the row says what is true now, and
what was true before is gone unless something else kept it. An event-sourced aggregate is saved
as the events it recorded: `AttendanceRecordCreated`, then `NoShowNoted`, then
`CancellationNoted`. Loading it replays them, oldest first, through one apply method per event;
the result is the state its next command decides on. Nothing else ever writes the state, so the
state a command leaves and the state a later load rebuilds are the same.

The events of one aggregate form its stream. The store keeps every stream, and the whole store
in the order the appends committed, so that projections can follow it.

## When to choose it, and when not

| Choose it when | Prefer state in a table when |
|---|---|
| the history is what the business works with: what happened, in which order, who decided, as it was believed then (an attendance record, a ledger, a claim, a dossier) | the business asks what is true now, and the history is a log for support |
| a later question needs facts nobody stored as columns ("how many patients missed twice after a cancellation?") | the reads are lists and details of the current state |
| several read models are derived from the same facts, and new ones will be added and filled from the past | one read model, or none |
| corrections are themselves facts (a reversal, a forgiveness), never an edit | corrections are edits |
| the aggregate is small and lives long, with a modest number of events per stream | a stream would grow without bound in a short time, or the aggregate is a document edited field by field |

An audit trail is not a reason by itself: the kit records who did what around every use case
([Audit trail](audit-trail.md)), whatever the persistence of the aggregate.

## What it costs

| Cost | What it means here |
|---|---|
| Storage only grows | a stream is never shortened; snapshots shorten the replay, not the stream |
| Stored events are immutable | the shape of an event stored once is read for as long as the aggregate lives: a change is a new version with an upcaster, forever (`event-sourcing/upcaster-required`) |
| Personal data | an event cannot be edited to forget a person: personal values are sealed with a key per data subject, and erasure destroys the key (below) |
| Projections lag | a projection fed by the store is eventually consistent with the streams; a read that must see the write it follows reads the aggregate, or a projection fed inside the unit of work |
| Appends are serialised | the PostgreSQL store gives positions in commit order by locking the head of the store until each appending transaction ends: two appends never run side by side, whatever their streams. Fine for a business aggregate, not for a firehose |
| Debugging | the state is not in a row: a bug is found by replaying a stream, which the tests do without a database (`givenEvents`) |
| The team | apply methods, upcasters, snapshots and rebuilds are new habits; the rules hold the mechanical part |

## How the kit builds it

| Piece | Where | What it does |
|---|---|---|
| `EventSourcedAggregate<E, S>` | kernel, `domain/` | a command checks its invariants on the state, then `this.record(event)`; the event is applied through the method `appliers()` names for it and kept for the save. `rehydrate(id, history)` replays, from a snapshot when there is one |
| apply methods | the aggregate | `apply<Fact>(event)`, one per event, the only place that writes the state (`event-sourcing/state-in-apply`); they record nothing |
| the codec | `infrastructure/persistence/<aggregate>-events.mapper.ts` | `defineStoredEvent(Event, { version, encode, decode, upcasters })` per event, with the named type of its data |
| the repository | the port in `domain/repositories/`, its adapter in `infrastructure/persistence/` | the same port as any aggregate; the adapter delegates to `EventSourcedRepository`, which appends at the version the aggregate was loaded at (a `ConcurrencyError` otherwise) |
| the store | `EventStore` port; PostgreSQL through knex, drizzle, prisma and TypeORM; in memory for tests | append with an expected version, each stream in order, the whole store by position, held to one contract suite |
| snapshots | `SnapshotPolicy` of the repository, per aggregate | every so many events, a shape version of their own; `expectSnapshotEquivalence` proves them |
| projections | `@Projection(name, { feed: 'event-store' })` | applied by a `CatchUpSubscription` with a stored checkpoint, rebuilt from position zero by `EventStoreProjectionRebuild` |

`ddd-ts-kit generate aggregate <context> <Name> --event-sourced` writes the aggregate with its
birth event and apply method, the codec, a builder that replays a history and a given-events
spec; `generate domain-event` on such an aggregate adds the event to its union, to
`appliers()` with an empty apply method, and to the codec. `describe`, `list` and `CONTEXT.md`
say which aggregates are event-sourced.

**No double write.** Appending the events and publishing the integration events are one
transaction: the store joins the transaction of the unit of work, and the publisher is a
before-commit handler of the domain events, which writes the outbox. The kit chose "the store
feeds the outbox" over "the outbox reads the store": the integration events keep the outbox,
its relay, its retries and its published language, and an event-sourced aggregate publishes
exactly like a state-persisted one. `eventStoreUnitOfWorkContract` holds every transactional
store to it: nothing is published for an append rolled back or refused by a concurrency
conflict.

**Boundaries.** The domain and the use cases never name the store
(`event-sourcing/store-behind-repository`): they load and save through the port. A projection
never appends to a stream (`event-sourcing/projection-never-appends`). Events are named in the
past tense (`event-sourcing/past-tense`).

## Stored events are versioned like contracts with the past

An integration event is a contract with other contexts ([Event versioning](event-versioning.md));
a stored event is a contract with every past version of the code. The kit applies the same
discipline with its own mechanism:

1. The data of a stored event is a named type in its codec file, answered by `encode`.
2. `ddd-ts-kit docs --stored-events` records the fingerprint of that type for each version in
   `stored-events.lock.json`, when a version starts being stored where events are kept (before
   the release that ships it). A recorded version is never rewritten.
3. A change of the type is a new version: `version: 2` and the upcaster from version 1,
   `upcasters: { 1: (data) => ({ ...data, reason: '' }) }`. The stored event is never rewritten:
   it is upcast each time it is read.
4. `ddd-ts-kit check` refuses a recorded version whose shape changed, a version above 1 without
   an upcaster from each version below, and a version below the last recorded. ESLint holds the
   two checks one file shows.

A domain event can change freely as long as `encode` and `decode` still map it to and from the
stored shapes: the stored type, not the class, is the contract.

## Personal data: crypto-shredding

An event cannot be edited to forget a person, and backups keep it anyway. The kit seals
personal values instead:

- `personalData(subjectId, value)` marks a value in `encode`; `PersonalDataCipher` seals it with
  the key of its data subject (AES-256-GCM, a fresh nonce per value, the key id written next to
  it) before it reaches the store, and opens it when the event is read.
- `SubjectKeyStore` is the port of the keys, one per subject: in memory, or a table of the
  PostgreSQL store. `erase(subject)` deletes the key: every value sealed with it, in every
  stream, snapshot and backup, can no longer be read, and a replay reads `ERASED_PERSONAL_DATA`
  (`[erased]`) in its place. A later key of the same subject never opens an older value.
- A projection rebuilt after an erasure shows the erased value; a projection that already holds
  the clear value has to be rebuilt, or to apply an erasure event of its own.

What it does not do: identifiers are not sealed. A stream named after a patient
(`scheduling.attendance-record-<practice>.<patient>`) keeps that identifier in the store. Use
identifiers that mean nothing outside the application, and keep the backups of the key table
within the retention the erasure promises.

## Projections fed by the store

A projection that only needs the facts of its own context is usually applied where the domain
events are dispatched, in the transaction of the command. A projection of event-sourced
aggregates can instead follow the store: declared `@Projection(name, { feed: 'event-store' })`,
it is applied by a `CatchUpSubscription` under its name, which reads the store after its
checkpoint, applies a batch and moves the checkpoint in one unit of work. A projection added
later starts at position zero and so is filled from the whole history. `EventStoreProjectionRebuild`
replays the store into an empty copy of the read model and swaps it in, without stopping the
subscription. Each row is stamped with the version of its stream (`storedStampOf`), so an event
applied twice changes nothing.

## Testing

- `givenEvents(rehydrate, events).when(command).thenEvents([...])`: the behaviour of the aggregate
  from a history, without a database.
- `expectSnapshotEquivalence({ events, rehydrate, policy, state })`: a snapshot rebuilds the
  state of the full replay, for every version of the history.
- `eventStoreContract` and `eventStoreUnitOfWorkContract` for a store; the repository contract of
  the kit applies to the adapter like to any other.

## Moving an aggregate to event sourcing, and back

**To event sourcing**, one aggregate at a time:

1. Generate the codec and the events with the CLI, and add the apply methods: the aggregate
   compiles against both its rows and its events while the rest of the steps run.
2. Declare a birth event that carries the whole current state (`<Name>Migrated`, or the birth
   event with its fields), with its stored shape.
3. A migration script, in one transaction per batch: for each row, append that event to the
   stream of the aggregate at version 0. A stream that already exists is skipped: the script can
   run again.
4. Switch the binding of the repository port to the event-store adapter. The table becomes
   read-only; drop it in a later migration, once a release has run on the streams.
5. Rebuild the projections that the table fed, from the store if they become store-fed.

**Back to state in a table**: replay each stream once into the state, write the row, switch the
binding of the port back, and keep the streams as an archive or delete them, after checking what
the law asks of the history (the erasure keys go with them). Both directions keep the port, the
use cases and the domain events untouched; only the aggregate's internals, its adapter and its
storage change.

## What each adapter gets

| Store | Status |
|---|---|
| in memory | `InMemoryEventStore`, `InMemorySnapshotStore`, `InMemoryCheckpointStore`, `InMemorySubjectKeyStore`: tests and single-process applications; not transactional |
| PostgreSQL through knex | `createKnexEventSourcing`, tables by `createEventStoreTables` in a migration |
| PostgreSQL through drizzle | `createDrizzleEventSourcing`, tables declared by `eventStoreTables` for drizzle-kit |
| PostgreSQL through Prisma | `createPrismaEventSourcing` over the raw queries of the client, models of `prisma/event-store.postgresql.prisma` |
| PostgreSQL through TypeORM | `createTypeOrmEventSourcing` over the entity manager, tables as `eventStoreEntities` |
| MySQL, SQLite | not provided: the store relies on PostgreSQL statements (a `jsonb` record set, an update and an insert in one statement) |
| KurrentDB (EventStoreDB) | a later adapter. Its streams, expected revisions and `$all` subscriptions fit the port, but it is a separate store: the outbox and the processed-event store of the context cannot share its transaction, so "no double write" would move to "the outbox reads the store" (a subscription that publishes), its positions are log offsets, not the gapless 1, 2, 3 the contract states, and its client and server image are too heavy for the suites of this repository to run it honestly |

All the PostgreSQL stores are one implementation in the kernel (`PostgresEventStore` and its
companions over a `SqlRun`); each ORM package only runs its statements, and each is held to the
same contract suites.

## Limits

- One event store per database schema; a context that keeps its own binds its stores in its
  module rather than in the platform.
- Appends are serialised per store (above).
- A projection fed by the store whose rows each come from several streams cannot be stamped by
  stream version alone: stamp it by event id and instant.
- The past-tense check is a list of words, not a grammar; an irregular verb it does not know is
  suppressed with a reason.
- `generate projection` and `generate repository` have no event-sourced form yet: the
  projection fed by the store and the repository adapter are written by hand (the example shows
  both).

## Sources

- Martin Fowler, "Event Sourcing", 2005, https://martinfowler.com/eaaDev/EventSourcing.html
- Greg Young, Versioning in an Event Sourced System, Leanpub, 2017
- Vaughn Vernon, Implementing Domain-Driven Design, Addison-Wesley, 2013, appendix A
- Martin Kleppmann, Designing Data-Intensive Applications, O'Reilly, 2017, chapters 4 and 11
- "Crypto-shredding", as described for event stores by Mathias Verraes and others: erase by
  destroying the key

## See also

- [Aggregates](aggregates.md), [Domain and integration events](domain-and-integration-events.md)
- [Transactional outbox](transactional-outbox.md), [Event versioning](event-versioning.md)
- [CQRS as used here](cqrs.md)
- The example: `examples/scheduling`, the attendance record of the scheduling context

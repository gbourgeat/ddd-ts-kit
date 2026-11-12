**English** · [Français](cqrs.fr.md)

# CQRS as used here

**Summary.** Command Query Responsibility Segregation separates the code that changes state from
the code that answers questions. This kit applies the light form: every use case is either a
command or a query, each with one handler, reached through a command bus or a query bus. A
command goes through the aggregate and returns at most an identifier; a query never changes
state and may read a projection through a port without loading aggregates. Aggregates keep their
state in tables unless one is chosen to be event-sourced, and there is no second database by
default. This page says what that buys, what it does not, and
when the split is not worth having.

## From a method rule to an architecture rule

Bertrand Meyer's command-query separation is a rule about methods: a method either changes state
or returns a value, not both. Greg Young and Udi Dahan lifted it to the level of the model:
use one model to write and another to read, because the two have different shapes and different
loads. Fowler's summary and warning is the usual reference: the split helps in a minority of
complex domains and adds risk elsewhere.

The kit takes the part that costs little and pays in every project:

| Element | Rule in this kit |
|---|---|
| a use case | one command or one query, in its own folder, with one handler |
| a command | changes state through one aggregate; returns nothing or an identifier |
| a query | changes nothing; returns a view shaped for the caller |
| the way in | `CommandBus` and `QueryBus`, never a handler class |
| what is common to all use cases | a bus middleware, not code repeated in handlers |

The normative text is [ARCHITECTURE.md](../ARCHITECTURE.md) section 4 ("Use cases", "Buses");
the shape of a handler is `application/handler-shape`, and a query that saves, deletes or
publishes is reported by `application/command-query-separation`.

## The two paths, on the scheduling application

![The two paths of one context: POST /appointments goes through the command bus and its middlewares to the BookAppointment handler, which changes the Appointment aggregate and saves it through its repository port; GET /appointments goes through the query bus to the SearchAppointments handler, which asks a read port; both adapters read and write the same appointments tables](../assets/diagrams/cqrs-two-paths.svg)

**Command.** `BookAppointment` carries the actor and the requested slot. The handler loads what
it needs, calls one intention method (`Appointment.book(...)`), saves through the repository
port and does nothing else: the save hands the recorded events over, and the unit of work
dispatches them once the handler has returned, before the commit. It answers the identifier of
the new appointment and nothing else: the client that wants to display the appointment sends
`GetAppointment`. Returning the whole aggregate would tie the response to the write model.

**Query.** `SearchAppointments` needs twenty rows of five columns, filtered by what the actor may
see and paginated. Loading twenty aggregates with their invariants to throw most of the state
away is waste. The handler asks a read port, whose adapter queries the tables directly and
returns the shape the port declares. The access scope computed by the authorizer goes into that
query, so nothing is filtered in memory after loading (see
[Authentication and authorization](authentication-and-authorization.md)).

Both paths read the same tables. The read side is a different code path, not a different
database.

### The query path in code

A query names its answer in its type, a read port declares the shape the caller needs, and the
handler asks the port. The bus infers the answer from the query, so the route gets a typed
result without knowing the handler:

<!-- checked sample -->
```ts
import { definePermissions } from '@ddd-ts-kit/auth';
import { AuthorizedQuery, InMemoryQueryBus, type Actor, type BusMiddleware, type Logger } from '@ddd-ts-kit/kernel';
import { QueryHandler, Requires } from '@ddd-ts-kit/kernel/declarations';

const appointmentsPermissions = definePermissions('appointments', {
  'appointment.search': { description: 'Search the appointments of a practitioner' },
});

// application/ports/appointment-lines.port.ts: the shape the screen needs, not the aggregate
export interface AppointmentLine {
  readonly id: string;
  readonly startsAt: string;
  readonly clientName: string;
}

export abstract class AppointmentLines {
  abstract ofPractitioner(practitionerId: string, limit: number): Promise<readonly AppointmentLine[]>;
}

// application/queries/search-appointments/search-appointments.query.ts
@Requires(appointmentsPermissions['appointment.search'])
export class SearchAppointments extends AuthorizedQuery<readonly AppointmentLine[]> {
  constructor(
    actor: Actor,
    readonly practitionerId: string,
  ) {
    super(actor);
  }
}

// application/queries/search-appointments/search-appointments.handler.ts: reads, never saves
@QueryHandler(SearchAppointments)
export class SearchAppointmentsHandler implements QueryHandler<SearchAppointments> {
  constructor(private readonly lines: AppointmentLines) {}

  execute(query: SearchAppointments): Promise<readonly AppointmentLine[]> {
    return this.lines.ofPractitioner(query.practitionerId, 20);
  }
}

// platform/buses/: what every query goes through, written once for all of them
declare const logger: Logger;
declare const lines: AppointmentLines; // the adapter the platform binds to the port

const logged: BusMiddleware = async (message, next, info) => {
  logger.info('use case', { kind: info.kind, name: info.name });

  return next();
};

const queryBus = new InMemoryQueryBus()
  .use(logged)
  .register(SearchAppointments, new SearchAppointmentsHandler(lines), { context: 'appointments' });

// presentation/: the route knows the bus and the query, never the handler
export async function appointmentsOf(actor: Actor, practitionerId: string): Promise<readonly AppointmentLine[]> {
  return queryBus.execute(new SearchAppointments(actor, practitionerId));
}
```

In a generated project the buses are built in `src/platform/buses/`. In the declared style the
handlers are registered from their declarations; in the explicit style the module of the
context calls `register` for each one, as the sample does to show what the bus holds (see
[Ports and composition](ports-and-composition.md)).

### Two habits the rules hold

Instead of a command that hands the aggregate back to the caller:

```ts
export class BookAppointment extends AuthorizedCommand<Appointment> { /* ... */ }
// the route serialises the aggregate: the response is now tied to the write model
```

write a command that answers its identifier, and a query for what the client displays:

```ts
export class BookAppointment extends AuthorizedCommand<string> { /* ... */ }
const id = await commandBus.execute(new BookAppointment(actor, calendarId, startsAt));
const appointment = await queryBus.execute(new GetAppointment(actor, id));
```

Instead of a query that changes state on the way:

```ts
async execute(query: GetAppointment): Promise<AppointmentView> {
  const appointment = await this.appointments.findById(query.appointmentId);
  appointment.markSeenBy(query.actor.id);
  await this.appointments.save(appointment); // application/command-query-separation
  return toView(appointment);
}
```

write the change as a command of its own (`MarkAppointmentSeen`), sent by the caller that
wants it, and keep the query a pure read.

## Why buses

A route could call a handler directly. The buses exist for three reasons:

1. **One place for what every use case needs.** The generated platform
   (`src/platform/buses/`) puts on the buses, as middlewares and outermost first: the report of
   an unexpected failure (when the stack has an error tracker), the log entry, the measure, the
   permission check, the span of the use case, the staging of an uploaded file and the wake-up
   of the outbox relay (commands only, when the stack has them), the audit entry (when the
   audit trail is on) and, for commands, the unit of work. A handler contains none of it, so
   none of it can be forgotten in a new handler.

   ![The middlewares of the generated buses, outermost first: error report, log, measure, permission, span, file staging, relay wake-up, audit entry and unit of work around a command handler; error report, log, measure, permission, span and audit entry around a query handler; the parts that depend on the stack are marked](../assets/diagrams/cqrs-middlewares.svg)
2. **One way in for every caller.** A route, an integration event handler and a scheduled job
   all send a command. The use case is authorized, audited and run in a transaction the same
   way whoever started it.
3. **A seam.** The buses are ports of the kernel with in-process implementations. Another
   transport is an adapter chosen in the composition root; the callers do not change.

The price is one level of indirection: "go to definition" on `execute` lands on the bus, not on
the handler. The handler lives next to its command, in the same folder, which is how it is
found.

## What it buys

- **Use cases are visible.** The list of commands and queries of a context is its functional
  surface: `ddd-ts-kit describe <context>` prints it, and a permission is declared on each (`authz/declared`).
- **Reads stop bending the model.** An aggregate is sized for its invariants (see
  [Aggregates](aggregates.md)), not for the screens that display it. A new column in a list is a
  change of a read adapter.
- **Each side is tested the way it deserves**: behaviour for commands, the returned shape for
  queries.
- **Commands are easy to make idempotent and to audit**: they are named data, sent through one
  place.
- **The door to a separate read store stays open.** A read port can later be served by a
  projection fed by events, as `availability` is, without touching the callers.

## What it does not buy, and what the kit does not do

- **Event sourcing is a choice per aggregate, not part of CQRS.** Aggregates are stored as
  state by default, and their domain events are recorded to be dispatched at the end of the unit
  of work, not to rebuild them. CQRS and event sourcing are independent patterns that are often
  presented together: one aggregate whose history is the business can be event-sourced while
  the others keep their rows ([Event sourcing, per aggregate](event-sourcing.md)).
- **No separate read database.** A projection is a table of the
  consuming context. The runtime packages carry the read side: `Criteria` (filters, sort and
  page of a list, checked against a definition), hydration, the `ReadModelStore` port with a
  SQL table store, the `@Projection` and `@On` declarations of a projector and a rebuild
  (kernel README, "Criteria", "Hydration" and "Projections"). The CLI generates part of it:
  `generate query --search` writes a read port with an in-memory adapter and a fake, and
  `generate projection <context> <Name> <event-type>` writes a projector and its spec, in the
  both styles (in the explicit style on tsyringe the module file of the context includes it with
  `builder.include(<Name>Projection)`; on a platform wired by hand the class is plain and the module
  subscribes it under its consumer name), and
  `generate read-model <context> <Name> --field <name>:<type>...` writes the read model it keeps:
  the port over `ReadModelStore` with the type of its row and its criteria, the table in the schema
  of the context, the store adapter of the ORM of the project bound to the port, the fake, and a
  spec that runs `readModelContract` on both. The columns of the fields accept null, since a removed
  row is a trace that keeps its key and its stamp alone
  ([what a deleted row leaves](#the-table-of-a-read-model-and-what-a-deleted-row-leaves)), and a
  check constraint, `<table>_live_rows_whole`, keeps every other row whole (on Prisma, whose schema language has none, the statement is left to add to the migration);
  a text column a read sorts or compares by range takes the collation `"C"` in its migration, criteria
  ordering strings by code point. The
  status of each part is in the [read side proposal](../proposals/read-side.md).
- **No performance by itself.** Two code paths over one database scale like one database.
- **No asynchronous commands by default.** The in-process buses are awaited. A command answered
  "accepted" and processed later is a design the project builds on events.

## When a projection is the right read model

`availability` answers `FindOpenSlots`. The answer combines the working hours and time off held
by `calendars` with the appointments held by `appointments`. Asking both contexts at each search
would couple three contexts at run time. Instead `availability` keeps its own table of open
slots, updated when `calendars.calendar.working-hours-changed`,
`appointments.appointment.booked` or `appointments.appointment.cancelled` arrive. The search is
one local query. The cost is that the answer can be a moment late: a slot shown as open may have
been taken a second ago, and `appointments` is what refuses the double booking (see
[Eventual consistency](eventual-consistency.md)).

![A projection as read model: calendars and appointments publish integration events through their outbox; the projector of availability applies them to its own open slots table; the FindOpenSlots query reads that table alone, and booking itself is still refused by appointments when the slot is taken](../assets/diagrams/cqrs-projection.svg)

The projector applies each event to one row, and its store writes only when the event is newer
than the one the row holds, so a redelivery or a late event changes nothing. A booking says the
whole row of its slot; a cancellation changes the row its booking wrote:

<!-- checked sample -->
```ts
import { defineIntegrationEvent, type PayloadOf } from '@ddd-ts-kit/events';
import { ReadModelStore, stampOf, type IntegrationEvent, type ReadModelWrite } from '@ddd-ts-kit/kernel';
import { On, Projection } from '@ddd-ts-kit/kernel/declarations';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { z } from 'zod';

// appointments/published-language/: what availability may know of a booking
const slotTaken = z.object({ appointmentId: z.string(), calendarId: z.string(), startsAt: z.iso.datetime() });

export const appointmentBooked = defineIntegrationEvent({
  type: 'appointments.appointment.booked',
  version: 1,
  payload: zodSchema(slotTaken),
});

export const appointmentCancelled = defineIntegrationEvent({
  type: 'appointments.appointment.cancelled',
  version: 1,
  payload: zodSchema(slotTaken),
});

// availability/application/ports/open-slots.port.ts: the read model, one row per slot
export interface OpenSlotRow {
  readonly calendarId: string;
  readonly startsAt: string;
  readonly open: boolean;
}

export abstract class OpenSlots extends ReadModelStore<OpenSlotRow> {}

// availability/application/projections/open-slots.projection.ts
const keyOf = ({ calendarId, startsAt }: PayloadOf<typeof appointmentBooked>) => `${calendarId}@${startsAt}`;

@Projection('availability.open-slots')
export class OpenSlotsProjection {
  constructor(private readonly slots: OpenSlots) {}

  @On(appointmentBooked)
  booked(event: IntegrationEvent<PayloadOf<typeof appointmentBooked>>): Promise<ReadModelWrite> {
    const { calendarId, startsAt } = event.payload;

    // the event says the whole row: it creates it, or replaces what an older event wrote
    return this.slots.upsertIfNewer(keyOf(event.payload), stampOf(event), () => ({ calendarId, startsAt, open: false }));
  }

  @On(appointmentCancelled)
  cancelled(event: IntegrationEvent<PayloadOf<typeof appointmentCancelled>>): Promise<ReadModelWrite> {
    // the event changes part of a row a booking created: without that row, the answer is `missing`
    return this.slots.updateIfNewer(keyOf(event.payload), stampOf(event), (row) => ({ ...row, open: true }));
  }
}
```

`FindOpenSlots` then reads `OpenSlots` with a criteria, like any other read port. The
projector sends no command and reads no other context: it only keeps its table current.

### Which write for which event

| The event | The write | When the key holds no row |
|---|---|---|
| says the whole row, or may create it | `upsertIfNewer(key, stamp, next)` | `next` is handed `undefined` and the row it answers is written |
| does not concern this read model | `upsertIfNewer` whose `next` answers `undefined` | nothing is written: `ignored` |
| changes part of a row another event created | `updateIfNewer(key, stamp, change)` | nothing is written: `missing` |
| removes the row | `delete(key, stamp)` | the trace is written: `traced` |

**A write that carries the whole row is right in any order.** Whatever the deliveries, the row
ends as the latest event says. Prefer it: an event that states what it leaves (the booking above,
with its calendar, its start and `open`) needs nothing of the events before it.

**An event that changes part of a row is right only when the events of its key are applied in
order.** The store refuses to go back in time, and that is all it does. It cannot put back what
arrived out of order:

- a change delivered before the creation of its row finds nothing to change: `updateIfNewer`
  writes nothing and answers `missing`. The creation then writes the row as it was at first, and
  the change is not applied again by the store;
- of two partial changes delivered out of order, the older one is `stale` and acknowledged: what
  it alone said is lost;
- over the trace of a deletion, a change that is not later than the deletion is `stale`, and a
  later one is `missing`: the row was removed, by its history or outside it.

So `updateIfNewer` is not a cure for disorder. It is the write of a partial change on a feed that
keeps the order of a key, and it tells a missing row (`missing`) from a filtered event (`ignored`),
which `upsertIfNewer` with a `next` answering `undefined` could not.

**Which feeds keep the order of a key.**

| Feed | Order of the events of one key | A failed event |
|---|---|---|
| domain events of the context, applied in the save (`@On(EventClass)`, the default feed) | the order the aggregate recorded them, in the transaction of the save | fails the save, and so the command; nothing delivers it again |
| the event store, by a catch-up subscription (`feed: 'event-store'`) | the order of the store | the batch is rolled back and read again at each poll, until it passes: every stream waits behind it |
| the in-process bus, without outbox | the order of `publish`, one event at a time | `publish` rejects to the use case, after the other handlers ran; nothing delivers it again |
| the outbox relay, `ordering: 'none'` (the default) | none: a failed record is overtaken by its successors, and several relays interleave | retried with a backoff, then dead |
| the outbox relay, `ordering: 'per-key'` | kept while one relay runs: a record waits for the earlier records of its key | blocks the later events of its key until it goes out or is dead |
| Kafka | the order of a partition: a failed record is retried in place | the partition is paused for the whole group between attempts, then the record is dead and its successors go on without it |
| RabbitMQ, NATS, Redis Streams | none: several messages are handled at once and a retry comes back after its successors | a few attempts at a constant delay, every handler of the consumer run again, then dead |

**What to do with `missing`.** The projection decides, since only it knows its feed:

- **Fed in the save or by a catch-up subscription: answer it, never throw.** The events are in
  order there, so a missing row is a row this read model does not keep, or one removed outside the
  history (an erasure). A throw would fail the command for ever, or stall the subscription.
- **Fed by a broker without order (RabbitMQ, NATS, Redis Streams, a relay without `per-key`):**
  prefer events that carry the whole row. Where a partial change is all the upstream gives,
  throwing an error of your own on `missing` makes the provider retry, then dead-letter
  ([when a handler keeps failing](delivery-and-idempotency.md#when-a-handler-keeps-failing)): a
  few attempts over some seconds, which a creation that is itself late outlasts, and every
  handler of the consumer runs again on each. Answering `missing` instead drops the change and
  counts it.
- **On Kafka, do not throw for it.** A change ahead of its creation on the same partition can
  never succeed by waiting, and each attempt pauses the partition for the whole group.
- **Count it.** `projection_events_total` has the result `missing`: a count that grows is a
  change that arrived before its creation, or after a removal.

**One kind of stamp per key.** `stampOf(event)` orders by the instant of the event, then by its
id; `stampOf(event, version)` orders by a version the upstream counts per key. The order is total
within each kind: the latest of a set of events is the same whatever the order of their
deliveries. When one stamp has a version and the other has none, the instants decide, and that is
not an order: with A (version 1, 12:09), B (no version, 12:05) and C (version 2, 12:01), C is
newer than A, A newer than B and B newer than C, so the row that stays depends on the order of the
deliveries. Stamp every event that writes a key the same way, the rows of the source of a rebuild
included. The one mix that is meant is a deletion made outside the history of the key, such as an
erasure stamped at the clock: it is later than everything the row saw, and the instants say so.

### The table of a read model, and what a deleted row leaves

`delete(key, stamp)` does not take the row out of its table. It leaves a trace: the key, the
stamp and `deleted = true`, and nothing else. The trace is what makes a deletion hold whatever
the order of the deliveries: an older event that arrives later finds a newer stamp and changes
nothing. That holds for a key the table does not hold yet: a deletion delivered before the
creation it follows inserts the trace, and the late creation is `stale`. Such a deletion answers
`traced`, not `applied`: it recorded its trace and removed no row, as a deletion over an earlier
trace does. Code that counts what it removed (an erasure that reports what it reached) counts
`applied` alone. On an SQL store, this
asks four things of the table and of whoever reads it:

- **Every column of the row is nullable.** A trace keeps no data: every column the store maps
  holds NULL, the key, the tenant and the stamp apart, so the personal data of a deleted row is
  gone and a unique value it held is free again. A table whose columns refuse NULL is refused by
  name (`ReadModelTableNotReadyError`): when the store is built on Drizzle
  and TypeORM, from the definition, and on the four ORM before the first trace is written, from
  one read of the columns the database holds, so a migration not run yet is caught too, and never
  by a statement that would abort the transaction of the event. Its message names the table, what
  keeps it from holding a trace, what the check constraint is, and the migration to write, as
  statements that name the columns the store maps and no other. On Prisma the fields of the model are optional as well (`String?`). An application
  does not wait for that first trace: [every table is checked when it starts](#every-table-checked-at-the-start-and-before-a-deployment).
- **A check constraint keeps the live rows whole**, in place of the NOT NULL the columns no
  longer carry. `generate read-model` writes it with the table, under this name; a table written
  before, or by hand, takes it in a migration:

  ```sql
  alter table scheduling.appointment_list
    alter column status drop not null,
    alter column starts_at drop not null,
    add constraint appointment_list_live_rows_whole
      check (deleted or (status is not null and starts_at is not null));
  ```
- **A reader that queries the table directly filters `deleted = false`.** The store does it in
  `get` and `search`; a statement of your own (a join, an aggregate) has to.
- **Traces are never purged.** A purge by `last_event_at` is unsafe: the stamp is the instant of
  the event, not of its delivery, so no age of a trace tells that an older event of its key will
  not be delivered again, and that event would then recreate the row.

**The key is unique across tenants.** The trace of a read model of tenant data carries the tenant
of the work, and its key is taken for every tenant, as the key of a live row is: a key two
tenants could share is a generated id or carries the tenant (`acme:2026-03-01`). Under a key
another tenant holds, a deletion is `ignored`, since nothing of this tenant is there to delete
and its trace cannot be written, and an upsert is refused at once with
`ReadModelKeyHeldElsewhereError`, a `ConcurrencyError` whose message says so. Work elevated over
several tenants reads such a key as held and writes only in its own tenant, so its write of a key
another tenant holds still ends, after five attempts, in a plain `ConcurrencyError`.

**A table may hold another value of the row unique** (a slug, a number, by a unique index of your
migration). The database keeps it: a row that takes the value a live row of another key holds is
refused, by the error of the driver or by `UniqueViolationError`, and the handler of the event sees
it; the trace of a deleted row frees its value. Events of one key applied at once are never refused
for the value they all write. PostgreSQL can refuse them when the insert names the key alone as its
conflict target, since two inserts that cross then meet on the other index first: the stores of the
four ORM insert with a statement that skips on any unique value, and only when it wrote nothing with
a second one that names the key, which tells a key that is held, for which the event is compared
with the row and applied if newer, from a value another row holds, which is refused.

### Every table checked at the start, and before a deployment

A store refuses its table before its first trace, and on Drizzle and TypeORM when it is built. A
container builds a store when something first asks for it, so in an application wired that way
both refusals come with the first request or the first event that reaches the read model, in
production, and one table at a time. Two things say it earlier, for every table at once.

**The tables an application lists.** `ReadModelTables` of the kernel takes a list of entries, each
of which builds the store of one read model as the application binds it: the same class, with the
same options. Each table is then read by its own store, through the code that store runs before
its first trace (`tableState()`, on the four ORM): the verdict is the store's by construction, not
a second opinion. A table is ready exactly when the store will write a trace in it. Nothing is
guessed from the database: a table nobody lists is never read, whatever columns it carries
(another service in the same database, a backup, a schema the role cannot use), and an empty list
checks nothing and says nothing. `states()` answers what each listed table can hold, `notReady()`
those that cannot hold a trace, `require()` refuses with `ReadModelTablesNotReadyError`, one
error that names them all:

```text
1 read model table is not ready for this version: notification.contacts. Apply the migrations of the project before the application starts; a table they leave as it is takes the migration written under its name.

The read model table notification.contacts cannot hold the trace of a deleted row: "address" refuses NULL. A deleted row keeps its key, its tenant and its stamp only. The check constraint contacts_live_rows_whole, which keeps the live rows whole, is missing. The migration to write:
alter table "notification"."contacts" alter column "address" drop not null;
alter table "notification"."contacts" drop constraint if exists "contacts_live_rows_whole";
alter table "notification"."contacts" add constraint "contacts_live_rows_whole" check ("deleted" or ("address" is not null)) not valid;
alter table "notification"."contacts" validate constraint "contacts_live_rows_whole";
update "notification"."contacts" set "address" = null, "label" = null where "deleted" and ("address" is not null or "label" is not null);
-- On a large table, run "validate constraint" in a transaction of its own (it then scans without stopping readers nor writers) and the update by ranges of the key: it rewrites only the deleted rows that still hold data.
```

**What a table is read for.** The columns the store maps as fields of its row, and no other: the
key, the tenant column under the name the store gives it, the stamp under the names the
definition gives it, a column the store does not map (a surrogate primary key, a column the
database fills, one that belongs to somebody else) are never counted, never altered and never
emptied. Of a mapped column the database says whether it refuses NULL, which a migration opens,
or whether nothing can open it: a part of the primary key, an identity column, a generated one, a
column the table does not have. Such a column is named with what it is and no statement is
written for it: the store has to stop mapping it as a field. A table that is not in the database
is said so, since its migration did not run. On Drizzle and TypeORM, a definition that declares a
field NOT NULL refuses the store when it is built, whatever the database holds: the list reports
that refusal like the others, and writes no statement before the definition is corrected.

**The migration.** It is written from that reading, one statement per line (`statements` of the
error holds them): NOT NULL dropped on the fields that refuse it; the check constraint written
again with the fields it held and those that just lost NOT NULL, added `not valid` then validated
by a statement of its own, so that the scan of the table runs under SHARE UPDATE EXCLUSIVE, which
stops neither readers nor writers, provided it runs in a transaction of its own; and the rows
deleted before emptied, those that still hold data alone. Every identifier is quoted. Run twice,
it ends where it ended the first time and fails on nothing. A constraint of that name that checks
something else is left as it is, and said.

**The check constraint is read, and is never a refusal.** A table whose fields accept NULL holds a
trace whether or not a constraint keeps its live rows whole, and a row may require no field: the
verdict is about the columns. What the database holds under `<table>_live_rows_whole` is read all
the same, on the four ORM alike: missing, held with the fields it names, not validated, or a
check of something else. A constraint that is not validated, or that checks something else, is a
warning at the start and a line of `db:read-models`, with the statement that validates it.

**At the start.** A generated project keeps the list in
`src/platform/database/read-model-tables.ts`, between markers: `generate read-model` adds the
store it writes, `init --force` keeps what the list holds, a store written by hand is added by
hand. The application checks it when it starts, before a consumer is subscribed or a request
served (the platform module on tsyringe, InversifyJS and Awilix, in the declared and the explicit
style; `start` of `compose-application.ts` on a platform wired by hand): the worker, a service of
one context and the end-to-end tests start through it too. It is on by default, two short reads
of the catalog per listed table, no row and no lock.

**A deployment that starts the application before its migrations ran.** By default the start
fails, and that is the safe answer of a rolling deployment: the new instances never become ready,
the old ones keep serving, and the new ones start once the migration ran. A pipeline in which the
migration waits for the new version to be up would wait for ever: it passes
`readModelTables: 'reported'` to `composeApplication` in `main.ts`. The same message is then
logged as one error, the start goes on, and each store still refuses by name before its first
trace.

**Before a deployment.** `DATABASE_URL=<the database of the deployment> npm run db:read-models`
runs the same check from the command line (`scripts/read-model-tables.ts`). It needs the address
of the database and no other variable of the application, prints how many tables it read and
their names, then the warnings and every refusal, and its exit code tells the cases apart: 0 when
every listed table is ready, 1 when one is not, 2 when `DATABASE_URL` names no database, 3 when
the database could not be read. Run against the database of the environment once its migrations
ran, it is the gate of the deployment; run after `npm run db:migrate` on an empty database, as a
pipeline has one, it says the same of the migrations of the project, a table they never create
included. It is a script of the project and not a command of `ddd-ts-kit`, which has no database
driver: the script reads through the stores the project already has. Nothing reads the migration
files themselves: the four tools write them in four forms, and what a file says of a column is
not what the database holds once every migration ran.

What the check does not do:

- **A store that is not listed is not checked.** A project generated before fills the list by
  hand; a read model whose store is missing from it is refused, as before, by its own store before
  its first trace.
- **A database per tenant** is checked through the connection of each; a schema per tenant through
  the search path of the connection the check is given.
- **A read model on OpenSearch or in memory has no such table.** The trace of a deletion is a
  document that keeps its key and its stamp, and a mapping refuses no absent field: there is
  nothing to migrate, and the index of each store is provisioned at the start already. Listed, such
  a store has nothing to say.

## Limits and when not to use it

- **A CRUD context with no rules** (a list of rooms, a settings screen) gains little from a
  command, a handler, a bus and a read port per operation. The generator makes the files cheap
  to create, not cheap to read. A `generic` or thin `supporting` context can keep a trivial
  model; whether to drop the split for it is a recorded decision, not a habit.
- **"A command returns at most an identifier" has friction.** A client that needs the created
  resource makes a second call. That is deliberate; when the round trip matters, the route can
  send the query after the command and answer its result.
- **Read-your-own-writes is not automatic** once a read comes from a projection fed by events.
  Either read that screen from the write tables, or design the UI for the delay.
- **Middleware order matters and is invisible from a handler.** Read
  `src/platform/buses/create-command-bus.ts` and `create-query-bus.ts` to know what wraps a use
  case.
- **A query handler that needs a rule of the domain** (a price, an eligibility) should call the
  domain for it, not copy it into SQL. Bypassing aggregates is for shape, not for logic.

## Sources

- Bertrand Meyer, Object-Oriented Software Construction, 2nd edition, Prentice Hall, 1997
  (command-query separation).
- Greg Young, "CQRS Documents", 2010, https://cqrs.files.wordpress.com/2010/11/cqrs_documents.pdf
- Martin Fowler, "CQRS", 2011, https://martinfowler.com/bliki/CQRS.html
- Martin Fowler, "Event Sourcing", 2005, https://martinfowler.com/eaaDev/EventSourcing.html
- Vaughn Vernon, Implementing Domain-Driven Design, Addison-Wesley, 2013, chapter 4
  ("Architecture", the CQRS section).
- Vlad Khononov, Learning Domain-Driven Design, O'Reilly, 2021, chapter 8 (CQRS).

## See also

- [Layers and the dependency rule](layers-and-dependency-rule.md)
- [Ports and composition](ports-and-composition.md)
- [Aggregates](aggregates.md)
- [Eventual consistency](eventual-consistency.md)
- [Domain and integration events](domain-and-integration-events.md)
- [Authentication and authorization](authentication-and-authorization.md)
- [Read side proposal](../proposals/read-side.md)
- [Architecture reference](../ARCHITECTURE.md)

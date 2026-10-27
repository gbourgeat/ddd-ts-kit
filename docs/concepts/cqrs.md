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
- **No separate read database, and no generated read store.** A projection is a table of the
  consuming context. The runtime packages carry the read side: `Criteria` (filters, sort and
  page of a list, checked against a definition), hydration, the `ReadModelStore` port with a
  SQL table store, the `@Projection` and `@On` declarations of a projector and a rebuild
  (kernel README, "Criteria", "Hydration" and "Projections"). The CLI generates part of it:
  `generate query --search` writes a read port with an in-memory adapter and a fake, and
  `generate projection <context> <Name> <event-type>` writes a projector and its spec, in the
  both styles (in the explicit style on tsyringe the module file of the context includes it with
  `builder.include(<Name>Projection)`; on a platform wired by hand the class is plain and the module
  subscribes it under its consumer name); the port of the read model and its store adapter come
  from `generate port` and the ORM package. The
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
than the one the row holds, so a redelivery or a late event changes nothing:

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
    // a slot outside the working hours has no row: answering undefined writes nothing
    return this.slots.upsertIfNewer(keyOf(event.payload), stampOf(event), (row) =>
      row === undefined ? undefined : { ...row, open: false },
    );
  }

  @On(appointmentCancelled)
  cancelled(event: IntegrationEvent<PayloadOf<typeof appointmentCancelled>>): Promise<ReadModelWrite> {
    return this.slots.upsertIfNewer(keyOf(event.payload), stampOf(event), (row) =>
      row === undefined ? undefined : { ...row, open: true },
    );
  }
}
```

`FindOpenSlots` then reads `OpenSlots` with a criteria, like any other read port. The
projector sends no command and reads no other context: it only keeps its table current.

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

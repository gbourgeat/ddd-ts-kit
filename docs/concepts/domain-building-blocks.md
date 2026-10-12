# Domain events, domain services, repositories and factories

**Summary.** Four building blocks complete entities, value objects and aggregates. A domain
event is a fact the business cares about, recorded by an aggregate in the past tense. A domain
service holds a business decision that belongs to no single aggregate. A repository gives the
illusion of an in-memory collection of aggregates, and hides storage behind an abstraction
owned by the domain. A factory builds a valid aggregate when construction is more than
assigning fields. In this kit a repository is an abstract class of the domain with adapters in
infrastructure, a domain service is stateless and performs no I/O, domain events stay inside
their context, and factories are static methods on the aggregate.

## Domain events

A domain event states that something happened: `AppointmentBooked`,
`AppointmentRescheduled`, `AppointmentCancelled`. It is named in the past tense, it is
immutable, and it carries the facts a reaction needs, never the aggregate itself.

```ts
// contexts/appointments/domain/events/appointment-cancelled.event.ts
import type { DomainEvent } from '@ddd-ts-kit/kernel';
import type { CancellationReason } from '@/contexts/appointments/domain/value-objects/cancellation-reason.vo';

export class AppointmentCancelled implements DomainEvent {
  readonly name = 'appointments.appointment.cancelled';

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly reason: CancellationReason,
  ) {}
}
```

The life of a domain event:

```mermaid
sequenceDiagram
  participant H as Command handler
  participant A as Appointment
  participant R as Repository
  participant D as Domain event handlers
  H->>A: cancel(reason, at)
  A->>A: check invariants, change state, record AppointmentCancelled
  H->>R: save(appointment), the recorded events are queued
  H-->>D: once the handler has returned, the queue is dispatched, in recording order
  D->>D: reactions inside the same context, before the commit
  Note over H,D: all inside the unit of work of the command, which then commits or rolls back
  Note over D: handlers declared after-commit run once it has committed
```

- The **aggregate records** the event in the method that made the change. It does not publish
  anything: it has no bus and no dependency.
- Events **are handed over by the save and dispatched at the end of the unit of work**: a
  repository method handed the aggregate queues the events it recorded, and once the command
  handler has returned they are dispatched in recording order, inside the transaction, before
  the commit ([ARCHITECTURE.md](../ARCHITECTURE.md), section 4, "Domain events"). Every handler
  sees every save of the command. The handlers and the outbox commit or roll back with the
  state change. A command handler only saves: it never calls `pullEvents()` and receives no
  dispatcher (`domain-events/dispatched-on-save`).
- A handler runs **before the commit** by default, and may only have effects the transaction
  covers. One whose effect is outside the database is declared `phase: 'after-commit'`: it runs
  once the transaction has committed, at most once, and never saves an aggregate. The phases
  and their failures are in
  [Domain and integration events](domain-and-integration-events.md).
- A **domain event handler** (`application/event-handlers/`) reacts inside the same context.
  A **publisher** (`application/integration/publishers/`) is a reaction whose job is to
  translate the domain event into an integration event for the other contexts.
- The name follows `<context>.<aggregate>.<fact>` (`events/name-format`).

A domain event is internal: it may carry value objects of the model and change shape freely
with it. What crosses a context boundary is an integration event, a versioned contract with a
schema. The difference, and why the two are kept apart, is in
[Domain and integration events](domain-and-integration-events.md).

Events are also the natural assertion of a domain test: given a state, when an intention, then
these events or this error ([Testing strategy](testing-strategy.md)).

```bash
npx ddd-ts-kit generate domain-event appointments Appointment Cancelled
npx ddd-ts-kit generate event-handler appointments Appointment Cancelled
```

## Domain services

Some decisions belong to the domain but to no single aggregate: they need two aggregates, or an
aggregate and a policy that has its own reasons to change. Forcing such logic into one
aggregate makes it reach for data it does not own; leaving it in the handler makes the
application layer decide business matters. A domain service is the third place.

```ts
// contexts/appointments/domain/services/booking-eligibility.service.ts
import { OutsideWorkingHours } from '@/contexts/appointments/domain/errors/outside-working-hours.error';
import type { PractitionerSchedule } from '@/contexts/appointments/domain/value-objects/practitioner-schedule.vo';
import type { TimeSlot } from '@/contexts/appointments/domain/value-objects/time-slot.vo';

export class BookingEligibilityService {
  assertBookable(slot: TimeSlot, schedule: PractitionerSchedule): void {
    if (!schedule.covers(slot) || schedule.isOffDuring(slot)) {
      throw new OutsideWorkingHours();
    }
  }
}
```

`PractitionerSchedule` here is the local projection `appointments` keeps of the working hours
and time off published by `calendars`: the handler loads it through a port and hands it over.

The rules for a domain service:

- **Stateless.** It holds no data between calls.
- **No I/O.** It receives the aggregates and values it reads as parameters; it does not load
  them. Loading is the handler's job, through repositories and ports. The reference describes
  it as "stateless domain logic over several aggregates".
- **Named in the language.** The class and its operation are terms of the glossary
  (`language/glossary-term`); `BookingHelper` is refused (`language/no-technical-name`).
- **It has a spec** (`test/spec-required`), with no test double: its inputs are built objects.

Do not confuse it with the two other things called "service":

| | Lives in | Does |
|---|---|---|
| domain service | `domain/services/` | a business decision over several domain objects, pure |
| use case (command or query handler) | `application/` | orchestration: load, call the domain, save, publish |
| adapter of an outside system | `infrastructure/` | I/O behind a port |

The kit has no generic "application service" class: one handler per command or query plays that
role.

## Repositories

A repository makes aggregates look like an in-memory collection: find one, save one. The
domain declares what it needs; infrastructure decides how it is stored.

```ts
// contexts/appointments/domain/repositories/appointment.repository.ts
import { Repository } from '@ddd-ts-kit/kernel';
import type { Appointment } from '@/contexts/appointments/domain/aggregates/appointment.aggregate';

export abstract class AppointmentRepository extends Repository<Appointment> {
  abstract findUpcomingOf(clientId: string, after: Date): Promise<readonly Appointment[]>;
}
```

- **A port of the domain.** It is an abstract class with abstract members only, extending the
  kernel `Repository<Aggregate>` (`findById`, `save`). The adapter in
  `infrastructure/persistence/` implements it and never extends it
  ([Ports and composition](ports-and-composition.md)).
- **One per aggregate root.** Whole-aggregate load and save. No repository for an inner entity.
- **Rows stay inside.** A mapper translates stored rows to the aggregate through `rehydrate`
  and back. No ORM entity, row type or query builder crosses the interface.
- **No transaction in the signature.** The unit of work is opened by the application (a bus
  middleware does it for every command); the adapter joins the current transaction and never
  commits.
- **Only the lookups a use case needs**, named in the language. Queries for screens go through
  a read port instead, and may skip aggregates entirely ([CQRS](cqrs.md)).
- **A fake and a contract.** Each repository has an in-memory fake in `test/fakes/`, and the
  fake and the real adapter pass the same `repositoryContract` suite, optimistic concurrency
  included.

```bash
npx ddd-ts-kit generate repository appointments Appointment
```

writes the port, the adapter for the project's ORM with its mapper and table, the fake, the
contract spec run on both, and the registration.

A handler then reads as the use case:

```ts
async execute(command: CancelAppointment): Promise<void> {
  const appointment = await this.appointments.findById(command.appointmentId);
  if (appointment === undefined) {
    throw new AppointmentNotFound(command.appointmentId);
  }

  appointment.cancel(command.reason, this.clock.now());

  await this.appointments.save(appointment);
}
```

Load, one intention, save. An `if` on business state in a handler belongs in the domain.

## Factories

A factory encapsulates the creation of an aggregate so that it is born valid and the caller
does not need to know how. Evans presents factories as methods or separate objects. This kit
settles on the simplest form:

| Factory | Role |
|---|---|
| a static birth method on the aggregate (`create`, or a word of the language such as `Appointment.book`) | checks birth invariants, sets the initial state, records the birth event |
| `rehydrate` | restores an aggregate from stored state, checks nothing, records nothing; used by mappers only |
| `create` on a value object | validates and returns the value, or the reason it is invalid |
| a method on another aggregate | when one aggregate gives birth to another and supplies part of its state |

The constructor is private so that these are the only ways in. A separate factory class is
rarely needed; when construction needs data from several sources, the handler gathers it and
passes it, or a domain service assembles it. Test data builders are the factories of tests:
they go through the same public API, so a test cannot start from an invalid state.

## Limits and when not to use it

- **Domain events are not a message queue.** They are dispatched in process, by default
  inside the transaction of the command: a reaction that fails makes the command fail. A reaction that
  must run apart from the command, or reach another context, goes through an integration
  event and the [transactional outbox](transactional-outbox.md).
- **Domain events are not event sourcing.** The aggregate's state is stored as state. Events
  are notifications of changes, not the source of truth.
- **Do not create events nobody reacts to "just in case".** Each one is a name to maintain. The
  exception is the fact that a test asserts on.
- **A domain service is easy to overuse.** If most rules live in services and aggregates only
  hold data, the model is anemic ([Anemic model](anemic-model.md)). Try the aggregate first.
- **A repository is not a query API.** Adding a finder per screen turns it into a data access
  object and drags read concerns into the domain. Use read ports.
- **The kit checks shapes, not intent.** That a repository port is an abstract class, that a
  handler has one public method, that a spec file exists: yes. That the service is truly a
  domain decision and not orchestration: no, a reviewer decides.

## Sources

- Eric Evans, *Domain-Driven Design*, Addison-Wesley, 2003, chapter 5 (services) and chapter 6
  (factories, repositories).
- Vaughn Vernon, *Implementing Domain-Driven Design*, Addison-Wesley, 2013, chapter 7
  "Services", chapter 8 "Domain Events", chapter 11 "Factories", chapter 12 "Repositories".
- Martin Fowler, *Patterns of Enterprise Application Architecture*, Addison-Wesley, 2002,
  "Repository", "Unit of Work", "Data Mapper".
- Martin Fowler, "Domain Event", martinfowler.com/eaaDev/DomainEvent.html.
- Vlad Khononov, *Learning Domain-Driven Design*, O'Reilly, 2021, chapter 6.

## See also

- [Aggregates](aggregates.md)
- [Entities and value objects](entities-and-value-objects.md)
- [Domain and integration events](domain-and-integration-events.md)
- [Ports and composition](ports-and-composition.md)
- [CQRS](cqrs.md)
- [Anemic model](anemic-model.md)
- [Testing strategy](testing-strategy.md)
- [Persistence tools](../tools/persistence.md)
- [Architecture reference](../ARCHITECTURE.md)
- [Concepts index](README.md)

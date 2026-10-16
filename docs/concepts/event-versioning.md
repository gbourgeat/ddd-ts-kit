**English** · [Français](event-versioning.fr.md)

# Versioning an integration event

**Summary.** An integration event is a contract: once another context consumes it, the producer
can no longer change it freely. The kit's policy is short. Inside a version, only additive and
optional changes are allowed. Anything else (a removal, a rename, a change of type or of
meaning) is a new version, declared next to the old one and published alongside it until every
consumer has moved; the old one is then marked deprecated and retired. Consumers ignore fields
they do not know. This page explains why, what counts as breaking, and how the generated catalog
and AsyncAPI document make the contract reviewable.

## Why events are harder to change than an API

A synchronous API has a request in flight for milliseconds. An event lives much longer:

- it waits in an outbox, a queue or a log, sometimes for days in a dead-letter destination;
- a log-based provider retains history, and a consumer created later reads old events;
- producer and consumers are deployed at different times, in the monolith too once consumers
  hold events that were published by the previous release.

So at any moment, events written by an old producer are read by a new consumer and the reverse.
Both directions must work: old data with new code (backward compatibility) and new data with old
code (forward compatibility) (Kleppmann, chapter 4).

![Both directions of compatibility: events written by the previous release wait in the outbox, a queue, a log or a dead-letter destination and are read by consumers of the new release (backward compatibility); events written by the new release are read by consumers still running the previous release (forward compatibility)](../assets/diagrams/event-versioning-compatibility.svg)

## The rule

| Change to `appointments.appointment.booked` | Inside the version? |
|---|---|
| add an optional field (`locationId`) | yes |
| add a description, an example | yes |
| add a required field | no: old producers' events, still in flight, lack it |
| remove or rename a field (`startsAt` to `start`) | no |
| change a type (`startsAt` from string to number) | no |
| change a unit or a meaning (`startsAt` from UTC to local time) | no, and the most dangerous: the schema does not change, nothing fails, data is wrong |
| narrow accepted values (an enum loses a member) | no |
| widen an enum the consumers switch over exhaustively | treat as breaking unless consumers are known to tolerate unknown values |
| rename the event type | it is a different event |

The normative statement is in [ARCHITECTURE.md](../ARCHITECTURE.md) section 4 ("Integration
events"): versioned envelope, additive changes only inside a version.

**The consumer's half of the contract**: ignore unknown fields, and do not fail on a field that
is absent when the schema says it is optional (the tolerant reader). A consumer that validates
strictly and rejects unknown properties turns every additive change of the producer into a
breaking one.

In the kit the consumer parses with the declaration the producer publishes, so the tolerance is
decided where the payload is declared. Instead of a schema that refuses what it does not know:

```ts
payload: zodSchema(
  z.strictObject({ appointmentId: z.string(), startsAt: z.iso.datetime() }),
), // a consumer still on this release refuses every event that gained a field
```

write one that keeps what it knows and drops the rest, and make an addition optional:

<!-- checked sample -->
```ts
import { defineIntegrationEvent } from '@ddd-ts-kit/events';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { z } from 'zod';

export const appointmentBookedV1 = defineIntegrationEvent({
  type: 'appointments.appointment.booked',
  version: 1,
  description: 'An appointment was booked.',
  payload: zodSchema(
    z.object({
      appointmentId: z.string(),
      startsAt: z.iso.datetime().describe('Start of the appointment, ISO 8601, UTC.'),
      endsAt: z.iso.datetime().describe('End of the appointment, ISO 8601, UTC.'),
      locationId: z.string().optional().describe('Added later: absent from older events.'),
    }),
  ),
});

// an event from a newer producer, with a field this release does not know yet
const parsed = appointmentBookedV1.parse({
  id: 'e7',
  type: 'appointments.appointment.booked',
  version: 1,
  occurredAt: '2026-10-13T08:00:00.000Z',
  payload: {
    appointmentId: 'a-17',
    startsAt: '2026-11-02T09:00:00Z',
    endsAt: '2026-11-02T09:30:00Z',
    roomName: 'Room 2',
  },
});

export const accepted = parsed.ok; // true: roomName is dropped, locationId may be absent
```

## A breaking change, step by step

The product decides that an appointment can span several consecutive slots. `startsAt` and
`endsAt` become a list.

![The migration from v1 to v2 over four releases: in release 1 appointments declares v2 and publishes both; notifications moves to v2 in release 2 and analytics in release 3; in release 4 no consumer of v1 is left, v1 is marked deprecated and stops being published; its declaration is removed once no v1 event is retained anywhere](../assets/diagrams/event-versioning-migration.svg)

1. **Declare version 2** in the producer's `published-language/`, as a second declaration with
   the same `type` and `version: 2`. One declaration per event and version.
2. **Publish both.** The publisher builds the two events from the same domain event. During the
   migration every booking produces a v1 and a v2.
3. **Move consumers one at a time.** A consumer subscribes with the declaration of the version
   it understands; an event of another version of the same type is skipped by that
   subscription. A consumer moving to v2 subscribes to v2 and stops handling v1. It must not
   handle both for the same fact, or it processes each booking twice: the two events have
   different ids, so the processed-event store does not catch it.
4. **Deprecate v1** (`deprecated: true` on its declaration) so the catalog shows it, and
   announce the retirement date where the team tracks such things.
5. **Stop publishing v1** once the catalog shows no consumer, then remove its declaration once
   no v1 event remains in any queue, log retention or dead-letter destination that could be
   replayed.

What v1 can still express during step 2 is a real question when the new model is richer: a
multi-slot appointment has no faithful v1 form. Options: publish v1 with the first slot and
accept the loss for old consumers, or do not publish v1 for the cases it cannot express, and say
which in the event's description.

Steps 1 to 3 in code: two declarations of the same type, one publisher that builds both from
the same domain event, and a consumer that subscribes to the version it understands:

<!-- checked sample -->
```ts
import { defineIntegrationEvent, type PayloadOf } from '@ddd-ts-kit/events';
import { NamedDomainEvent, 
  Command,
  CommandBus,
  type DomainEvent,
  type IdGenerator,
  type IntegrationEvent,
  type IntegrationEventPublisher,
} from '@ddd-ts-kit/kernel';
import { DomainEventHandler, IntegrationEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { z } from 'zod';

const instant = z.iso.datetime().describe('ISO 8601, UTC.');

// appointments/published-language/appointment-booked.v1.integration-event.ts: unchanged except its
// description, which says what v1 cannot express
export const appointmentBookedV1 = defineIntegrationEvent({
  type: 'appointments.appointment.booked',
  version: 1,
  description: 'An appointment was booked. For an appointment over several slots: its first slot only.',
  payload: zodSchema(
    z.object({
      appointmentId: z.string(),
      startsAt: z.iso.datetime().describe('Start of the appointment, ISO 8601, UTC.'),
      endsAt: z.iso.datetime().describe('End of the appointment, ISO 8601, UTC.'),
      locationId: z.string().optional().describe('Added later: absent from older events.'),
    }),
  ),
});

// appointments/published-language/appointment-booked.v2.integration-event.ts: the new contract
export const appointmentBookedV2 = defineIntegrationEvent({
  type: 'appointments.appointment.booked',
  version: 2,
  description: 'An appointment was booked, over one or several consecutive slots.',
  payload: zodSchema(
    z.object({
      appointmentId: z.string(),
      slots: z.array(z.object({ startsAt: instant, endsAt: instant })).min(1),
    }),
  ),
});

// appointments/domain/events/appointment-booked.event.ts
export class AppointmentBooked extends NamedDomainEvent('appointments.appointment.booked') {
  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly slots: readonly { readonly startsAt: Date; readonly endsAt: Date }[],
  ) {
    super();
  }
}

// appointments/application/integration/publishers/appointment-booked.publisher.ts
@DomainEventHandler(AppointmentBooked)
export class AppointmentBookedPublisher implements DomainEventHandler<AppointmentBooked> {
  constructor(
    private readonly publisher: IntegrationEventPublisher,
    private readonly ids: IdGenerator,
  ) {}

  async handle(event: AppointmentBooked): Promise<void> {
    const slots = event.slots.map(({ startsAt, endsAt }) => ({
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    }));
    const [first] = slots;

    if (first === undefined) {
      return;
    }

    // two events with two ids: a consumer must subscribe to one version only
    await this.publisher.publish([
      appointmentBookedV1.create(
        { appointmentId: event.aggregateId, ...first },
        { id: this.ids.next(), occurredAt: event.occurredAt },
      ),
      appointmentBookedV2.create(
        { appointmentId: event.aggregateId, slots },
        { id: this.ids.next(), occurredAt: event.occurredAt },
      ),
    ]);
  }
}

// notifications/application/integration/handlers/remind-on-appointment-booked.integration-handler.ts
export class ScheduleReminder extends Command {
  constructor(
    readonly appointmentId: string,
    readonly startsAt: string,
  ) {
    super();
  }
}

@IntegrationEventHandler(appointmentBookedV2, { consumer: 'notifications.remind-on-appointment-booked' })
export class RemindOnAppointmentBooked implements IntegrationEventHandler<PayloadOf<typeof appointmentBookedV2>> {
  constructor(private readonly commands: CommandBus) {}

  // a v1 event of the same type is skipped by this subscription
  async handle(event: IntegrationEvent<PayloadOf<typeof appointmentBookedV2>>): Promise<void> {
    for (const slot of event.payload.slots) {
      await this.commands.execute(new ScheduleReminder(event.payload.appointmentId, slot.startsAt));
    }
  }
}
```

Step 4 is one line on the old declaration, `deprecated: true`, which the catalog and the
AsyncAPI document show; step 5 removes the v1 half of the publisher, then the declaration.

## Making the contract visible

Each declaration feeds two generated documents
(`events/defined-in-published-language`):

- **the event catalog** (Markdown): per producer, each event, its versions, its payload fields
  flattened, its consumers;
- **the AsyncAPI document**: one channel per event type, one message per version, the envelope
  as payload.

Both are committed, regenerated by the project's events script, and checked for drift in CI. A
change of an event therefore shows up as a diff of generated files in the pull request, which is
where a reviewer sees that a "small refactoring" altered a contract. Field descriptions written
in the schema flow into both.

The versioning policy itself (how long an old version stays published, how retirement is
announced) is written by the team in `docs/integration/README.md`; the `document` skill lists it
among the sections of that file.

## What the kit checks and what it does not

| Checked | By |
|---|---|
| an event is declared once per version, in a published language, with a payload schema | `events/defined-in-published-language` |
| the name format | `events/name-format` |
| what is published and consumed matches the schema | the declaration validates on both sides; publishing an invalid event throws, an invalid consumed payload goes to retry and dead letter |
| generated documents are current | the documentation drift gate of the pipeline |

Not checked, as far as the READMEs state: **compatibility between two revisions of the same
version**. Nothing compares the schema of v1 in this commit with v1 in the previous commit and
refuses a removed field. The safeguard is the diff of the generated catalog in review. A schema
registry with compatibility modes, as exists in the Kafka ecosystem, is not part of the kit.

## Practices that reduce the need for versions

- Publish less. A field nobody asked for is a field that cannot be removed.
- Prefer identifiers and facts to structures copied from the aggregate.
- Put units and time zones in names or descriptions (`startsAt`, ISO 8601, UTC).
- Model closed vocabularies deliberately, and tell consumers whether new values may appear.
- Add optional fields rather than repurposing existing ones.

## Limits and when not to use it

- **Publishing two versions costs**: twice the events, a publisher with two mappings, and a
  migration that depends on other teams' schedules. For a breaking change with a single
  consumer owned by the same team, in one deployable, releasing producer and consumer together
  is tempting; it only works if no v1 event is in flight or retained, which the outbox and dead
  letters make hard to guarantee. The two-version path is the safe default.
- **Additive-only accumulates.** After years, a version carries deprecated optional fields. A
  new version is also the occasion to clean up.
- **Semantic changes are invisible to schemas.** No tool here detects that a field kept its name
  and changed its meaning. Treat a change of meaning as a new field or a new version.
- **Upcasting is for stored events, not for integration events.** The events an event-sourced
  aggregate keeps in its stream are upcast when read (`upcasters` of `defineStoredEvent`, held by
  `event-sourcing/upcaster-required` against `stored-events.lock.json`): see
  [Event sourcing, per aggregate](event-sourcing.md). Integration events are not: a consumer that
  must read retained history handles the versions that history contains.
- **Versioning the event does not version the process.** When the sequence of events changes
  (a new step between booking and confirmation), consumers that assumed the old sequence break
  without any schema change. That is a contract change to discuss with the downstream teams (see
  [Team workflow](../guides/team-workflow.md)).

## Sources

- Martin Kleppmann, Designing Data-Intensive Applications, O'Reilly, 2017, chapter 4 ("Encoding
  and Evolution").
- Greg Young, Versioning in an Event Sourced System, Leanpub, 2017 (written for event sourcing;
  the compatibility reasoning applies).
- Martin Fowler, "TolerantReader", 2011, https://martinfowler.com/bliki/TolerantReader.html
- Gregor Hohpe and Bobby Woolf, Enterprise Integration Patterns, Addison-Wesley, 2003 (Format
  Indicator, Message Translator).
- Sam Newman, Building Microservices, 2nd edition, O'Reilly, 2021, chapter 5 (handling change
  between services: expand and contract, coexisting versions).
- AsyncAPI specification 3.0.0, https://www.asyncapi.com/docs/reference/specification/v3.0.0
- README of [`@ddd-ts-kit/events`](../../packages/events/README.md).

## See also

- [Domain and integration events](domain-and-integration-events.md)
- [Delivery and idempotency](delivery-and-idempotency.md)
- [Transactional outbox](transactional-outbox.md)
- [Context map](context-map.md)
- [Team workflow](../guides/team-workflow.md)
- [Message brokers](../tools/message-brokers.md)
- [Architecture reference](../ARCHITECTURE.md)

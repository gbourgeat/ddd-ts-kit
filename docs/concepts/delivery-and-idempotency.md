**English** · [Français](delivery-and-idempotency.fr.md)

# Delivery guarantees and idempotent consumers

**Summary.** Integration events in this kit are delivered at least once: every event reaches
every consumer, possibly more than once, in no guaranteed order. Exactly-once delivery is not on
offer, here or elsewhere, because a sender cannot tell a lost message from a lost
acknowledgement. What can be built is exactly-once effect: a consumer that records, in the same
transaction as its own state change, that it has processed an event, and skips it the second
time. This page explains the guarantee, the processed-event store, why it lives in the database,
what ordering costs and where failed events go.

## Three delivery guarantees

| Guarantee | Meaning | Price |
|---|---|---|
| at most once | send and forget; a failure loses the message | none; events are lost |
| at least once | resend until acknowledged; a failure duplicates the message | consumers must tolerate duplicates |
| exactly once | each message delivered a single time | not achievable between independent systems |

Why the third does not exist: the relay publishes `appointments.appointment.booked` and the
connection drops before the acknowledgement arrives. Did the broker take it? The relay cannot
know. If it resends, the event may be delivered twice; if it does not, the event may be lost.

![Why exactly-once delivery is out of reach: the relay publishes event e1, the broker stores it, the acknowledgement is lost on the way back; the relay cannot tell this case from a lost message, so it must choose between resending, which may deliver e1 twice (at least once), and not resending, which may lose it (at most once)](../assets/diagrams/delivery-and-idempotency-lost-ack.svg)

The same holds between the broker and the consumer: the handler commits, the acknowledgement is
lost, the broker redelivers. Products that advertise exactly-once semantics achieve it inside
their own boundary (for example a Kafka transaction covering Kafka topics and offsets), not
across a broker and an application database (Kleppmann, chapter 11).

Duplicates are therefore normal operation, not an incident. In the kit they come from: a relay
retry after a lost acknowledgement, a relay restarted between publishing and marking, a broker
redelivery after a consumer crash, an operator replaying dead letters.

## Idempotent consumers

A consumer is idempotent when handling the same event twice leaves the same state as handling it
once. Some operations are naturally so ("mark the appointment as cancelled"). Most are not:
`notifications` handling `appointments.appointment.booked` twice would schedule two reminders.

The general mechanism is a **processed-event store**: a table keyed by consumer name and event
id.

![The processed-event store in three cases: on a first delivery the mark is taken, the reminder is inserted and both commit together before the acknowledgement; on a redelivery the mark already exists, the handler is skipped and the event is acknowledged; when the handler fails, the transaction rolls back with the mark, nothing is acknowledged and the redelivery is handled](../assets/diagrams/delivery-and-idempotency-processed-events.svg)

The decisive detail is that **the mark and the state change commit together**:

- if the handler fails, the mark is rolled back with the rest and the redelivery is processed;
- if the handler succeeds, the mark is durable and the redelivery is skipped;
- the acknowledgement to the broker comes after the commit, never before.

The kit does this for a declared integration event handler without code in the handler: the
mark and the work run in one unit of work, and the command the handler sends joins that
transaction. The rule is `events/consumer-idempotent`: every consumer has a stable, unique
consumer name and deduplicates through a processed-event store.

A declared handler only names its consumer; the platform subscribes it with the
processed-event store and the unit of work bound in the container:

<!-- checked sample -->
```ts
import { defineIntegrationEvent, type PayloadOf } from '@ddd-ts-kit/events';
import { Command, CommandBus, type IntegrationEvent } from '@ddd-ts-kit/kernel';
import { IntegrationEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { z } from 'zod';

// appointments/published-language/appointment-booked.v1.integration-event.ts
export const appointmentBooked = defineIntegrationEvent({
  type: 'appointments.appointment.booked',
  version: 1,
  payload: zodSchema(z.object({ appointmentId: z.string(), startsAt: z.iso.datetime() })),
});

// notifications/application/commands/schedule-reminder/schedule-reminder.command.ts
export class ScheduleReminder extends Command {
  constructor(
    readonly appointmentId: string,
    readonly startsAt: string,
  ) {
    super();
  }
}

// notifications/application/integration/handlers/remind-on-appointment-booked.integration-handler.ts
@IntegrationEventHandler(appointmentBooked, { consumer: 'notifications.remind-on-appointment-booked' })
export class RemindOnAppointmentBooked implements IntegrationEventHandler<PayloadOf<typeof appointmentBooked>> {
  constructor(private readonly commands: CommandBus) {}

  // no deduplication here: the mark, this command and its writes commit in one unit of work
  async handle(event: IntegrationEvent<PayloadOf<typeof appointmentBooked>>): Promise<void> {
    await this.commands.execute(new ScheduleReminder(event.payload.appointmentId, event.payload.startsAt));
  }
}
```

Without the container, `consume` of `@ddd-ts-kit/events` gives a plain function the same
semantics. Here the broker is played by hand and delivers the same event twice; the reminder is
scheduled once:

<!-- checked sample -->
```ts
import { consume, defineIntegrationEvent } from '@ddd-ts-kit/events';
import { InMemoryProcessedEventStore, InMemoryUnitOfWork } from '@ddd-ts-kit/kernel';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { z } from 'zod';

const appointmentBooked = defineIntegrationEvent({
  type: 'appointments.appointment.booked',
  version: 1,
  payload: zodSchema(z.object({ appointmentId: z.string(), startsAt: z.iso.datetime() })),
});

const reminders: string[] = [];

const remindOnBooked = consume(
  appointmentBooked,
  {
    consumer: 'notifications.remind-on-appointment-booked', // an identity: a literal, never a class name
    processed: new InMemoryProcessedEventStore(), // in production, the store of the ORM package
    unitOfWork: new InMemoryUnitOfWork(), // in production, the transaction of the database
  },
  async (event) => {
    reminders.push(event.payload.appointmentId);
  },
);

const e1 = appointmentBooked.create(
  { appointmentId: 'a-17', startsAt: '2026-11-02T09:00:00Z' },
  { id: 'e1', occurredAt: new Date('2026-10-13T08:00:00Z') },
);

export async function deliverTwice(): Promise<number> {
  await remindOnBooked.handler(e1); // first delivery: handled
  await remindOnBooked.handler(e1); // redelivery after a lost acknowledgement: skipped

  return reminders.length; // 1
}
```

### The consumer name is an identity

The name (`notifications.remind-on-appointment-booked`) keys the processed-event table and,
behind a broker, names the queue, the consumer group or the durable subscription. It is written
as a literal and survives the renaming of a class. Renaming it creates a new consumer that has
processed nothing: on a provider that retains history, it replays that history.

### Why the store is not in Redis

A mark in one system and a state change in another are a dual write again. A crash between the
two either loses the event (mark kept, change rolled back) or processes it twice (change
committed, mark missing). The Redis package says it explicitly and ships no processed-event
store; the stores are those of the ORM packages, in the unit of work of the consumer.

One case to mind, from the events README: a consumer registered with a processed-event store but
without a unit of work takes its mark before the handler runs. With a transactional store, a
failing handler then leaves the mark committed and the redelivery is skipped: the event is lost
for that consumer. Use the unit of work, or a store that can release its mark.

### When the handler calls the outside

The transaction covers the database, not an email provider. If `notifications` sends an SMS
inside the handler and the commit then fails, the redelivery sends it again. Options, in order
of preference: make the outside call idempotent with a key derived from the event id, when the
provider supports one; record the intent in the transaction and let a separate, repeatable step
send it; accept the rare duplicate when it is harmless, and say so.

Instead of a handler that hides the failure of the provider:

```ts
async handle(event: IntegrationEvent<AppointmentBookedV1>): Promise<void> {
  try {
    await this.sms.send({ clientId: event.payload.clientId, text: 'Your appointment is booked.' });
  } catch (error) {
    this.logger.warn('sms failed', { error }); // acknowledged: the event is lost for this consumer
  }
}
```

write one that lets the error reach the provider, which retries and then dead-letters, and that
gives the outside call a key the provider deduplicates on:

<!-- checked sample -->
```ts
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';

// application/ports/sms-sender.port.ts: what notifications needs from the SMS provider;
// its adapter looks the phone number up, so the event carries no personal data
export abstract class SmsSender {
  abstract send(message: { readonly clientId: string; readonly text: string; readonly idempotencyKey: string }): Promise<void>;
}

interface AppointmentBookedV1 {
  readonly appointmentId: string;
  readonly clientId: string;
}

export class ConfirmByText {
  constructor(private readonly sms: SmsSender) {}

  async handle(event: IntegrationEvent<AppointmentBookedV1>): Promise<void> {
    // a redelivery sends the same key: a provider that honours it sends the text once
    await this.sms.send({
      clientId: event.payload.clientId,
      text: 'Your appointment is booked.',
      idempotencyKey: `notifications.confirm-by-text:${event.id}`,
    });
  }
}
```

## Ordering

By default **ordering is not guaranteed, not even for the events of one aggregate**: a failed
record is retried while its successors go out, several relays or consumer instances interleave,
and a redelivery comes back after the messages that followed.

So `appointments.appointment.cancelled` can reach `availability` before the `rescheduled` that
preceded it. Three ways to cope, cheapest first:

1. **Make order irrelevant.** Carry a version or a sequence of the aggregate in the payload; the
   consumer keeps the highest it has applied and ignores anything older. This works on every
   provider and is what the provider READMEs recommend.

   ![Making order irrelevant: the producer emits versions 1, 2 and 3 of one appointment; they arrive as 1, 3, 2; the consumer applies 1, then 3, and ignores 2 because the row already holds a later version, so it ends in the state of version 3 whatever the order of arrival](../assets/diagrams/delivery-and-idempotency-ordering.svg)

   The kernel compares stamps for you: `stampOf(event, version)` and `isNewer`, the rule the
   read model stores apply in `upsertIfNewer`:

   <!-- checked sample -->
   ```ts
   import { isNewer, stampOf, type EventStamp, type IntegrationEvent } from '@ddd-ts-kit/kernel';

   interface SlotChanged {
     readonly slotId: string;
     readonly version: number; // per slot, set by the producer
     readonly state: 'open' | 'taken';
   }

   interface SlotRow {
     readonly state: 'open' | 'taken';
     readonly stamp: EventStamp;
   }

   /** Set the slot to what the event says, if the event is newer than what the row holds. */
   export function applySlotChanged(row: SlotRow | undefined, event: IntegrationEvent<SlotChanged>): SlotRow {
     const stamp = stampOf(event, event.payload.version);

     if (row !== undefined && !isNewer(stamp, row.stamp)) {
       return row; // older, or the same event again: nothing changes
     }

     return { state: event.payload.state, stamp };
   }
   ```
2. **Make handlers commutative** where the business allows: "set the slot state to what this
   event says, if newer" instead of "toggle".
3. **Ask for order per key.** The relay can hold back a record while an earlier record of the
   same key is unpublished, and a log such as Kafka keeps the order of a partition.

Per-key ordering has stated caveats (events README): it needs a single relay; one event that
cannot be published blocks every later event of its key until it goes out or is dead; a restart
forgets which record blocks which key, so strict order across restarts is not provided; the
broker and the consumer must keep the order too (one partition or one queue with a single active
consumer per key, and no out-of-order retry). Among the kit's providers, the Kafka README
describes itself as the one to choose when the order of an aggregate's events matters; RabbitMQ
and NATS state "no ordering".

Order across aggregates or across contexts is never available. A flow that needs it is a process
with explicit steps: see [Sagas and process managers](sagas-and-process-managers.md).

## When a handler keeps failing

A handler throws; the provider retries a bounded number of times with a delay; then the event is
moved aside as a **dead letter** (a dead queue, a dead-letter topic or stream, depending on the
provider). A message that cannot even be parsed as an envelope is poison and goes there
directly. Rules that follow:

- let the handler throw: swallowing the error acknowledges the event and loses it;
- a dead letter is an alert, not a log line: the destination must be empty in normal operation;
- replay after fixing the cause; replaying a poison message only kills it again;
- only codes travel with a dead letter, never error messages, which may quote payload data.

Two more facts shared by the providers of the kit:

- **A redelivery runs every handler of the consumer for that type again**, those that succeeded
  included. Each handler deduplicates on its own consumer name.
- **The retry delay is constant** in the four broker providers: no exponential backoff on the
  consuming side.

## Limits and when not to use it

- **The processed-event table grows.** The kit's READMEs do not describe a purge for it; plan
  one by age, longer than the longest possible redelivery and replay horizon. (Not provided by
  the kit as far as its READMEs say.)
- **Deduplication is per consumer and per event id.** Two different events describing the same
  fact (a producer bug, a re-emission with a new id) are not caught: that needs a business key
  and a unique constraint.
- **Idempotency does not give order**, and order does not give idempotency. They are separate
  designs.
- **A unit of work per event holds a transaction for the duration of the handler.** Slow
  handlers hold connections; with Prisma, interactive transactions are time-bounded by default.
- **It needs a transactional store on the consumer side.** A consumer without a database uses
  the in-memory store that can release its mark, which protects one process only.
- When not to bother: a consumer whose effect is naturally idempotent and cheap (overwrite a
  cache entry). The rule still asks for a consumer name and a store; lowering it is a recorded
  deviation.

## Sources

- Martin Kleppmann, Designing Data-Intensive Applications, O'Reilly, 2017, chapter 11 (message
  delivery, idempotence, exactly-once) and chapter 8 (unreliable networks).
- Chris Richardson, "Idempotent consumer",
  https://microservices.io/patterns/communication-style/idempotent-consumer.html
- Gregor Hohpe and Bobby Woolf, Enterprise Integration Patterns, Addison-Wesley, 2003
  (Idempotent Receiver, Dead Letter Channel, Resequencer).
- Pat Helland, "Idempotence Is Not a Medical Condition", ACM Queue, 2012.
- Apache Kafka documentation, "Message Delivery Semantics",
  https://kafka.apache.org/documentation/#semantics
- READMEs of [`@ddd-ts-kit/events`](../../packages/events/README.md),
  [`@ddd-ts-kit/redis`](../../packages/redis/README.md) and the broker packages.

## See also

- [Transactional outbox](transactional-outbox.md)
- [Domain and integration events](domain-and-integration-events.md)
- [Eventual consistency](eventual-consistency.md)
- [Event versioning](event-versioning.md)
- [Scheduled jobs](scheduled-jobs.md)
- [Message brokers](../tools/message-brokers.md)
- [Cache and coordination](../tools/cache-and-coordination.md)
- [Architecture reference](../ARCHITECTURE.md)

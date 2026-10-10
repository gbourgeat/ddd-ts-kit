# The same provider on other brokers

What an integration event provider owes, whatever the broker, and where each one stands:
Kafka, NATS JetStream and Redis Streams are packages of the kit, held to what
`RabbitMqEventBus` is held to; SQS/SNS is an outline, without code or dependencies.

| Broker | Status | Where |
|---|---|---|
| RabbitMQ | package | [`@ddd-ts-kit/rabbitmq`](../README.md) |
| Kafka | package | [`@ddd-ts-kit/kafka`](../../kafka/README.md) |
| NATS JetStream | package | [`@ddd-ts-kit/nats`](../../nats/README.md) |
| Redis Streams (Redis, Dragonfly, Valkey) | package | [`@ddd-ts-kit/redis`](../../redis/README.md), entry `./event-bus` |
| SQS and SNS | outline, nothing built | below |

## What every provider owes

Two ports of `@ddd-ts-kit/kernel`, nothing else:

- `IntegrationEventPublisher.publish(events)`: resolves only when the broker has taken
  responsibility for **every** event (its durable acknowledgement), rejects otherwise, and
  buffers nothing for later. The outbox relay marks a record published on that promise.
- `IntegrationEventSubscriber.subscribe(type, handler)`: delivers every event of the type to
  the handler at least once, acknowledges after the handler resolved, never before, and
  returns a `Subscription`. The consumer name comes from the instance (`forConsumer(name)` or
  an option), because the port has no room for it.

And one suite: `eventBusContract(runner, { name, createBus })` of
`@ddd-ts-kit/testing/contracts`, where `createBus` returns `{ bus, settle, close }`. `settle`
resolves once everything published was delivered or given up on; `close` releases the
connection and removes what the test created. The suite checks: delivery by type, to every
subscriber, of every event of a batch; an event nobody subscribed to is accepted;
unsubscribing stops the delivery; the envelope comes back exactly as published, with
`traceparent` and `correlationId` and without inventing them; a failing handler does not
starve the others and the event comes back.

On top of the contract, the behaviours to write a test for, with a real broker and a skip
when its URL is absent: publication rejected when the acknowledgement does not come;
redelivery after a failure; dead-lettering after the bounded attempts; poison message; two
consumers each get everything while two instances of one consumer share; reconnection;
graceful close.

Common decisions, the same everywhere:

- the body is the envelope as JSON; type, version, event id, `traceparent` and correlation id
  are repeated in headers or attributes for routing and tracing;
- errors are reported by code, never by message;
- retries are bounded and delayed, then the message is parked where an operator can see it and
  replay it;
- consumers deduplicate, through a declared `@IntegrationEventHandler` (or `consume` by hand)
  and a processed-event store: every one of these brokers redelivers.

## Kafka

Built: [`@ddd-ts-kit/kafka`](../../kafka/README.md), which is the reference for its options,
guarantees and limits. How the concepts of the RabbitMQ provider map, for
`forConsumer('billing')` subscribed to `ordering.order.placed`:

| Concept here | Kafka, as the package does it |
|---|---|
| exchange and routing key | one topic per event type, named after the type (`topicOf` gives one per producing context instead); the **record key** is `keyOf(event)`, the ordering key |
| publisher confirm | idempotent producer with `acks=all`; `publish` resolves on the acknowledgement of every record |
| queue per consumer | the consumer group `billing`, starting at the earliest record |
| manual ack | offset committed after the handlers resolved, never automatically |
| retry queue | none: a failed record is retried **in place**, its partition paused for `retry.delayMs`, so the order of a key holds through a failure that heals |
| dead queue | the dead-letter topic `billing.ordering.order.placed.dead` (`<consumer>.<topic>.dead`) |
| `x-attempt` | counted by the consumer, written as a header on the dead-letter record |
| deduplication id | the header `x-event-id`; the idempotent producer absorbs the retries of the client only, so the processed-event store stays necessary |

## NATS JetStream

Built: [`@ddd-ts-kit/nats`](../../nats/README.md), the reference for its options, guarantees
and limits. Core NATS has no persistence: only JetStream fits the ports. For
`forConsumer('billing')` subscribed to `ordering.order.placed`:

| Concept here | JetStream, as the package does it |
|---|---|
| exchange | the stream `integration-events` capturing the subjects `events.>`, limits retention, file storage |
| routing key | the subject `events.ordering.order.placed` (`<subjectPrefix>.<event type>`) |
| publisher confirm | the publish acknowledgement of the stream, awaited for every message |
| queue per consumer | the durable pull consumer `billing_ordering_order_placed`: consumer name and type, every character outside `[A-Za-z0-9_-]` replaced by `_` |
| manual ack | explicit acknowledgement after the handlers resolved |
| retry queue | none: `nak` with `retry.delayMs`, the server redelivers |
| dead queue | the subject `dead.events.billing.ordering.order.placed` (`dead.<subjectPrefix>.<consumer>.<event type>`) kept by the stream `integration-events-dead`; the bus publishes the copy, waits for its acknowledgement, then terminates the original |
| `x-attempt` | the delivery count of the server |
| deduplication id | the header `Nats-Msg-Id`, set to the event id: the stream drops a second publication inside its duplicate window (2 minutes), which absorbs a retry of the relay, not a replay an hour later |

## SQS and SNS

| Concept here | SQS / SNS |
|---|---|
| exchange | one SNS topic for all events, or one per producing context |
| routing key | the message attribute `type`, matched by the filter policy of each subscription |
| publisher confirm | the response of `Publish` / `PublishBatch`, checked entry by entry |
| queue per consumer | an SQS queue `<consumer>-<type>` subscribed to the topic with a filter on `type` |
| manual ack | `DeleteMessage` after the handler resolved |
| retry queue | none: the message reappears after its visibility timeout |
| dead queue | a second SQS queue, target of the redrive policy (`maxReceiveCount`) |
| `x-attempt` | the `ApproximateReceiveCount` attribute |

How it maps:

- `publish`: batches of ten entries; a batch call succeeds while some entries fail, so read
  the failed list and reject if it is not empty. Entry id = event id.
- `subscribe`: long-poll the queue, dispatch, delete on success. On failure, set the
  visibility timeout of that message to the retry delay (this is the delayed retry, and it
  can grow with the receive count) and leave it.
- Subscribe the queue with raw message delivery, or unwrap the SNS envelope: otherwise the
  body is not the event and the attributes are inside it.
- Poison: delete it after sending it to the dead-letter queue explicitly, or let the redrive
  policy carry it after `maxReceiveCount` receptions; the first keeps the reason.
- `settle`: no visible, no invisible and no delayed message on the queue, read several times
  in a row: the counters are approximate.

Pitfalls:

- A visibility timeout below the worst case of the handler delivers the message a second time
  while the first is still running. Set it well above, and extend it from a heartbeat for long
  handlers.
- 256 KiB per message, attributes included, and ten attributes at most with raw delivery:
  large payloads need a claim check, which the envelope does not provide.
- Standard queues are unordered and deliver duplicates in normal operation. FIFO topics and
  queues order per message group (the `keyOf`) and deduplicate over five minutes only, at a
  lower throughput.
- The queue policy must allow the topic to send to it; without it the subscription exists and
  nothing arrives, silently. `onUnroutable: 'fail'` has no equivalent: SNS does not report an
  event that matched no subscription.
- A filter policy change takes minutes to apply: a test that subscribes then publishes at once
  is flaky unless it waits for the first delivery of a probe.
- A consumer created after a publication never sees it: there is no replay. Create the queues
  and subscriptions at deployment, before the producers.
- The local emulators differ from the service on filter policies and redrive timing: run the
  contract suite against the real service at least once.

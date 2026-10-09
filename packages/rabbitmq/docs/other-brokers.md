# The same provider on other brokers

An outline, without code or dependencies, for implementing an integration event provider on
Kafka, NATS JetStream and SQS/SNS. Each is held to what `RabbitMqEventBus` is held to.

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
- consumers deduplicate with `consume` and a processed-event store: every one of these
  brokers redelivers.

## Kafka

| Concept here | Kafka |
|---|---|
| exchange | a topic per event type (`<prefix>.<type>`), or one per producing context with the type in a header; decide once, the first is simpler to subscribe to |
| routing key | the topic; the **message key** is the ordering key (aggregate id) |
| publisher confirm | `acks=all` with the idempotent producer; `publish` resolves on the acknowledgement of the send |
| queue per consumer | consumer group `<consumer>`, subscribed to the topics of its types |
| manual ack | offset commit after the handler resolved, auto-commit off |
| retry queue | retry topic(s) per group (`<consumer>.<type>.retry`), consumed after a delay |
| dead queue | dead-letter topic per group (`<consumer>.<type>.dlt`) |
| `x-attempt` | a header on the record sent to the retry topic |

How it maps:

- `publish`: send each record with key, headers and JSON value, await every send, reject if
  one failed. The port gives no key: take it from a `keyOf(event)` option, the same function
  given to the relay for `ordering: 'per-key'`.
- `subscribe`: one consumer per group; dispatch each record to the handlers of its type;
  commit the offset after they resolved.
- A failure cannot be "nacked": the offset moves or the partition stops. So on failure,
  produce the record to the retry topic (attempt header incremented), then commit. A consumer
  of the retry topic waits until the record is old enough (pause the partition, do not sleep
  in the poll loop), then handles it; after the last attempt it produces to the dead-letter
  topic.
- `settle` for the contract: lag of the group at zero on work and retry topics, and no handler
  in flight.

Pitfalls:

- Committing before the transaction of the handler loses events; committing after duplicates
  them on a crash. Only the second is acceptable: hence the processed-event store.
- A slow handler exceeds `max.poll.interval.ms`, the group rebalances and the record is
  handled twice, concurrently. Bound the handler time, or pause and keep polling.
- The retry topic breaks per-key ordering. Where order matters, retry in place (blocking the
  partition) a bounded time, then dead-letter: say which one the provider does.
- Without `acks=all`, idempotence and `min.insync.replicas` at 2 or more, an acknowledged
  write can still be lost: the publisher guarantee is void.
- A new consumer group starts at `latest` by default and misses what was published before it
  existed. A queue binding does not have that surprise; choose `earliest` deliberately.
- Topics must exist with enough partitions before the first publish; auto-creation gives one
  partition and the default replication.
- A record that cannot be parsed blocks its partition for ever unless it is dead-lettered at
  once: the poison path is not optional.
- Change data capture (the Debezium outbox event router) can replace the relay and this
  publisher entirely; the consuming side stays.

## NATS JetStream

Core NATS has no persistence: only JetStream fits the ports.

| Concept here | JetStream |
|---|---|
| exchange | a stream capturing the subjects `<prefix>.>`, file storage, replicated |
| routing key | the subject `<prefix>.<type>` |
| publisher confirm | the publish acknowledgement of JetStream (`PubAck`); `publish` awaits it for every message |
| queue per consumer | a durable pull consumer `<consumer>-<type>` with a filter subject |
| manual ack | explicit ack policy; ack after the handler resolved |
| retry queue | none needed: negative ack with a delay, or the `backoff` list of the consumer |
| dead queue | no built-in one: see below |
| `x-attempt` | the delivery count in the metadata of the message |

How it maps:

- `publish`: publish each message with the header `Nats-Msg-Id` set to the event id. The
  stream then drops a duplicate published inside its deduplication window, which absorbs the
  retries of the relay.
- `subscribe`: create or bind the durable consumer, pull batches, dispatch, ack. Two instances
  bound to the same durable share the messages; two durables each get everything.
- Failure: negative ack with a delay; the server redelivers. The attempts are bounded by
  `MaxDeliver`.
- Dead-lettering is the provider's job. When the delivery count reaches the limit, publish the
  message to a dead subject kept by a dead stream (`<prefix>.dead.<consumer>.<type>`), then
  terminate it (`term`). Do both in that order.
- `settle`: the consumer reports no pending and no unacknowledged message.

Pitfalls:

- The default acknowledgement wait (30 s) redelivers a message whose handler is still running:
  set it above the worst case or send in-progress acks.
- Relying on the max-deliveries advisory instead of the explicit publication above leaves the
  message in the stream with no consumer that will ever see it again.
- The deduplication window is short (two minutes by default): it covers a relay retry, not a
  replay hours later. The processed-event store stays necessary.
- Stream retention must be `limits` or `interest` with every consumer created **before** the
  first publish; with `workqueue` retention two consumers cannot both get every event.
- A subject token cannot contain a dot-separated type as one token: map the type to the
  subject as is (`ordering.order.placed` is three tokens) and filter with the full subject.
- Changing the configuration of an existing durable consumer is partly refused: version the
  durable name, as for a queue with fixed arguments.

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

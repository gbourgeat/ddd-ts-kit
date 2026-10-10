---
name: integration-event
description: >-
  Makes two bounded contexts collaborate through a versioned integration event: declaring it
  in the producer's published language, publishing through the outbox, handling it
  idempotently in the consumer, evolving its payload, choosing a broker. Use when a context
  must react to another, when building a contract row of the slices, or when the user
  mentions events between contexts, messaging, outbox, consumers, RabbitMQ, Kafka, NATS,
  Redis Streams or eventual consistency. To decide who is upstream and which pattern, use
  context-map first.
argument-hint: "<producer-context> <Aggregate> <Fact>"
allowed-tools:
  - Read
  - Edit
  - Bash(npx ddd-ts-kit generate *)
  - Bash(npx ddd-ts-kit check *)
  - Bash(npx ddd-ts-kit list *)
  - Bash(npm run events:generate)
  - Bash(npm run events:check)
  - Bash(npm test *)
---

# Integration events

Event under discussion: `$ARGUMENTS`

A domain event stays inside its context. What crosses a boundary is an integration event: a
contract the producer owns, in its `published-language/`, the only folder another context
may import.

## Publish (producer side)

```bash
npx ddd-ts-kit generate integration-event <ctx> <Aggregate> <Fact> --json
```

writes the declaration `published-language/<fact>.v1.integration-event.ts`
(`defineIntegrationEvent({ type, version, payload })`), its export, the publisher in
`application/integration/publishers/` (a reaction to the domain event, which it creates when
missing) and the specs. Fill the `next` places:

- **Name**: `<context>.<aggregate>.<fact>`, past tense (`events/name-format`).
- **Payload**: what a consumer needs to act without calling back, and nothing internal:
  identifiers and facts, not the aggregate as JSON; no personal data unless a consumer needs
  it. Describe each field in the schema: the description lands in the catalog.
- **Outbox**: with a database the event is written in the transaction of the command and
  relayed afterwards; a publisher depends on `IntegrationEventPublisher` and nothing else
  (`events/outbox-required`). Never publish to a broker from a handler.

The payload is a contract between two owners: agree on it before the consumer is built, and
commit it first (skill `ddd-ts-kit:parallel-work`).

## Handle (consumer side)

The relationship is declared first (skill `ddd-ts-kit:context-map`); the generator refuses
otherwise.

```bash
npx ddd-ts-kit generate integration-handler <ctx> <upstream> <event-type> --json
```

writes `application/integration/handlers/<name>.integration-handler.ts` and its spec.

- The handler translates the event into **one command of its own context** and sends it on
  the `CommandBus`, as `systemActor('<context>.<name>')`. No business logic in it.
- It is declared with `@IntegrationEventHandler(definition, { consumer })`. The `consumer`
  name is a string literal, stable and unique in the project (generated as
  `<context>.<handler-name>`): the identity of its subscription and of its idempotency mark
  (`events/consumer-idempotent`). Renaming it replays or loses messages.
- Delivery is at least once and unordered across aggregates: the mark and the work share one
  unit of work, and the command must be safe to replay.
- Let a failure throw so the provider retries; after bounded retries the message is buried
  in a dead-letter destination and reported, never swallowed.
- A foreign model the context does not want is translated first:
  `npx ddd-ts-kit generate acl <ctx> <upstream>`.

## Evolve

Inside a version, changes are additive and optional; consumers ignore unknown fields.
Anything else (removal, rename, change of type or meaning) is
`generate integration-event ... --version <n+1>`, published next to the old version until
every consumer has moved.

## Provider

The application knows `IntegrationEventPublisher` and `IntegrationEventSubscriber` only. The
provider is `stack.broker`, wired in `src/platform/events/`: in memory by default (tests,
one process), or `@ddd-ts-kit/rabbitmq`, `@ddd-ts-kit/kafka`, `@ddd-ts-kit/nats`,
`@ddd-ts-kit/redis/event-bus`, each with one durable subscription per consumer, bounded
retries and dead letters. Relay and consumer strategy per transport:
`docs/ARCHITECTURE.md`, "Outbox, by transport", and each package README. A `custom` provider
passes `eventBusContract` of `@ddd-ts-kit/testing/contracts`. Handlers do not change with
the provider.

## Finish

```bash
npm run events:generate      # catalog and AsyncAPI, committed with the code
npx ddd-ts-kit check --rule events/name-format --rule events/defined-in-published-language \
  --rule events/consumer-idempotent --rule context/published-language-only
```

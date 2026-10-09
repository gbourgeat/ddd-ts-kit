---
name: integration-event
description: >-
  Makes two bounded contexts collaborate through a versioned integration event on any
  provider (in-memory, outbox and broker, queue service): declaring and publishing,
  consuming idempotently, evolving a payload, plugging a new provider. Use when a context
  must react to another, or when the user mentions events between contexts, messaging,
  broker, outbox, Kafka, RabbitMQ, SQS, NATS or eventual consistency.
argument-hint: "<producer-context> <Aggregate> <Fact>"
allowed-tools:
  - Bash(npx ddd-ts-kit generate *)
  - Bash(npx ddd-ts-kit check *)
  - Bash(npx ddd-ts-kit list *)
  - Bash(npm run events:generate)
  - Bash(npm run events:check)
---

# Integration events

Event under discussion: `$ARGUMENTS`

Domain events stay inside their context. What crosses a boundary is an **integration event**:
a contract the producer owns, in its `published-language/`.

## Publish

```bash
npx ddd-ts-kit generate integration-event <ctx> <Aggregate> <Fact> --json
```

- The event is declared once, in `published-language/`, with `defineIntegrationEvent({ type,
  version, payload })` from `@ddd-ts-kit/events`. The declaration types the payload, validates
  what is published and consumed, and feeds the generated catalog and AsyncAPI document
  (`npm run events:generate`, checked in CI by `events:check`). Describe each payload field in
  the schema: the description lands in the catalog.
- Name: `<context>.<aggregate>.<fact>`, past tense, kebab-case.
- Payload: what consumers need to act without calling back, and nothing internal. Identifiers
  and facts, not the aggregate dumped as JSON. No personal data unless a consumer needs it.
- The publisher translates the domain event into the envelope after the unit of work commits.
  With a database, that means the transactional outbox of `@ddd-ts-kit/events`
  (`OutboxPublisher`, `OutboxRelay`, a store from the ORM package): the event is written in
  the transaction of the command and relayed afterwards. Publishing straight to a broker inside a handler loses events.

## Consume

Declare the relationship first (skill `ddd-ts-kit:model-context`), then:

```bash
npx ddd-ts-kit generate consumer <ctx> <upstream> <event-type> --json
```

- A consumer translates the event into a command of its own context and sends it on the
  `CommandBus`. No business logic in it.
- Delivery is at-least-once and unordered across aggregates: wrap with `idempotent(...)`, and
  make the command safe to replay.
- A consumer imports only the upstream's `published-language/`.
- Failure: let it throw so the provider retries; a poison message goes to a dead-letter
  destination, never swallowed.

## Evolve

Inside a version, changes are additive and optional. Anything else (removal, rename, type or
meaning change) is a new `version`, published alongside the old one until every consumer
has moved. Consumers ignore unknown fields.

## Providers

The application knows two ports from `@ddd-ts-kit/kernel`: `IntegrationEventPublisher` and
`IntegrationEventSubscriber`. `InMemoryEventBus` implements both and is the default for tests,
local development and single-process deployments. Another provider is an adapter in
`src/platform/events/` implementing the same two ports, selected in `main.ts` from
configuration. Requirements for any adapter:

1. serialize the envelope as is, `traceparent` included, so traces continue across the hop;
2. acknowledge only after the handler resolved;
3. route by `type`; one durable subscription per consumer name;
4. pass `eventBusContract` from `@ddd-ts-kit/testing/contracts`, the suite `InMemoryEventBus`
   passes too.

Wrap the chosen adapter with `tracedPublisher` and `tracedSubscriber` from
`@ddd-ts-kit/tracing` in the composition root; nothing else changes.

Finish with `npx ddd-ts-kit check --rule events/name-format --rule context/published-language-only`.

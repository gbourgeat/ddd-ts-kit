# ddd-ts-kit/events-outbox-required

Architecture id: `events/outbox-required`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: `domain/` and `application/` of a context, tests excluded.

## Why

Publishing an integration event and committing the state change it describes must succeed or fail together. A handler that talks to a broker does both separately: the event leaves and the transaction rolls back, or the reverse. The handler writes to the `IntegrationEventPublisher` port; the composition root binds it to the outbox, and a relay publishes afterwards.

## Reported

- an import of a broker client: `amqplib`, `kafkajs`, `nats`, `@aws-sdk/client-sqs`, `@aws-sdk/client-sns`, `@google-cloud/pubsub`, `@ddd-ts-kit/rabbitmq` (configurable)
- an import of a concrete bus: `InMemoryEventBus`, `OutboxRelay`, `OutboxPublisher`, from any module, type-only imports included
- in `application/integration/publishers/`: a constructor parameter whose type is named `...EventBus` or `...Relay`

Incorrect:

```ts
// application/integration/publishers/invoice-issued.publisher.ts
import type { RabbitMqEventBus } from '@ddd-ts-kit/rabbitmq';

export class InvoiceIssuedPublisher {
  constructor(private readonly bus: RabbitMqEventBus) {}
}
```

Correct:

```ts
import type { IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';

export class InvoiceIssuedPublisher {
  constructor(private readonly publisher: IntegrationEventPublisher, private readonly ids: IdGenerator) {}
}
```

## Details

Static imports, type-only imports, `export ... from`, dynamic `import()` and `require()` are read for the broker packages; the concrete buses are recognised by their exported name, whatever they are renamed to.

## Options

`[{ "brokerPackages": ["amqplib", "bullmq"] }]` replaces the default list of broker clients.

`rules."events/outbox-required"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line events/outbox-required -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- That the port is bound to an `OutboxPublisher` in the composition root, and that `stack.events` is `outbox` whenever `stack.orm` is set, is a matter of configuration and wiring: `ddd-ts-kit check` holds it.
- A handler that calls a broker through a port of its own (`NotificationQueue`) is not seen: the name of a port says nothing of what is behind.
- Outside `application/integration/publishers/` a constructor parameter typed `EventBus` is not reported: the kernel type is a port, only the publisher has a narrower one to prefer.
- A broker client that is not in the list is reported by `layer/application-inward` as a package, not by this rule.

## With the CLI checker

`ddd-ts-kit check` reports the same id from the text of the files and owns the configuration side. This rule is the authority for the code.

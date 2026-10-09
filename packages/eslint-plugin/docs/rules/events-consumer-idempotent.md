# ddd-ts-kit/events-consumer-idempotent

Architecture id: `events/consumer-idempotent`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: every file of a context, tests excluded; the direct `subscribe` only in `application/` and the module file.

## Why

Delivery is at least once. A consumer without a stable name and a processed-event store handles a redelivered event a second time: the invoice is issued twice. The name is the idempotency scope, so it is written once and never derived.

## Reported

- `<builder>.on(definition)` or `<builder>.on(definition, {})` followed by `.handledBy(...)` or `.handledByFactory(...)`, without a `consumer` (an empty string counts as absent)
- `on(definition, handler)` of `@ddd-ts-kit/events` whose third argument does not carry both `consumer` and `processed`
- in `application/` and the module file: a direct `.subscribe(...)` whose handler is not wrapped by `idempotent(...)`

Incorrect:

```ts
builder.on(productListedV1).handledBy(ProductListedConsumer, [COMMAND_BUS]);

subscribeAll(platform.subscriber, [on(productListedV1, (event) => consumer.handle(event))]);

resolve(EVENT_SUBSCRIBER).subscribe('catalog.product.listed', (event) => consumer.handle(event));
```

Correct:

```ts
builder.on(productListedV1, { consumer: 'billing.price-list' }).handledBy(ProductListedConsumer, [COMMAND_BUS]);

subscribeAll(platform.subscriber, [
  on(productListedV1, (event) => consumer.handle(event), { consumer: 'billing.price-list', processed: platform.persistence.processedEvents }),
]);
```

## Details

`on` is recognised by its import from `@ddd-ts-kit/events`, under any local name; `builder.on` by the chain that ends with a handler, which tells it from the `on` of an event emitter. `consume` requires both options by its type and is not judged. `subscribe(type, idempotent(name, store, handler))` is accepted: `idempotent` of the kernel is what `on` and `consume` are built on.

## Options

None.

`rules."events/consumer-idempotent"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line events/consumer-idempotent -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- Options held in a variable or spread from another object are not followed: nothing is reported as missing.
- That the consumer name is unique and stable over time is not checked here (`createApplication` refuses a name declared twice for the same event).
- That the store is transactional, or that the mark commits with the handler, is not checked: prefer `consume`, or pass `unitOfWork`.
- Any `.subscribe(...)` in `application/` or the module file is taken for an event subscription, whatever the receiver is.

## With the CLI checker

`ddd-ts-kit check` reports the same id from the text of the files and stays the fast edit-time guard. This rule is the authority.

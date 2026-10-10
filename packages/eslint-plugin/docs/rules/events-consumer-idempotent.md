# ddd-ts-kit/events-consumer-idempotent

Architecture id: `events/consumer-idempotent`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: every file of a context, tests excluded; the direct `subscribe` only in `application/` and the module file.

## Why

Delivery is at least once. A consumer without a stable name and a processed-event store handles a redelivered event a second time: the invoice is issued twice. The name is the idempotency scope, so it is written once and never derived.

## Reported

- `<builder>.on(definition)` or `<builder>.on(definition, {})` followed by `.handledBy(...)` or `.handledByFactory(...)`, without a `consumer` (an empty string counts as absent)
- `on(definition, handler)` of `@ddd-ts-kit/events` whose third argument does not carry both `consumer` and `processed`
- in `application/` and the module file: a direct `.subscribe(...)` whose handler is not wrapped by `idempotent(...)`
- in a declared-style project (`stack.style: "declared"`): a class carrying `@IntegrationEventHandler(...)` of `@ddd-ts-kit/kernel/declarations` whose options do not write `consumer` as a non-empty string literal (missing, empty, a variable, a template with a substitution, options held in a variable or only spread)

Incorrect:

```ts
builder.on(productListedV1).handledBy(ProductListedHandler, [CommandBus]);

subscribeAll(platform.subscriber, [on(productListedV1, (event) => consumer.handle(event))]);

resolve(IntegrationEventSubscriber).subscribe('catalog.product.listed', (event) => consumer.handle(event));

// declared style
@IntegrationEventHandler(productListedV1, { consumer: consumerName }, [CommandBus])
export class CatalogProductListedHandler {}
```

Correct:

```ts
builder.on(productListedV1, { consumer: 'billing.price-list' }).handledBy(ProductListedHandler, [CommandBus]);

subscribeAll(platform.subscriber, [
  on(productListedV1, (event) => consumer.handle(event), { consumer: 'billing.price-list', processed: platform.persistence.processedEvents }),
]);

// declared style
@IntegrationEventHandler(productListedV1, { consumer: 'billing.catalog-product-listed' }, [CommandBus])
export class CatalogProductListedHandler {}
```

## Details

`on` is recognised by its import from `@ddd-ts-kit/events`, under any local name; `builder.on` by the chain that ends with a handler, which tells it from the `on` of an event emitter. `consume` requires both options by its type and is not judged. `subscribe(type, idempotent(name, store, handler))` is accepted: `idempotent` of the kernel is what `on` and `consume` are built on.

In a declared-style project an integration event handler class is its own registration: `@IntegrationEventHandler(definition, { consumer: '<context>.<reaction>' }, [ports])` satisfies the rule and nothing has to be written in a module file. The decorator counts when its name is imported from `@ddd-ts-kit/kernel/declarations` in the file, under an alias or a namespace too. A module file kept in a declared-style project is judged as in the explicit style. In an explicit-style project the decorator is not read.

## Options

None.

`rules."events/consumer-idempotent"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line events/consumer-idempotent -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- Options held in a variable or spread from another object are not followed: nothing is reported as missing.
- That the consumer name is unique and stable over time is not checked here: ESLint judges one file at a time, and two `@IntegrationEventHandler`, or one and a module registration, live in two files. `ddd-ts-kit check` compares the names of the whole project, decorators included, and `createApplication` refuses a name declared twice for the same event.
- That a `*.integration-handler.ts` file carries `@IntegrationEventHandler` at all is the business of `declarations-role-declared`, which also reports the unwritten `consumer`.
- That the store is transactional, or that the mark commits with the handler, is not checked: prefer `consume`, or pass `unitOfWork`.
- Any `.subscribe(...)` in `application/` or the module file is taken for an event subscription, whatever the receiver is.

## With the CLI checker

`ddd-ts-kit check` reports the same id from the text of the files and stays the fast edit-time guard. This rule is the authority.

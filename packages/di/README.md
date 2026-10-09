# @ddd-ts-kit/di

Typed tokens and context modules on top of [tsyringe](https://github.com/microsoft/tsyringe),
for projects that want dependency injection without a heavy framework.

Domain and application classes stay free of decorators. The wiring is explicit and lives in
`<context>.module.ts`; `main.ts` assembles the modules; a test swaps adapters for fakes.

```
npm i @ddd-ts-kit/di tsyringe reflect-metadata
```

`reflect-metadata` is imported by this package before tsyringe loads (tsyringe refuses to load
without it), so you do not import it yourself.

## A context module

```ts
// contexts/ordering/ordering.module.ts
import { CLOCK, COMMAND_BUS, EVENT_PUBLISHER, ID_GENERATOR, defineContextModule, token } from '@ddd-ts-kit/di';
import { PaymentCaptured } from '../billing/published-language/index.js';

export const ORDER_REPOSITORY = token<OrderRepository>('ordering.OrderRepository');
export const ORDER_READS = token<OrderReads>('ordering.OrderReads');
export const STOCK_GATEWAY = token<StockGateway>('ordering.StockGateway');

export const orderingModule = defineContextModule({
  name: 'ordering',
  register(builder) {
    builder.bind(ORDER_REPOSITORY).toClass(DrizzleOrderRepository, [DATABASE]).as('repository');
    builder.bind(ORDER_READS).toClass(DrizzleOrderReads, [DATABASE]).as('repository');
    builder.bind(STOCK_GATEWAY).toClass(HttpStockGateway, [STOCK_API_URL]).as('gateway');

    builder
      .command(PlaceOrder)
      .handledBy(PlaceOrderHandler, [ORDER_REPOSITORY, STOCK_GATEWAY, EVENT_PUBLISHER, ID_GENERATOR, CLOCK]);
    builder.command(MarkOrderPaid).handledBy(MarkOrderPaidHandler, [ORDER_REPOSITORY, CLOCK]);
    builder.query(GetOrder).handledBy(GetOrderHandler, [ORDER_READS]);

    builder
      .on(PaymentCaptured, { consumer: 'ordering.mark-order-paid' })
      .handledBy(MarkOrderPaidOnPaymentCaptured, [COMMAND_BUS]);
  },
});
```

The compiler checks that `PlaceOrderHandler` handles `PlaceOrder` and answers its result type,
that the consumer handles the payload of `PaymentCaptured`, and that every token list matches
the constructor parameters, in order. Nothing else is needed: no handler token, no manual
registration on a bus, no subscription code.

```ts
// main.ts
import { COMMAND_BUS, createApplication, kernelModule } from '@ddd-ts-kit/di';

const app = createApplication({ modules: [kernelModule(), platformModule, orderingModule, billingModule] });
await app.start();
const orderId = await app.resolve(COMMAND_BUS).execute(new PlaceOrder('sku-1')); // typed string
process.on('SIGTERM', () => void app.stop());
```

```ts
// contexts/ordering/test/unit/place-order.handler.spec.ts
import { createTestApplication, fake } from '@ddd-ts-kit/di';

it('places an order and announces it', async () => {
  const orders = new InMemoryOrderRepository();
  const app = createTestApplication({
    modules: [orderingModule],
    fakes: [fake(ORDER_REPOSITORY, orders), fake(STOCK_GATEWAY, new InMemoryStock({ 'sku-1': 3 }))],
  });

  const orderId = await app.commandBus.execute(new PlaceOrder('sku-1'));

  expect(orders.count()).toBe(1);
  expect(app.eventBus.published).toMatchObject([{ type: 'ordering.order.placed', payload: { orderId } }]);
});
```

## Declarations

| Call | Meaning |
|---|---|
| `bind(token).toClass(Class, [tokens])` | `new Class(...)` with the tokens resolved in order; the list is omitted for a constructor without parameters |
| `bind(token).toFactory((resolve) => instance)` | anything a constructor cannot express |
| `bind(token).toValue(value)` | an existing object or a constant |
| `.singleton()` / `.transient()` | one instance per application (default) or one per resolution |
| `.as(kind)` | role of the binding, handed to the `decorate` hook: `repository`, `gateway`, `external`, `use-case`, `publisher`, `consumer` |
| `rebind(token).to...` | replaces the binding of a module listed earlier, such as a default of `kernelModule()` |
| `command(Type).handledBy(Handler, [tokens])` | binds the handler (singleton, kind `use-case`) and registers it on `COMMAND_BUS` |
| `query(Type).handledBy(Handler, [tokens])` | the same on `QUERY_BUS` |
| `on(definition, { consumer }).handledBy(Consumer, [tokens])` | binds the consumer (kind `consumer`) and subscribes its `handle(event)` to `EVENT_SUBSCRIBER` |
| `.handledByFactory((resolve) => handler)` | the factory form of the three lines above |

Handlers are registered when the application is created, which resolves the two buses; a
handler itself is built on the first message it handles, then reused. Consumers are subscribed
by `start()` and unsubscribed by `stop()`, since a subscription is a side effect.

`definition` is anything with `type`, `version` and `parse(event)`: a declaration made by
`defineIntegrationEvent` of `@ddd-ts-kit/events` fits as it is. An event of another version is
skipped, an event the definition cannot read throws `UnreadableEventError` so that the provider
retries or dead-letters it, and a redelivered event is handled once per `consumer` name when
`PROCESSED_EVENTS` is bound. The name is required: it is the idempotency key, and it must
survive the renaming of a class.

## The kernel module

`kernelModule(options?)` binds the tokens every context depends on.

| Token | Port | Default | Option |
|---|---|---|---|
| `CLOCK` | `Clock` | `SystemClock` | `clock` |
| `ID_GENERATOR` | `IdGenerator` | `UuidGenerator` | `ids` |
| `UNIT_OF_WORK` | `UnitOfWork` | `InMemoryUnitOfWork` | `unitOfWork` |
| `COMMAND_BUS` | `CommandBus` | `InMemoryCommandBus` running each command in the unit of work | `commandBus` |
| `QUERY_BUS` | `QueryBus` | `InMemoryQueryBus` | `queryBus` |
| `EVENT_BUS` | `EventBus` | `InMemoryEventBus` | `eventBus` |
| `EVENT_PUBLISHER` | `IntegrationEventPublisher` | the event bus | `eventPublisher` |
| `EVENT_SUBSCRIBER` | `IntegrationEventSubscriber` | the event bus | `eventSubscriber` |
| `PROCESSED_EVENTS` | `ProcessedEventStore` | `InMemoryProcessedEventStore` | `processedEvents` |
| `EXECUTION_SCOPE` | `ExecutionScope` | `AsyncLocalStorageExecutionScope` | `executionScope` |
| `ACTOR_CONTEXT` | `ActorContext` | `ScopedActorContext`: the actor of the execution scope | `actorContext` |
| `LOGGER` | `Logger` | `NoopLogger` | `logger` |
| `METRICS` | `Metrics` | `NoopMetrics` | `metrics` |
| `CACHE` | `Cache` | `InMemoryCache` on `CLOCK` | `cache` |

An option is an instance or a `(resolve) => instance` factory. An adapter with dependencies of
its own reads better in the module that owns them:

```ts
export const persistenceModule = defineContextModule({
  name: 'persistence',
  register(builder) {
    builder.bind(DATABASE).toFactory(() => connect(config.databaseUrl));
    builder.rebind(UNIT_OF_WORK).toClass(DrizzleUnitOfWork, [DATABASE]);
    builder.rebind(EVENT_PUBLISHER).toClass(OutboxPublisher, [DATABASE, CLOCK]).as('publisher');
    builder.rebind(EVENT_SUBSCRIBER).toClass(BrokerSubscriber, [BROKER]);
  },
});
```

Use cases publish through `EVENT_PUBLISHER` and never through `EVENT_BUS`, so moving to an
outbox touches no context. A bus given for `COMMAND_BUS` or `QUERY_BUS` needs a
`register(type, handler)` method for the declared handlers to be attached to it.

## Tests

`createTestApplication({ modules, fakes, now?, idPrefix? })` puts the modules on a deterministic
kernel, whether or not they list `kernelModule()`, and returns the application plus what a
spec touches:

| Member | Is |
|---|---|
| `commandBus`, `queryBus` | the in-memory buses, with every declared handler |
| `eventBus` | `InMemoryEventBus`; `eventBus.published` lists what the use cases announced |
| `clock` | `FixedClock` at `now` (default `2026-01-01T00:00:00.000Z`); `clock.advance(ms)` |
| `ids` | `SequentialIdGenerator`: `id-1`, `id-2`... |
| `actorContext` | `FixedActorContext`; `actAs(actor)` changes who infrastructure sees |
| `executionScope` | `FixedExecutionScope` (correlation `test-correlation`, origin `test`), following `actorContext` |
| `logger`, `metrics` | `InMemoryLogger` and `InMemoryMetrics`: assert `logger.entries`, `metrics.samples` |
| `cache` | `InMemoryCache` on `clock` |
| `get(token)` | `resolve`, typed by the token |

A fake must stand for a token that a module binds or that a class depends on, otherwise
`UNKNOWN_FAKE` is raised: a fake for the wrong token would silently leave the real adapter in
place. Consumers receive events once `await app.start()` ran.

`createApplication({ overrides: [override(TOKEN, value)] })` is the unchecked form, and
`overrideForTests(app, TOKEN, value)` swaps a binding on an existing application; call it
before the first `resolve`, since a singleton already built keeps what it was given. An
override replaces the binding, may stand in for a module that is not loaded, and is not
decorated. Every application owns a tsyringe child container (`app.container`), so two tests
never share instances.

## Checks

`createApplication` throws a `WiringError` (with a `code`) before anything is instantiated:

- `DUPLICATE_BINDING`: a token bound twice, both modules named;
- `NOTHING_TO_REBIND`: a `rebind` of a token that no earlier module binds;
- `UNBOUND_DEPENDENCY`: a class dependency that no module binds, or handlers and consumers
  declared without the bus they go on;
- `DEPENDENCY_CYCLE`: a cycle between class bindings, the path printed;
- `INCOMPLETE_BINDING`: a `bind`, `command`, `query` or `on` left without its target;
- `DUPLICATE_HANDLER`: a command or a query with two handlers, both modules named;
- `DUPLICATE_CONSUMER`: two consumers of the same event sharing a name;
- `BUS_WITHOUT_REGISTER`: handlers declared for a bus that cannot receive them;
- `UNKNOWN_FAKE`: see above.

Factories do not declare what they resolve, so a cycle or a missing token going through a
factory is reported when it is resolved (`DEPENDENCY_CYCLE`, `UNBOUND_TOKEN`).

## Diagnostics

`app.describe()` returns the wiring as plain, serializable data: tokens and classes by name.

```ts
{
  modules: ['kernel', 'ordering'],
  bindings: [{ token: 'PlaceOrderHandler', module: 'ordering', kind: 'use-case', lifetime: 'singleton',
               source: 'class', implementation: 'PlaceOrderHandler',
               dependencies: ['ordering.OrderRepository', 'kernel.Clock'], overridden: false }],
  commands: [{ message: 'PlaceOrder', handler: 'PlaceOrderHandler', module: 'ordering' }],
  queries: [{ message: 'GetOrder', handler: 'GetOrderHandler', module: 'ordering' }],
  subscriptions: [{ event: 'billing.payment.captured', version: 1, consumer: 'ordering.mark-order-paid',
                    handler: 'MarkOrderPaidOnPaymentCaptured', module: 'ordering' }],
  overrides: [],
}
```

## The `decorate` hook

`createApplication({ decorate })` receives every instance a binding creates, handlers and
consumers included, with `{ token, context, kind? }`, and returns the instance to hand out. It
is the place for cross-cutting wrappers such as tracing; see the README of
`@ddd-ts-kit/tracing`. This package depends on no tracing library.

One binding takes its own wrappers with `.with(...)`, the first outermost:

```ts
builder.bind(PAYMENTS).toClass(HttpPaymentGateway, [HTTP]).as('external').with(retry({ attempts: 3 }), timeout(2000));
```

A `BindingAspect` is `(instance, { kind?, className, context, token }) => instance`; the aspects
of `@ddd-ts-kit/aspects` fit as they are, and its `aspects(...)` builds a `decorate` hook. The
`decorate` hook comes around the aspects of a binding.

## Access control

A use case says what it requires where it is registered, or says it is public:

```ts
builder.command(IssueInvoice).requires(permissions['invoice.issue']).handledBy(IssueInvoiceHandler, [INVOICES, CLOCK]);
builder.query(GetCatalog).public().handledBy(GetCatalogHandler, [CATALOG]);
```

`.requires` exists only for messages that carry an actor (`AuthorizedCommand`,
`AuthorizedQuery` of the kernel). With `createApplication({ modules, authorization: 'required' })`
an application whose command or query declares neither does not start
(`UNDECLARED_AUTHORIZATION`), and one that declares them without a module enforcing them does
not either (`AUTHORIZATION_NOT_ENFORCED`). The enforcement itself, the authorizers and the
tokens typed by them live in `@ddd-ts-kit/auth` (`authorizationModule` from
`@ddd-ts-kit/auth/di`). `ACTOR_CONTEXT` is bound by `kernelModule()`; the test application
takes an `actor` option.

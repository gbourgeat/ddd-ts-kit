---
name: wiring
description: >-
  Declares services, use cases and event consumers of a bounded context with the
  lightweight dependency injection of ddd-ts-kit (tsyringe, no decorators in domain or
  application), for production and for tests, or the equivalent with NestJS or manual
  wiring. Use when composing modules in main.ts, binding an adapter to a port, replacing an
  adapter with a fake in a test, or when a WiringError or the rule
  composition/only-in-module is reported.
---

# Wiring

Objects are created in exactly two places: `<context>.module.ts` and `src/main.ts`. Domain and
application classes take their dependencies by constructor and carry no decorator.

## A context module (tsyringe)

```ts
export const ORDERS = token<OrderRepository>('OrderRepository');
export const PAYMENTS = token<PaymentGateway>('PaymentGateway');

export const orderingModule = defineContextModule({
  name: 'ordering',
  register(builder) {
    builder.bind(ORDERS).toClass(DrizzleOrderRepository, [DATABASE]).as('repository');
    builder.bind(PAYMENTS).toClass(StripePaymentGateway, [CONFIG]).as('external');

    builder.command(PlaceOrder).handledBy(PlaceOrderHandler, [ORDERS, CLOCK, ID_GENERATOR]);
    builder.command(PayOrder).handledBy(PayOrderHandler, [ORDERS, PAYMENTS, CLOCK]);
    builder.query(GetOrder).handledBy(GetOrderHandler, [ORDER_READS]);
  },
});
```

- The token list must match the constructor parameters in order: the compiler checks it.
- `.as(kind)` (`repository`, `gateway`, `external`, `use-case`, `publisher`, `consumer`)
  tells cross-cutting decoration, tracing first, what the object is.
- Handlers are reached through `CommandBus` and `QueryBus` only; nobody resolves a handler.
- `createApplication` refuses duplicate bindings, missing dependencies and cycles before
  anything is instantiated. Read the `WiringError`: it names the token and the module.

Exact API and current sugar: README of `@ddd-ts-kit/di`. `npx ddd-ts-kit generate ...` adds
the binding lines between the markers of the module for you.

## `main.ts`

Tracing first, then `createApplication({ modules: [kernelModule(), platformModule, ...contexts], decorate })`,
`await app.start()`, mount routes, and `app.stop()` on `SIGTERM`.

## Tests

```ts
const app = createTestApplication({
  modules: [orderingModule],
  fakes: [fake(ORDERS, orders), fake(PAYMENTS, payments)],
});

await app.commandBus.execute(new PlaceOrder(...));

expect(orders.all()).toHaveLength(1);
```

The test application brings `FixedClock`, sequential identifiers and in-memory buses. Replace
every adapter that leaves the process with its fake; never mock a module.

## NestJS or manual

Same rule, other syntax: providers with `useFactory` in the context's Nest module, or a
`wire<Context>(platform)` function. Keep `@Injectable()` out of `domain/` and `application/`:
declare providers with factories in the module file instead.

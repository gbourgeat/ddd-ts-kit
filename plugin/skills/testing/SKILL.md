---
name: testing
description: >-
  Writes readable, refactoring-proof tests for a ddd-ts-kit project. Fakes and in-memory
  adapters instead of mocks, test data builders, given/when/then scenarios for aggregates,
  contract suites shared by fakes and real adapters, end-to-end tests with seeded generated
  data. Use when writing or reviewing a test, when a test needs data setup, when tempted to
  use vi.mock, vi.fn or a spy, or when a test/* rule is reported.
allowed-tools:
  - Bash(npx ddd-ts-kit generate *)
  - Bash(npx ddd-ts-kit check *)
  - Bash(npx ddd-ts-kit list *)
  - Bash(npm test *)
  - Bash(npm run test:e2e *)
---

# Tests

A test reads as a business rule: what was true, what was asked, what happened. Everything
else is hidden in builders and fakes. Examples use Vitest, the default; with Jest the same
rules hold with `jest.*` in place of `vi.*`.

## No mocks

Do not use `vi.mock`, `vi.fn`, `vi.spyOn` or a mocking library in a context's tests. They
check that a call was made, not that the outcome is right, and they break when code is
reorganised without changing behaviour.

| Need | Use |
|---|---|
| a repository | its fake in `test/fakes/` (extends `InMemoryRepository`), assert `all()` or `findById` |
| another port (gateway, mailer, payment) | a fake class implementing the port, recording what it received as plain data |
| time, identifiers | `FixedClock`, `SequentialIdGenerator` from the kernel |
| events published | `InMemoryEventBus`, assert `published` |
| buses | `InMemoryCommandBus`, `InMemoryQueryBus` |
| a failure of a dependency | a method on the fake: `payments.failNextWith(new PaymentDeclined())` |
| the database | the real one through the adapter's integration spec, never a mocked driver |

`npx ddd-ts-kit generate port|repository` creates the fake with the port. A fake stays honest
because it passes the same contract suite as the real adapter
(`@ddd-ts-kit/testing/contracts`): write the suite call for both.

The only acceptable test double that is not a fake is a stub of an outside HTTP API at the
network level in an adapter's integration spec.

## Builders

Every aggregate has a builder in `test/builders/<name>.builder.ts`:

```bash
npx ddd-ts-kit generate builder <ctx> <Aggregate> --json
```

```ts
const order = anOrder().forCustomer('ada').withLine(aLine().of('sku-1').times(2)).paid().build();
```

- Defaults make a valid aggregate; a test overrides only what its rule is about.
- Methods are named in the ubiquitous language (`paid()`, `expiredSince(date)`), not after
  fields (`withStatus('PAID')`).
- `build()` goes through the aggregate's `create` and intention methods, so an invalid state
  cannot be built. If a test needs a state the public API cannot reach, the state is
  impossible or the API is incomplete.
- Builders are immutable: each call returns a new builder, a shared base cannot leak.
- Nested builders are accepted wherever a value is.
- For value objects and commands, a builder is worth it from three fields up.

## Aggregate specs: given / when / then

```ts
given(anOrder().withLine(aLine()).build())
  .when((order) => order.pay(clock.now()))
  .thenEvents([{ name: 'ordering.order.paid' }]);

given(anOrder().paid().build())
  .when((order) => order.pay(clock.now()))
  .thenError(OrderAlreadyPaid);
```

One intention per test. Assert events, errors, and state through public API only.

## Handler specs

Arrange with builders and fakes, execute the real handler through the bus, assert outcomes:
the stored aggregate, the published events, the returned value. Cover the happy path, each
declared error code, and that a failure saves and publishes nothing.

## Adapter specs (`test/integration/`)

Real dependency (PostgreSQL in Docker, or PGlite in process for speed), the contract suite
first, then what is specific to the adapter (mapping of every column, transaction rollback).

## Naming and shape

- `describe` the unit, `it` states the rule: `refuses to pay an order twice`.
- Arrange, act, assert separated by blank lines; no logic (`if`, loops) in a test.
- `it.each` with a table for boundaries of a value object.
- No shared mutable state between tests; build fresh in each.
- A test that needs a comment to be understood needs better builder method names.

Finish with the context's tests and
`npx ddd-ts-kit check --rule test/no-mocks --rule test/builder-required --rule test/spec-required`.

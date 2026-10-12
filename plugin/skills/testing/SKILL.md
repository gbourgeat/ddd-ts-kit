---
name: testing
description: >-
  Writes readable, refactoring-proof tests for a ddd-ts-kit project. Given / when / then
  for aggregates, real handlers through the test application with fakes, builders for test
  data, contract suites shared by fakes and adapters, end-to-end specs. Use when writing or
  reviewing a test, turning it.todo entries into tests, when a test needs data setup, when
  tempted by vi.mock, vi.fn or a spy, or when a test/* rule is reported.
allowed-tools:
  - Read
  - Edit
  - Bash(npx ddd-ts-kit generate *)
  - Bash(npx ddd-ts-kit check *)
  - Bash(npx ddd-ts-kit list *)
  - Bash(npm test *)
  - Bash(npm run test:coverage)
  - Bash(npm run test:e2e *)
---

# Tests

A test reads as a business rule: what was true, what was asked, what happened. Examples use
Vitest, the default; with Jest the same rules hold. Every generated spec holds one passing
test and `it.todo` entries naming the behaviours to prove: replace each, never delete one.

## Levels

| Level | What runs | Doubles | Where |
|---|---|---|---|
| domain | aggregates, value objects, domain services | none | `test/unit/` |
| application | the real handler through the buses, with its permission | fakes of every port, fixed clock, sequential ids | `test/unit/` |
| adapter | one adapter against its real dependency, and the contract suite | none | `test/integration/` |
| end to end | the whole application through HTTP and the event bus | none; generated seeded data | `test/e2e/` at the project root |

## No mocks

No `vi.mock`, `vi.fn`, `vi.spyOn`, their `jest` twins or a mocking library in a context's
tests (`test/no-mocks`): they assert calls, not outcomes, and break on refactoring.

| Need | Use |
|---|---|
| a repository | its fake in `test/fakes/` (extends `InMemoryRepository`); assert `findById` or `all()` |
| another port | its fake, a working in-memory class recording what it received; an object literal fits too, a port being a shape |
| time, identifiers | `application.clock` (`advance`), sequential ids (`idPrefix`) |
| published events | `application.eventBus.published`; domain events of the command, heard once its handler has returned: `application.domainEvents.on('<name>', ...)` before executing; what `after-commit` handlers threw: `application.domainEvents.afterCommitFailures` |
| logs, metrics, unexpected failures | `application.logger.entries`, `metrics.samples`, `errors.reports` |
| a failing dependency | a method on the fake: `payments.failNextWith(new PaymentDeclined())` |
| a scheduled job | `application.jobs.runNow('<context>.<job>')` |
| the database | the real one in the adapter's integration spec, never a mocked driver |

A fake stays honest because it passes the same contract suite as the real adapter
(`@ddd-ts-kit/testing/contracts`); `generate port|repository` writes both.

## Aggregate specs: given / when / then

```ts
given(anOrder().withLine(aLine()).build())
  .when((order) => order.pay(clock.now()))
  .thenEvents([{ name: 'ordering.order.paid' }]);

given(anOrder().paid().build())
  .when((order) => order.pay(clock.now()))
  .thenError('ORDER_ALREADY_PAID', { orderId: 'order-1' });
```

One intention per test. Assert events, errors, and state through the public API only. A
refusal is asserted by its code and its facts, never by a message or the class of one error:
`thenError(code, facts)` on an aggregate, `expectRefusal(subject, code, facts)` on an action, a
`Result` or a caught error, `expectProblem(response, { status, code, facts })` end to end.

## Handler specs

The generated `arrange()` builds a test application from the platform test module, the
context (`contextModule('<context>', declarations)` or its module) and the fakes. Execute
through `application.commandBus` or `queryBus` with an actor built by `anActor()`. Cover: the
happy path, each failure by its error code, nothing saved or published on failure, and the
refusal of an actor without the permission (generated). Reactions: dispatch the event and
assert the command's effect; an integration event handler run twice changes state once.

Always assemble the context from its generated file: it is what registers what each
constructor is injected, so neither the test nor the handler lists a dependency. To test one
class alone, take it from that file,
`contextModule('<context>', { PlaceOrderHandler: declarations.PlaceOrderHandler })`, never
from its own import: a class handed over alone has no dependency list
(`WiringError MISSING_DEPENDENCIES`). Every port a class of the assembled context takes is
bound by the platform test module or by a `fake(Port, aFake)`, read models of projections
included.

## Builders

One per aggregate in `test/builders/` (`generate builder`, written with the aggregate):
valid defaults, methods named in the ubiquitous language (`paid()`, not
`withStatus('PAID')`), built through the aggregate's public API so an invalid state cannot be
built. A test states only what its rule depends on.

## End to end

`npx ddd-ts-kit generate e2e <ctx> <UseCase>` writes the three baseline cases of a route:
401 without a credential, 403 without the permission, the documented status with it. Add
the business scenario; assert what a client observes (responses, published events), never
the database.

## Shape

- `describe` the unit, `it` states the rule: `refuses to pay an order twice`.
- Arrange, act, assert separated by blank lines; no `if`, no loop; `it.each` for the
  boundaries of a value object.
- No shared mutable state; never read a private field; no snapshot of whole objects.

A coverage rate says that code ran under a test, never that the test asserts anything: write
the spec for the behaviour, and let the rate follow. The thresholds of `ddd-ts-kit.config.json`
are a floor per context and layer, not a goal; a test written to move a number proves nothing.

Finish with `npm test -- <context>`, `npm run test:coverage` before the slice is closed, and
`npx ddd-ts-kit check --rule test/no-mocks --rule test/builder-required --rule test/spec-required`.

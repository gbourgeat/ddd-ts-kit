---
applyTo: "src/contexts/*/test/**,**/*.spec.ts,test/**"
---

# Tests

- `test/unit/`: aggregates, value objects and domain services without any double, given / when / then on the recorded facts; handlers with the fakes of `test/fakes/`.
- A handler spec goes through the test application, `createTestApplication({ modules, fakes: [fake(Port, aFake)] })`: it asserts the stored state, the facts announced with the save (`application.domainEvents`), `application.eventBus.published`, and the refusal (`FORBIDDEN`) of an actor without the permission.
- A job spec runs the job by its name, `await application.jobs.runNow('<context>.<job>')`, and asserts the command it sent as its system actor.
- `test/integration/`: adapters against the real dependency, and the contract suites every adapter and fake of a port must pass.
- A fake is a working in-memory implementation, not a mock with expectations: no `vi.mock`, `vi.fn`, `vi.spyOn` (`test/no-mocks`). Test data comes from the builders of `test/builders/`.
- The arrangement several specs of a context share, the test application or the buses with the fakes, is a world of `test/worlds/` written by `npx ddd-ts-kit generate test-world <context>`: `a<Name>World({ now, idPrefix, given })` returns every fake under the name of its port, `given` storing what the spec starts from. `test/unit/` and `test/integration/` hold specs only (`test/helper-placed`).
- Name tests after the behaviour, in the words of the business: "refuses to issue an invoice without lines", not "should throw". Arrange, act, assert, separated by a blank line; one behaviour per test.
- Every aggregate, value object, domain service, handler, event handler and integration event handler has a spec named after its file (`test/spec-required`).
- Coverage is a floor per context and layer, read from `coverage` in `ddd-ts-kit.config.json` and held by `npm run verify` (`npm run test:coverage`): a layer under its threshold gets the test that is missing. No `exclude` in the runner config, no `v8 ignore` or `istanbul ignore` comment without `-- ADR-NNNN: <reason>` (`test/coverage-governed`); a rate proves that code ran, never that a test asserts anything.
- An `it.todo` left by the generator names a behaviour still to prove: replace it by a real test, do not delete it. `npx ddd-ts-kit todo <context>` lists what remains.
- A test never asserts on a private field; it observes results, recorded events and what the fakes received.
- `test/e2e/` (project root) drives the whole application through HTTP with generated, seeded data, never reads the database, and asserts the trace of a request with `expectSpanTree(storyOf(trace), [...])`. What happens after the answer (the outbox relayed, the handlers it reaches) is asserted once `await application.settled()` has resolved, never after a fixed delay.
- Write tests with `/ddd-ts-kit:testing`; scaffold with `npx ddd-ts-kit generate builder|test-world|e2e`.

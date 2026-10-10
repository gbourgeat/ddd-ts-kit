---
paths:
  - "{{config.contextsDir}}/*/test/**"
  - "**/*.spec.ts"
---

# Tests

- `test/unit/`: aggregates, value objects and domain services without any double; handlers with the fakes of `test/fakes/`.
- `test/integration/`: adapters against the real dependency, and the contract suites every adapter and fake of a port must pass.
- A fake is a working in-memory implementation, not a mock with expectations: no `vi.mock`, `vi.fn`, `vi.spyOn` (`test/no-mocks`). Test data comes from the builders of `test/builders/`.
- Name tests after the behaviour, in the words of the business: "refuses to issue an invoice without lines", not "should throw".
- Arrange, act, assert, separated by a blank line. One behaviour per test.
- Every aggregate, value object, domain service, handler, event handler and integration event handler has a spec named after its file (`test/spec-required`).
- An `it.todo` left by the generator names a behaviour still to prove: replace it by a real test, do not delete it.
- A test never asserts on a private field; it observes results, recorded events and what the fakes received.
- `test/e2e/` (project root) drives the whole application through HTTP with generated, seeded data; it never reads the database.
- Write tests with `/ddd-ts-kit:testing`; scaffold with `npx ddd-ts-kit generate builder|e2e`.

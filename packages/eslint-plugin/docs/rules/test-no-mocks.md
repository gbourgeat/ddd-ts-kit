**English** · [Français](test-no-mocks.fr.md)

# ddd-ts-kit/test-no-mocks

Architecture id: `test/no-mocks`. Default severity: `warn` in `recommended`, `error` in `strict`.

Applies to: test files of a context (`test/**`, `*.spec.ts`, `*.test.ts`).

## Why

A mock asserts calls, not outcomes, and breaks on every refactoring. A fake is a working in-memory implementation of the port, held to the same contract suite as the real adapter.

## Reported

- `vi.mock`, `vi.doMock`, `vi.fn`, `vi.spyOn`, `vi.mocked` and their `jest` twins
- an import of `sinon`, `ts-mockito`, `jest-mock`, `jest-mock-extended`, `vitest-mock-extended`, `testdouble`, `ts-auto-mock`, `typemoq`, `moq.ts`, `@golevelup/ts-jest`, `@golevelup/ts-vitest`

Incorrect:

```ts
const save = vi.fn();
vi.mock('@/contexts/billing/infrastructure/persistence/drizzle-invoice.repository');
```

Correct:

```ts
const invoices = new FakeInvoiceRepository();
await handler.execute(command);
expect(await invoices.findById(id)).toBeDefined();
```

## Details

`vi.useFakeTimers` and `vi.setSystemTime` are not mocks of a collaborator and are allowed, although `FixedClock` is the usual way.

## Options

None.

`rules."test/no-mocks"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line test/no-mocks -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- Tests outside a context (`test/e2e`) are not judged.
- `vi` and `jest` are read under an import alias (`import { vi as mocks } from 'vitest'`) and a `const` alias; a runner passed as a parameter is not followed.

## With the CLI checker

`ddd-ts-kit check` reports the same id with regular expressions. This rule is the authority.

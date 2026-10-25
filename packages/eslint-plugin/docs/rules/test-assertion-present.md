**English** · [Français](test-assertion-present.fr.md)

# ddd-ts-kit/test-assertion-present

Architecture id: `test/assertion-present` (added by this plugin). Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: every test file of the project (`*.spec.ts`, `*.test.ts`, the `test/` of a context).

## Why

A test that asserts nothing passes whatever the code does, and raises the coverage rate while proving nothing: it is the gap `test/coverage-governed` cannot see. The kit asserts outcomes: the state of a fake, the facts recorded, the refusal by its code, the answer of a route.

## Reported

- an `it` or a `test` whose body holds no call to `expect`, to a function named `expect...` or `assert...` (`expectRefusal`, `expectProblem`, `expectStatus`, `expectSpanTree`, a helper of the project), or to the outcome of a scenario of `@ddd-ts-kit/testing` (`thenEvents`, `thenEventNames`, `thenError`, `thenState`, `thenNoEvent`)
- an `it` or a `test` with a title and no body, which Vitest counts as a todo and Jest refuses

Incorrect:

```ts
it('issues the invoice', async () => {
  await application.commandBus.execute(new IssueInvoiceCommand(holder, 'customer-1'));
});

it('refuses a second payment');
```

Correct:

```ts
it('issues the invoice and answers its identifier', async () => {
  const id = await application.commandBus.execute(new IssueInvoiceCommand(holder, 'customer-1'));

  expect(await invoiceRepository.findById(id)).toBeDefined();
});

it.todo('refuses a second payment');
```

## Details

The body is read whole, the scenario `pending(...)` wraps included, so an acceptance scenario waiting for its code is judged like any other. A helper that asserts for several tests is named `expect...` or `assert...`: the rule then sees it, and so does the reader.

## Options

None.

`rules."test/assertion-present"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line test/assertion-present -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- The rule sees that an assertion is made, not that it bears on the outcome: `expect(true).toBe(true)` passes. The review reads what is asserted.
- A `.then(...)` on a promise is not an outcome of a scenario.

## With the CLI checker

New with this plugin: the CLI checker has no equivalent, because reading a test needs a syntax tree.

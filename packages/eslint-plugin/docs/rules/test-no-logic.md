**English** · [Français](test-no-logic.fr.md)

# ddd-ts-kit/test-no-logic

Architecture id: `test/no-logic` (added by this plugin). Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: every test file of the project (`*.spec.ts`, `*.test.ts`, the `test/` of a context).

## Why

A test is read without being run: it arranges a state, acts once, asserts what is true afterwards, and fails for one reason. An `if` in a test is a second test hiding in the first, or a path the test takes without saying which; a loop asserts several cases under one title, and the report names none of them; a `try` catches what the runner would have reported with its stack. The logic a test seems to need belongs to what it uses: a builder decides how a paid invoice is built, a fake decides when the mailer fails, a helper decides what a page holds.

## Reported

Inside the body of an `it` or a `test`, the scenario `pending(...)` wraps included:

- `if`, `switch`, a ternary
- `for`, `for ... of`, `for ... in`, `while`, `do`
- `try`

Incorrect:

```ts
it('accepts every kind', () => {
  for (const kind of kinds) {
    expect(NotificationKind.create(kind).value).toBe(kind);
  }
});

it('refuses a second payment', () => {
  try {
    invoice.pay(at);
  } catch (error) {
    expect(error).toMatchObject({ code: 'INVOICE_ALREADY_PAID' });
  }
});
```

Correct:

```ts
it.each(kinds)('accepts the kind %s', (kind) => {
  expect(NotificationKind.create(kind).value).toBe(kind);
});

it('refuses a second payment', () => {
  given(anInvoice().paid())
    .when((invoice) => invoice.pay(at))
    .thenError('INVOICE_ALREADY_PAID');
});
```

## Details

The hooks (`beforeEach`, `beforeAll`) and the functions declared next to the tests are not judged: a loop that seeds a table in a hook, a helper of `test/e2e/support/` that decides, are where the logic goes. A case per row is an `it.each` whose table is the rows: the report then names each one.

## Options

None.

`rules."test/no-logic"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line test/no-logic -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- `&&`, `||` and `??` are not reported: `expect(a && b)` is a weak assertion, not a branch.
- A function called from the test and declared elsewhere may hold any logic: the rule reads the body of the test, the review reads the helper.

## With the CLI checker

New with this plugin: the CLI checker has no equivalent, because reading a test needs a syntax tree.

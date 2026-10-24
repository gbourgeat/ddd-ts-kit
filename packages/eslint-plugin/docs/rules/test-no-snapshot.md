**English** · [Français](test-no-snapshot.fr.md)

# ddd-ts-kit/test-no-snapshot

Architecture id: `test/no-snapshot` (added by this plugin). Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: every test file of the project (`*.spec.ts`, `*.test.ts`, the `test/` of a context).

## Why

A snapshot records whatever the code produced the first time, and is renewed with one flag the next time it differs: it asserts nothing a reader can check against the rule, and it fails on every field the rule does not depend on. A test states the fields that matter, built in the test, so that the reader sees the cause of the outcome.

## Reported

- `toMatchSnapshot`, `toMatchInlineSnapshot`, `toMatchFileSnapshot`
- `toThrowErrorMatchingSnapshot`, `toThrowErrorMatchingInlineSnapshot`

Incorrect:

```ts
expect(invoice.toState()).toMatchSnapshot();
expect(() => invoice.pay(at)).toThrowErrorMatchingInlineSnapshot();
```

Correct:

```ts
expect(invoice.toState()).toMatchObject({ status: 'paid', paidAt: at });

given(anInvoice().paid())
  .when((invoice) => invoice.pay(at))
  .thenError('INVOICE_ALREADY_PAID');
```

## Details

The contracts the kit generates (OpenAPI, AsyncAPI, the event catalogue) are held by `ddd-ts-kit docs --check`, which compares the generated document with the committed one: that is the one place a whole document is compared, and it is not a test.

## Options

None.

`rules."test/no-snapshot"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line test/no-snapshot -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- `toEqual` on a large object read from a fixture file is a snapshot by another name, and is not reported.

## With the CLI checker

New with this plugin: the CLI checker has no equivalent, because reading a test needs a syntax tree.

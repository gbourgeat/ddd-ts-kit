**English** · [Français](test-refusal-by-code.fr.md)

# ddd-ts-kit/test-refusal-by-code

Architecture id: `test/refusal-by-code` (added by this plugin). Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: the specs of the model and of the application, `test/unit/` of a context, the shared kernel, `test/e2e/` and `test/acceptance/` (`*.spec.ts`, `*.test.ts`). The specs of the adapters (`*.adapter.spec.ts`, `test/integration/`) and of the platform are not judged.

## Why

A refusal of the model carries a code and its facts (`INVOICE_ALREADY_PAID`, `{ invoiceId }`): the client receives them in the problem document, the catalogue of the context lists them, the reader of the test learns which rule refused. A message is prose that a rewording changes without changing the rule; the class of one error is an implementation the factories of `domain/errors/` may fold into another. A `toThrow()` without an argument accepts any failure, a `TypeError` of the test included.

## Reported

`toThrow` and `toThrowError`, after `expect(action)` or `expect(promise).rejects`, when their argument is:

- nothing
- a string, a template or a regular expression (a message)
- a class, a variable or `new Error(...)`

Incorrect:

```ts
expect(() => invoice.pay(at)).toThrow('already paid');
expect(() => invoice.pay(at)).toThrow(InvoiceAlreadyPaid);
expect(() => Email.create('  ')).toThrow();
await expect(bus.execute(command)).rejects.toThrowError(/forbidden/);
```

Correct:

```ts
given(anInvoice().paid())
  .when((invoice) => invoice.pay(at))
  .thenError('INVOICE_ALREADY_PAID', { invoiceId: 'invoice-1' });

expectRefusal(() => Email.create('  '), 'INVALID_EMAIL', { given: '  ' });

await expect(bus.execute(command)).rejects.toMatchObject({ code: 'FORBIDDEN' });

expectProblem(response, { status: 409, code: 'SLOT_TAKEN' });
```

## Details

`expect(action).not.toThrow()` says that an action is accepted and is not reported. `toThrow(expect.objectContaining({ code: 'INVOICE_ALREADY_PAID' }))` and `toThrow({ code: ... })` assert the code and are not reported either, although `thenError` and `expectRefusal` say it shorter and compare the facts.

A failure the test itself injected (`mailer.failNextWith(outage)`, a middleware that throws) is asserted as itself, `await expect(bus.execute(command)).rejects.toBe(outage)`: the proof that this failure, and not another with the same message, came through.

An adapter, the integration specs of a context and the platform face the outside system and the machine: their failures are technical (`KEYCLOAK_URL is not set`, `Keycloak answered 403`), their message is what an operator reads, and it is what their specs assert. They are not judged.

## Options

None.

`rules."test/refusal-by-code"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line test/refusal-by-code -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- A matcher of the project that compares a message (`expectFailure(action, 'message')`) is not read.

## With the CLI checker

New with this plugin: the CLI checker has no equivalent, because reading a test needs a syntax tree.

# ddd-ts-kit/events-name-format

Architecture id: `events/name-format`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: `domain/events/` and `published-language/` of a context, tests excluded.

## Why

An event name is a public address: consumers subscribe to it, the catalog lists it. `<context>.<aggregate>.<fact>` says who owns it and what happened.

## Reported

- in `domain/events/`: an `eventName` or `name` property or object key whose string is not `<this context>.<aggregate>.<fact>` in kebab-case
- in `published-language/`: the `type` given to `defineIntegrationEvent`, and any other `type` holding a dotted string

Incorrect:

```ts
export class InvoiceIssued implements DomainEvent {
  static readonly eventName = 'InvoiceIssued';

  readonly name = InvoiceIssued.eventName;
}
```

Correct:

```ts
export class InvoiceIssued implements DomainEvent {
  static readonly eventName = 'billing.invoice.issued';

  readonly name = InvoiceIssued.eventName;
}
```

## Details

Template literals without interpolation are read like strings. The name is declared once, in `eventName`, which the event carries in `name` and its reactions read (`{ name: InvoiceIssued.eventName }`); a `readonly name = '..'` written out, as before 0.6, is judged the same way.

## Options

None.

`rules."events/name-format"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line events/name-format -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- The shape and the context prefix are checked, not the grammar of the fact (past tense is checked by the generator).
- A name built at run time (`${context}.invoice.issued`) is not read.
- That an integration event is declared once, with a payload, is checked by `ddd-ts-kit check` (`events/defined-in-published-language`).

## With the CLI checker

`ddd-ts-kit check` reports the same id and owns the companion rule `events/defined-in-published-language`. This rule is the authority for the format.

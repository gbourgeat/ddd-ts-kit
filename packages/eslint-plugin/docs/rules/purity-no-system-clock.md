**English** · [Français](purity-no-system-clock.fr.md)

# ddd-ts-kit/purity-no-system-clock

Architecture id: `purity/no-system-clock`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: `domain/` and `application/` of a context, tests excluded.

## Why

A rule that reads the clock gives a different answer at every run. Time is an input: the domain receives it, the application takes it from the `Clock` port, a test fixes it with `FixedClock`.

## Reported

- `new Date()` without argument
- `Date.now`, `Date()`
- `performance.now`, `performance.timeOrigin`
- the same through `globalThis`, `window`, `self` or `global`

Incorrect:

```ts
const overdue = invoice.dueAt < new Date();
const started = Date.now();
```

Correct:

```ts
const overdue = invoice.isOverdue(this.clock.now());
const due = new Date(issuedAt.getTime() + 30 * DAY);
```

## Details

`new Date(value)` builds a date from data and is allowed.

## Options

None.

`rules."purity/no-system-clock"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line purity/no-system-clock -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- A wrapper around the forbidden access (a helper of the platform that calls `Date.now()`) is not seen here; the layer rules stop the import of that helper.
- A local declaration that shadows the global (`const process = ...`) is not reported.

## With the CLI checker

`ddd-ts-kit check` looks for the same names with regular expressions. This rule is the authority: it knows a shadowed name from the global, and code from a string.

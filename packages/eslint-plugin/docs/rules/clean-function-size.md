# ddd-ts-kit/clean-function-size

Architecture id: `clean/function-size`. Default severity: `warn` in `recommended`, `error` in `strict`.

Applies to: every linted file.

## Why

A function with more than three parameters hides a concept that has no name yet; a function longer than a screen does more than one thing.

## Reported

- more than `maxParameters` parameters (default 3); constructors are exempt, a `this` parameter is not counted
- more than `maxLines` lines of code in the body (default 30); blank lines and comment lines are not counted

Incorrect:

```ts
function charge(amount: Amount, card: Card, at: Date, retries: number): void {}
```

Correct:

```ts
function charge(payment: Payment, policy: RetryPolicy): void {}
```

## Details

The module file of a context (`<context>.module.ts`) is exempt from the line limit: a composition grows with the context. So is the callback of `describe`, `suite` and `context`: it holds tests, not steps.

## Options

`[{ "maxParameters": 3, "maxLines": 30 }]`. When an option is absent, `limits.maxParameters` and `limits.maxFunctionLines` of `ddd-ts-kit.config.json` apply, then the defaults.

`rules."clean/function-size"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line clean/function-size -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- The standard `max-params` and `max-lines-per-function` are not enabled by the presets: they cannot exempt constructors nor read the limits of the config, and would report twice.
- A nested function counts in the length of the function around it.

## With the CLI checker

`ddd-ts-kit check` approximates this rule on the text of the file and stays the fast edit-time guard. This rule is the authority.

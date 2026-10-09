# ddd-ts-kit/clean-no-escape-hatch

Architecture id: `clean/no-escape-hatch`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: every linted file.

## Why

Each escape hatch switches the compiler off for a value and for everything it touches. Foreign data enters through mappers and adapters, where an assertion is expected; anywhere else it hides a design problem.

## Reported

- `value as X` and `<X>value` outside `*.mapper.ts` and `infrastructure/**` (`as const`, `as unknown` and `satisfies` are allowed; `as unknown as X` is reported once)
- `eslint-disable`, `eslint-disable-line` and `eslint-disable-next-line` without a reason after `--`

Incorrect:

```ts
const invoice = raw as Invoice;
// eslint-disable-next-line no-console
console.log(invoice);
```

Correct:

```ts
const invoice = parseInvoice(raw);
const roles = ['admin', 'agent'] as const;
// eslint-disable-next-line no-console -- the CLI prints its result
console.log(invoice);
```

## Details

**Delegated to standard rules.** The rest of the architecture rule is held by typescript-eslint, enabled by every preset of this plugin instead of being written a second time:

| Part of `clean/no-escape-hatch` | Standard rule |
|---|---|
| explicit `any` | `@typescript-eslint/no-explicit-any` |
| non-null assertion `!` | `@typescript-eslint/no-non-null-assertion` |
| `@ts-ignore`, `@ts-nocheck`, `@ts-expect-error` without description | `@typescript-eslint/ban-ts-comment` (`ts-expect-error: allow-with-description`) |

Enabling `ddd-ts-kit/clean-no-escape-hatch` alone therefore does not report these three: use a preset, or enable the three rules next to it.

## Options

`[{ "typeAssertions": false }]` keeps only the comment check (the presets use it for tests).

`rules."clean/no-escape-hatch"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line clean/no-escape-hatch -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- A blanket `/* eslint-disable */` silences this rule too, so it cannot report it: run ESLint with `--report-unused-disable-directives` and forbid blanket disables in review.
- `any` produced by inference is the business of the type-checked `no-unsafe-*` rules of typescript-eslint.

## With the CLI checker

`ddd-ts-kit check` approximates this rule on the text of the file and stays the fast edit-time guard. This rule is the authority.

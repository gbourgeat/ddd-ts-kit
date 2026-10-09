# ddd-ts-kit/clean-no-escape-hatch

Architecture id: `clean/no-escape-hatch`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: every linted file.

## Why

Each escape hatch switches the compiler off for a value and for everything it touches. Foreign data enters through mappers and adapters, where an assertion is expected; anywhere else it hides a design problem.

## Reported

- `value as X` and `<X>value` outside `*.mapper.ts`, `infrastructure/**` of a context and the files matched by `adapterGlobs` (`as const`, `as unknown` and `satisfies` are allowed; `as unknown as X` is reported once)
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

| Option | Default | Meaning |
|---|---|---|
| `typeAssertions` | `true` | `false` keeps only the comment check (the presets use it for tests) |
| `adapterGlobs` | `[]` | other places where foreign data enters, where an assertion is expected |
| `allowCallerClaimedGenerics` | `false` | lets `value as T` through when the caller chose `T` |

**`adapterGlobs`.** The exemption for adapters is read from the path: `*.mapper.ts` anywhere, and `infrastructure/` of a context. A project that keeps adapters elsewhere (the platform, a package of a monorepo) declares them:

```js
'ddd-ts-kit/clean-no-escape-hatch': ['error', { adapterGlobs: ['src/platform/database/**', 'packages/*/src/postgres/**'] }]
```

Globs are posix paths relative to the project root (the directory of `ddd-ts-kit.config.json`, else the working directory): `**` crosses directories, `*` stays inside one, `?` is one character. Nothing changes inside a context.

**`allowCallerClaimedGenerics`.** A function such as `get<Body>(path): Promise<Body>` cannot know `Body`: the caller claims it. With the option, `value as T` is accepted when `T` is exactly a type parameter of the function or method around it and that parameter appears in its declared return type.

```ts
async get<Body>(path: string): Promise<Body> {
  return (await this.read(path)) as Body; // accepted with the option
}
```

The trade-off: nothing checks the claim. `client.get<Invoice>('/x')` is an assertion written by the caller, in any layer, that no rule sees any more. Keep the option off where a schema can parse the value, and turn it on for the few transport helpers whose callers validate what they receive. `value as T[]`, a type parameter of a class and a function that does not return `T` stay reported.

`rules."clean/no-escape-hatch"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line clean/no-escape-hatch -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- A blanket `/* eslint-disable */` silences this rule too, so it cannot report it: `governance/recorded-deviation` does.
- `any` produced by inference is the business of the type-checked `no-unsafe-*` rules of typescript-eslint.

## With the CLI checker

`ddd-ts-kit check` approximates this rule on the text of the file and stays the fast edit-time guard. This rule is the authority.

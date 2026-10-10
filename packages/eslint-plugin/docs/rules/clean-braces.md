# clean/braces (layout)

Architecture id: `clean/braces`. Default severity: `error` in `recommended`, `error` in `strict`. Fixable with `--fix`.

Applies to: every linted TypeScript file, and in `dddTsKit()` every linted `.js`, `.mjs` and `.cjs` file.

Not a rule of this plugin: `curly` of ESLint holds it, configured by the presets and exported as `standardRules.braces`.

## Why

A branch written between braces, its body on its own lines, is visible at a glance, and a statement added to it later cannot silently fall outside it.

## Reported

- an `if`, an `else`, a `for`, a `for..of`, a `for..in`, a `while` or a `do` whose body is not a block

Incorrect:

```ts
if (wrapped.has(repository)) return repository;

for (const step of steps) await step();
```

Correct:

```ts
if (wrapped.has(repository)) {
  return repository;
}

for (const step of steps) {
  await step();
}
```

## Details

```js
curly: [level, 'all'],
```

Not judged: a ternary, an arrow function returning an expression, `??` and `&&` expressions, a one-line object literal. An `else if` chain stays `} else if (...) {` on the line of the closing brace.

`curly` adds the braces; where they go is the work of the formatter ([`clean/formatted`](clean-formatted.md)), which always breaks a block that holds a statement: `if (a) { return b; }` on one line does not survive `npm run format`, and `npm run format:check` refuses it. That is why `@stylistic/brace-style` is not enabled: it would only repeat what the formatter decides.

In a config composed by hand:

```js
import { standardRules } from '@ddd-ts-kit/eslint-plugin';

export default [{ files: ['**/*.ts'], rules: standardRules.braces }];
```

## Options

None. `rules."clean/braces"` in `ddd-ts-kit.config.json` gives `curly` its severity in `dddTsKit()`: `error` (default), `warn`, or `off`, which leaves it out. The `ddd-ts-kit-disable-next-line` comment does not reach it: it is not a rule of this plugin.

## With the CLI checker

`ddd-ts-kit check` holds the same thing on text, as an approximation: a body without braces, a body on the line of its braces, an `else` on a line of its own. This rule and the formatter are the authority.

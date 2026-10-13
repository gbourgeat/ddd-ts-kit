**English** · [Français](clean-blank-lines.fr.md)

# clean/blank-lines (layout)

Architecture id: `clean/blank-lines`. Default severity: `error` in `recommended`, `error` in `strict`. Fixable with `--fix`.

Applies to: every linted TypeScript file.

Not a rule of this plugin: two rules of [`@stylistic/eslint-plugin`](https://eslint.style) hold it, configured by the presets and exported as `standardRules.layout`.

## Why

A function reads as paragraphs: what it declares, what it decides, what it answers. A blank line before every `return` and between the logical blocks makes those paragraphs visible, and makes a block that has grown too many of them look like what it is, a function to split.

## Reported

- a `return` that is not alone in its block and has no blank line before it
- no blank line after a group of declarations (`const`, `let`), or around an `if`, a `for`, a `while`, a `do`, a `try`, a `switch` or a block
- no blank line around a statement or a declaration written on several lines
- no blank line before or after a method of a class

Incorrect:

```ts
function total(lines: readonly Line[]): number {
  const amounts = lines.map((line) => line.amount);
  if (amounts.length === 0) {
    return 0;
  }
  return amounts.reduce((sum, amount) => sum + amount, 0);
}
```

Correct:

```ts
function total(lines: readonly Line[]): number {
  const amounts = lines.map((line) => line.amount);

  if (amounts.length === 0) {
    return 0;
  }

  return amounts.reduce((sum, amount) => sum + amount, 0);
}
```

## Details

What may stay together: consecutive one-line declarations; consecutive `case` labels; consecutive fields of a class, and consecutive abstract signatures of a port; the overloads of a method.

```js
'@stylistic/padding-line-between-statements': [level,
  { blankLine: 'always', prev: '*', next: 'return' },
  { blankLine: 'always', prev: ['const', 'let', 'var'], next: '*' },
  { blankLine: 'any', prev: ['const', 'let', 'var'], next: ['const', 'let', 'var'] },
  { blankLine: 'always', prev: '*', next: ['if', 'for', 'while', 'do', 'try', 'switch', 'block-like'] },
  { blankLine: 'always', prev: ['if', 'for', 'while', 'do', 'try', 'switch', 'block-like'], next: '*' },
  { blankLine: 'always', prev: '*', next: ['multiline-const', 'multiline-let', 'multiline-var', 'multiline-expression'] },
  { blankLine: 'always', prev: ['multiline-const', 'multiline-let', 'multiline-var', 'multiline-expression'], next: '*' },
  { blankLine: 'any', prev: ['case', 'default'], next: ['case', 'default'] },
],
'@stylistic/lines-between-class-members': [level, { enforce: [
  { blankLine: 'always', prev: '*', next: 'method' },
  { blankLine: 'always', prev: 'method', next: '*' },
] }, { exceptAfterOverload: true }],
```

`dddTsKit()` and the two presets register the plugin under `@stylistic` and enable the two rules. A blank line right after `{` or right before `}`, two blank lines in a row and a blank line at an end of a file are removed by the formatter ([`clean/formatted`](clean-formatted.md)), not reported here. In a config composed by hand:

```js
import stylistic from '@stylistic/eslint-plugin';
import { standardRules } from '@ddd-ts-kit/eslint-plugin';

export default [{ files: ['**/*.ts'], plugins: { '@stylistic': stylistic }, rules: standardRules.layout }];
```

## Options

None. `rules."clean/blank-lines"` in `ddd-ts-kit.config.json` gives the two rules their severity in `dddTsKit()`: `error` (default), `warn`, or `off`, which leaves them out. The `ddd-ts-kit-disable-next-line` comment does not reach these rules: they are not rules of this plugin, and both are fixed by `eslint --fix --fix-type layout`.

## Limits

- The rules judge blank lines, not line breaks, indentation or line length: the formatter of the project does, and keeps the blank lines it finds.
- A blank line required on both sides of a multiline statement applies inside a group of declarations too: a `const` written on several lines is set apart from the one-line `const` around it.

## With the CLI checker

`ddd-ts-kit check` holds the cheap part only, as an approximation: a `return` glued to the statement above it, and a padded block of statements. It leaves the braces that hold no statement alone: an object literal, a type literal, an interface, an enum, a destructuring pattern, a list of imports or exports. These rules are the authority.

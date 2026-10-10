# ddd-ts-kit/clean-function-ceiling

Architecture id: `clean/function-size`. Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: every linted file, tests and module files included.

## Why

`clean/function-size` asks for short functions with a limit a project may tune, and leaves `describe` callbacks and module files alone. This rule is the part that is not negotiable: past 100 lines of code a function is a file in disguise, whatever it is, and a test suite of that length tests more than one thing. ESLint gives one severity to a rule name, so the ceiling is a rule of its own: an `error` while `clean-function-size` stays a `warn`.

## Reported

- a function, a method or an arrow function whose body holds more than 100 lines of code, the callbacks of `describe`, `suite` and `context` and the functions of `<context>.module.ts` included

Incorrect:

```ts
describe('an invoice', () => {
  // 140 lines of tests about issuing, paying and voiding
});
```

Correct:

```ts
describe('an invoice being issued', () => {
  // the tests about issuing
});

describe('an invoice being paid', () => {
  // the tests about paying
});
```

## Details

Lines of code are counted as `clean-function-size` counts them: the lines of the body that carry at least one token; blank lines and comment lines are not counted. A nested function counts in the length of the function around it.

The same number caps the configurable limit: `limits.maxFunctionLines` of `ddd-ts-kit.config.json` and the option `maxLines` of `clean-function-size` are read as 100 when they are higher.

## Options

None.

`rules."clean/function-size"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line clean/function-size -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- The rule cannot be lowered to a warning from `ddd-ts-kit.config.json`: only `off` reaches it, with `clean/function-size` as a whole.

## With the CLI checker

`ddd-ts-kit check` reports the ceiling under `clean/function-size` with the severity `error`, on the text of the file: methods, function declarations at any depth, function expressions and arrow functions, a class property arrow and a callback of `describe` or `it` included. It does not read the methods of an object literal, and counts a template literal written on several lines as one line. This rule is the authority.

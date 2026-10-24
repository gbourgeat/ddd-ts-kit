**English** · [Français](test-no-only-no-skip.fr.md)

# ddd-ts-kit/test-no-only-no-skip

Architecture id: `test/no-only-no-skip` (added by this plugin). Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: every test file of the project (`*.spec.ts`, `*.test.ts`, the `test/` of a context).

## Why

A test left aside makes the run green while something is not proven. `.only` was written to debug one test and forgotten: the others no longer run. `.skip` keeps a test in the file while nothing holds it, and the day it would have failed nobody is told; `.skipIf(true)` and `.runIf(false)` are the same thing with a condition that never changes. The kit names what is not proven yet instead: an `it.todo` with the behaviour as its title, which `ddd-ts-kit todo` lists and `story --gate close` refuses while one belongs to the story.

## Reported

- `it.only`, `test.only`, `describe.only`, alone or after another modifier (`it.concurrent.only`)
- `it.skip`, `test.skip`, `describe.skip`
- `it.skipIf`, `it.runIf`, `describe.skipIf`, `describe.runIf` on a constant (`true`, `false`, a string) or on nothing
- `fit`, `xit`, `xtest`, `fdescribe`, `xdescribe`

Incorrect:

```ts
it.only('refuses to pay an invoice twice', () => { ... });
describe.skip('Invoice', () => { ... });
it.skipIf(true)('records the payment', () => { ... });
```

Correct:

```ts
it('refuses to pay an invoice twice', () => { ... });
it.todo('refuses to pay an invoice whose customer is closed');
describe.runIf(process.env['VARNISH_URL'] !== undefined)('through Varnish', () => { ... });
```

## Details

`it.todo`, `it.each`, `it.concurrent` and `it.sequential` are not reported: they run, or they name what is to be written. `skipIf` and `runIf` on an expression are not reported either: they say where a test runs, as the tests through an HTTP cache run where the pipeline starts one; the test is then run there, not left aside. A test that is wrong for good is deleted, with the reason in the commit.

The rule reads `it`, `test` and `describe` of the runner, imported from `vitest` or `@jest/globals` or global; a local of the same name is not judged.

## Options

None.

`rules."test/no-only-no-skip"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line test/no-only-no-skip -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## Limits

- A runner function renamed (`const only = it.only`) or taken from `it.extend(...)` is not followed.
- A condition that is constant without being a literal (`const NEVER = false; it.skipIf(!NEVER)`) is read as a condition.

## With the CLI checker

New with this plugin: the CLI checker has no equivalent, because reading a test needs a syntax tree.

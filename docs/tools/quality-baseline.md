# Quality baseline

**Summary.** Every project the CLI generates, the example application and the kit itself carry
the same small set of tools, each answering one question, each behind one npm script. None is
optional and none overlaps another: the type checker does not lint, the linter does not format,
the formatter does not lint. This page lists them with their commands; the comparison of the
architecture analyzers is in [Static analysis and the pipeline](static-analysis-and-pipeline.md).

## What each tool answers

| Tool | The question it answers | Script | Settles it |
|---|---|---|---|
| TypeScript, `strict` | is it sound: does every value have the type the code says | `npm run typecheck` | the compiler error |
| ESLint with `@ddd-ts-kit/eslint-plugin` | is it idiomatic and within the rules: layers, purity, clean code, braces, blank lines | `npm run lint` | `npm run lint:fix` for what is fixable |
| Biome, as a formatter only | is it laid out the one way: line width 120, quotes, commas, line breaks | `npm run format:check` | `npm run format` |
| knip | is anything dead: a file, an export, a dependency nobody uses | `npm run deadcode` | removing it |
| dependency-cruiser | does the import graph respect the boundaries, through barrels and re-exports | `npm run depcruise` | moving the import |
| `ddd-ts-kit check` | is the architecture intact: the tree, the names, the glossary, the rules of the reference | `npm run check:arch` | the `fix` sentence of each finding |
| the test runner | does it work | `npm test`, `npm run test:e2e` | the code |

`npm run verify` chains them all, in that spirit: types, lint, format, tests, architecture,
graph, dead code, generated documents. The pipeline runs the same scripts under their `ci:*`
names, on GitHub Actions and on GitLab CI.

## When each one runs

| Moment | What runs |
|---|---|
| at every file write by a coding agent | `ddd-ts-kit check` on the file (the editor hook of the plugin) |
| before a commit (lefthook, staged files) | ESLint, the format check, `ddd-ts-kit check`, the commit size |
| before a push | the type check and the unit tests |
| in the pipeline | everything, as separate jobs; the format check runs in the lint job |

## The formatter

Biome is used for one thing: `biome.json`, written by `ddd-ts-kit init`, enables its formatter
and switches its linter and its import organiser off. ESLint stays the only linter, and no
import is ever reordered by a tool. The settings are the same in the kit, in the example and
in every generated project: line width 120, two spaces, LF, single quotes, trailing commas,
semicolons, parentheses around the parameter of an arrow function.

- Formatted: `.ts`, `.mts`, `.cts`, `.js`, `.mjs`, `.cjs`, `.json`, `.jsonc`.
- Not formatted: Markdown (a formatter would rewrap tables and prose) and YAML.
- Left out in `biome.json`: build outputs, the lockfile, a `generated` directory, and the
  artifacts their own check compares byte for byte (`openapi/*.json`, `asyncapi.json`,
  `.dependency-cruiser.cjs`).

What the CLI writes is already formatted: `npm run format:check` passes right after `init` and
after every `generate`, and the end-to-end suite of the CLI holds that for every stack it
builds. The generator has no formatter of its own: the templates are written the way the
formatter prints them, with layouts that do not depend on the length of a name where that is
possible, so a very long name can still leave one line for `npm run format` to wrap.

ESLint and the formatter never fight, because they decide different things. The presets of the
plugin enable no rule about where a token goes; they keep the two things a formatter does not
decide: the blank lines between statements (`clean/blank-lines`) and the braces of a branch
(`clean/braces`). Run in either order, the second tool finds nothing to change.

## One configuration, three places

`biome.json` at the root of the kit is the source. The template the CLI copies into a project
is compared with it byte for byte by a test of the CLI, and the example application extends it
instead of copying it, so the three cannot drift.

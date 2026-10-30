**English** · [Français](0001-lines-left-out-of-the-coverage-measure.fr.md)

# ADR-0001: lines left out of the coverage measure

## Decision

Every line of the sources of the packages runs under the unit specs, and `vitest.config.ts` holds it at 100 percent of lines for each package. The checks below are left out of that measure by a comment that cites this record, and nothing else is. A line of the measure means a line a spec ran: it says nothing of the branches, which keep their own floors.

## Why these

Each check guards a state its callers cannot produce. Removing it would leave the type unnarrowed or the code unprotected. Writing a spec for it would hand the function a state that does not exist, which only satisfies the counter. Moving it onto a line that already runs, in a ternary or a default, would keep the same case in the code and hide it from the measure, so it is refused.

| Check | Why nothing reaches it |
| --- | --- |
| `http`, `json-forms-of.ts`, a field without a node | A field is named after a property of this schema, and `assertHints` refuses a dot in a name. |
| `knex`, `knex-outbox-store.ts`, a row that is no object | A sum without `GROUP BY` always answers one row. |
| `redis`, `publications.ts`, an entry id that is no text | An `XADD` answers an entry id or an error, and the error is read just before. |
| `testing`, `decorator-compiler.ts`, a failure that is no object | The only caller catches what `execFileSync` throws, always an `Error`. |
| `tracing`, `span-context-from-traceparent.ts`, a missing group | The three groups are mandatory in the expression that matched. |
| `cli`, `clean-one-export-per-file.ts`, no second export | `judgeExports` explains a lone export, so there are at least two here. |
| `cli`, `timeline-of.ts`, an empty list of commits | This runs once a report commit was found, so neither list is empty. |
| `cli`, `format-progress.ts`, a row without a `ready` value | `statusRowOf` gives each row that is not done a `ready` value. |
| `cli`, `forecast-merge.ts`, an error that is no `CliError` | Only a conflicted blob too large for a string gets here, over 512 MiB: a spec cannot afford one. |
| `cli`, `tree-at.ts`, a reader that fails with no `CliError` | A reader refuses with a `CliError`: what is left is a fault of the kit, or a source too large for a string. |
| `cli`, `tree-at.ts`, a config that fails with no `CliError` | `readConfig` refuses with a `CliError`: what is left is a fault of the kit. |
| `eslint-plugin`, `pattern-identifiers.ts`, another kind of target | The parser refuses a member expression in a declaration or a parameter. |
| `eslint-plugin`, `returns-package-type.ts`, `this` as a name | `this` stands in an entity name only under `typeof`, never in a type reference. |

The two entry points of the CLI, `bin.ts` and `refresh-declarations.ts`, are left out in `vitest.config.ts`: each is one call that runs as a process, which the end-to-end specs run from the built package.

## When to remove one

A comment goes as soon as a narrower type makes its check impossible to write, or a change makes the state reachable: the check then gets a spec. A new line left out comes with a row in this table, in the same pull request.

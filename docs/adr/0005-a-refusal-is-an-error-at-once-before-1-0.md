**English** · [Français](0005-a-refusal-is-an-error-at-once-before-1-0.fr.md)

# ADR-0005: before 1.0 a refusal is an error at once, and a break ships with its way through

## Decision

Before 1.0:

- A breaking change ships with a `To move:` line in its file of `changes/` and with no transition, alias or shim for the old form. The kit keeps no second spelling alive.
- A rule that prevents a defect is an error at once. A new rule takes `error` as its default (nothing in `default-severities.ts` for `ddd-ts-kit check`, `recommended: 'error'` for the ESLint rule), and so does what a rule judges more. There is no warning first and no version in which it becomes an error later. A rule is `warn` only when what it reports may be right and a reader settles it (`privacy/*`, which reads names, or `tree/documented-paths`).
- A layout or a form an earlier version wrote is reported the same way, as an error, with the command that moves it (`ddd-ts-kit context-layout`, `ddd-ts-kit docs`). The kit reads the old form only so that this command can move it.

Where it is already written: the rule part is in `CONTRIBUTING.md` (the item that opens "Before 1.0, a rule that prevents a problem is an error at once"), and the format of the file of `changes/` with its `To move:` line is in `changes/README.md`. `docs/ARCHITECTURE.md` states the rule ids and says nothing of this policy. The part on breaking changes without transition, alias or shim is stated nowhere else: this record is where it is.

## Why

A rule left a warning to soften an upgrade is one that a project learns to ignore, and a warning that was meant to become an error never gets read as one. An error with the command to fix it costs a project one run. A transition that keeps the old form costs every later reader both forms, and the kit tests, documents and generates twice what it means once.

While the API is not frozen, the people who pay for a break are few and the `To move:` line tells them what to do. After 1.0 that trade is no longer the maintainer's to make alone, which is when a deprecation cycle would be needed.

## What it costs

An upgrade can fail a project on its first run, in a rule it did not know. Every breaking change needs a written `To move:` line, and `ddd-ts-kit check --rule <id>` to list the files to take up when a rule is the cause.

## What would reverse it

The release of 1.0. From then on a refusal that touches a published form goes through a warning and a version, and an alias lives for a stated period. This record would then be replaced by the policy of that release.

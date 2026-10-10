# Commit and pull request discipline

**Summary.** A commit carries one use case or one concept, together with everything that was
generated from it; a pull request carries one reviewable idea and stays small enough to be read
in one sitting. This guide gives the unit of a commit, the rule for generated files, the
message format, target sizes with the reasons behind them (review quality, bisectability,
revertability), ways to split a change that grew, and an exact list of what the kit's hooks
and pipeline enforce, and what they leave to people.

## The unit: one use case or one concept

The architecture already cuts work into units that make good commits:

| Unit | What the commit contains |
|---|---|
| one concept of the domain | a value object or an aggregate method, its spec, its builder change, the glossary term |
| one use case | the command or query, its handler, the domain behaviour it needs, specs, the route, the regenerated OpenAPI document |
| one contract | an integration event declaration, its publisher, the regenerated catalog and AsyncAPI document |
| one consumer | an integration event handler, its spec, the regenerated lists |
| one adapter | the adapter, its integration spec, the contract suite call for it and for the fake |
| one decision | an ADR, and the config entry or suppression it justifies |
| one structural change | a rename or a move, with no behaviour change at all |

Two things never share a commit: a structural change and a behavioural one. A rename that
touches forty files is trivial to review alone and impossible to review when a rule change
hides inside it.

Each commit should leave the project in a state where `npm run verify` passes. That is what
makes the history usable by `git bisect` and makes any single commit revertable.

## Generated files travel with what generated them

Several files are outputs of the sources and are committed: `openapi/openapi.json`,
`docs/integration/asyncapi.json`, `docs/integration/event-catalog.md`, `docs/context-map.md`
and the generated lists of each `CONTEXT.md`, the barrel `<context>.declarations.ts`,
`.dependency-cruiser.cjs`.

The rule: **the regenerated file is in the same commit as the change that caused it.**

- A route added without its OpenAPI diff fails the drift gate in CI.
- A reviewer reads the generated diff as a summary: the catalog diff says in ten lines what
  the event change means for consumers.
- A commit "regenerate docs" that follows three feature commits makes those three commits
  individually red, which breaks bisection.

In a review, generated diffs are read, not line-commented: if the output is wrong, the source
or the generator is wrong. They are never edited by hand, and the plugin's hook refuses such
an edit for the three generated contracts.

## Messages: conventional commits

```
<type>(<scope>): <summary>

<body: why, not what>
```

- **type**: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `build`, `ci` (the
  conventional set).
- **scope**: the bounded context, or `platform`, `pipeline`, `docs`. It tells which owner
  reviews.
- **summary**: imperative, in the ubiquitous language: `feat(appointments): refuse to book a
  slot that is already taken`, not `feat: add check in handler`.
- **body**: the reason, the rule encoded and where, what was deliberately left out. The diff
  already says what changed.
- **breaking changes**: a `!` after the scope and a `BREAKING CHANGE:` footer, for a route or
  an event whose contract breaks.

Examples:

```
feat(appointments): publish appointments.appointment.cancelled v1

docs(calendars): add TimeOff to the glossary

refactor(appointments): rename Booking to Appointment

fix(notifications): send one reminder when the event is redelivered
```

With squash merges the pull request title becomes the commit on the default branch, so the
title follows the same format and the pipeline checks it with the same configuration.

## Target sizes, and why

These are targets to steer by, not limits a tool enforces. The plugin has its own advisory
threshold, a little above them: its hook says so once, without blocking, when the uncommitted
work goes past 20 files or 600 changed lines, generated files not counted (the defaults in
`plugin/hooks/guard.mjs` on 2026-10-10; the skill `commit-discipline` names a `commit` key of
the config to change them, which `docs/CONFIG.md` did not document on that day).

| Measure | Target | Past this, expect |
|---|---|---|
| lines changed by hand in a pull request | up to about 400 | reviewers skim instead of reading |
| files changed by hand | up to about 15 | the change holds more than one idea |
| use cases per pull request | 1 | a failure in one blocks the merge of the other |
| contexts touched by hand | 1 | two owners, two reviews, a coupled deployment |
| age of a branch | 1 to 2 days | conflicts in the aggregate and in every generated file |

Generated files are excluded from the counts: a 600-line OpenAPI diff caused by a 40-line
route is a 40-line change.

**Review quality.** The best-known measurements come from a study of code review at Cisco
published by SmartBear: defect detection fell off sharply once a review exceeded a few hundred
lines, and reviewers were most effective below roughly 200 to 400 lines and within about an
hour. Google's engineering practices give no number but the same direction: a change should be
one self-contained thing, and about 100 lines is called a usually reasonable size while 1000 is
usually too large. Treat the figures as orders of magnitude; the mechanism is not in doubt:
attention is finite, and a reviewer who cannot hold the change in mind approves it.

**Bisectability.** `git bisect` finds the commit that introduced a fault in a number of steps
logarithmic in the history. Its answer is useful only if that commit is small and builds.
Finding "the fault is somewhere in this 3000-line commit" is not an answer.

**Revertability.** A small commit with one purpose can be reverted in production without
taking unrelated work with it. A use case and its regenerated contract revert together
precisely because they were committed together.

**Merge conflicts.** They grow with the lifetime and the breadth of a branch, and the shared
files of this architecture (see [Parallel work](parallel-work.md)) make long branches
especially costly.

**Agent sessions.** A small, scoped task also bounds what a coding agent must read and what it
can break; see [Token economy](token-economy.md).

## Splitting a change that grew

It happens: a use case turned out to need a new value object, a port, a contract change. Split
before review, not after.

1. **Extract the refactoring.** If the feature needed a rename or a move first, that goes in
   its own commit, ahead of the feature: "make the change easy, then make the easy change"
   (Kent Beck).
2. **Extract the contract.** A new or changed integration event or route definition is its own
   pull request, merged first; see "Contracts first" in [Team workflow](team-workflow.md).
3. **Cut along the layers only from the inside out.** Domain concept with its spec first
   (useful and green alone), then the use case that uses it. Never the handler before the
   domain behaviour it calls.
4. **Cut along use cases.** `RescheduleAppointment` and `CancelAppointment` written together
   are two pull requests.
5. **Stack them.** When the second depends on the first, open it on top of the first and say
   so; merge in order.

The mechanics with git: `git add -p` to stage part of a file, `git reset --soft` to the base
and recommit in pieces for a branch nobody else uses, or `git rebase -i` locally. Never
rewrite a branch somebody else has pulled; add commits instead.

After any split, run the gate on each piece: a commit that only builds together with the next
one is not split, just cut.

## What the hooks and the pipeline enforce

Stated exactly, from [pipeline/README.md](../../pipeline/README.md) and the plugin:

| Moment | What runs | Enforces |
|---|---|---|
| every file write in an agent session | the plugin's hook | refuses a hand-written file where a generator exists and an edit of a generated contract; asks the owner before a suppression, a skipped test or a change of the governed files; returns the violations of the written file; refuses to finish while architecture errors remain |
| `pre-commit` (lefthook) | ESLint on staged sources; `ddd-ts-kit check` on staged sources under `src/` | code rules and structure on what is being committed |
| `commit-msg` (lefthook) | commitlint | the conventional commit format |
| `pre-push` (lefthook) | type check and unit tests | the project compiles and its fast tests pass |
| pull request | the title check | the title is a conventional commit |
| CI | type check, lint, architecture, dead code, tests, documentation and contract drift, security, build, image, then the single `gate` job | everything, including stale generated files |

The hooks are installed once per clone (`npm run hooks:install`). The plugin's hook fails open
by design: a broken guard never blocks work, so it is a convenience and CI is the authority.

**Not enforced by any tool:** the size of a commit or a pull request (the plugin's hook only
advises, and only inside an agent session), one use case per commit,
generated files being in the *same* commit as their cause (the gate checks the final state of
the branch, not each commit), the quality of a message beyond its format, and whether each
intermediate commit builds. These are held by review and by habit. If per-commit greenness
matters to you, squash-merge: then the only commit that reaches the default branch is the one
the gate checked.

## Limits and when not to use it

- **Small pull requests need fast review.** If a review takes two days, ten small pull
  requests take longer than one large one, and people respond by batching. Fix the review
  latency first.
- **Stacked pull requests are awkward** on platforms without native support: a change
  requested in the first ripples through the others.
- **Some changes are atomic and large**: a dependency major upgrade, a mechanical rename, a
  migration of every repository adapter. Keep them pure (nothing else in the commit) rather
  than small.
- **Squash merging trades history for cleanliness.** It guarantees a green, titled commit per
  pull request and loses the intermediate steps; a team that bisects inside pull requests
  should merge without squashing and keep every commit green itself.
- **The size targets are heuristics.** The cited study is one company's data from the 2000s;
  the direction is well supported, the exact thresholds are not laws.

## Sources

- Conventional Commits 1.0.0, https://www.conventionalcommits.org/en/v1.0.0/
- SmartBear, "Best Practices for Peer Code Review" (reporting the Cisco study, Jason Cohen,
  2006), https://smartbear.com/learn/code-review/best-practices-for-peer-code-review/
- Google Engineering Practices, "Small CLs",
  https://google.github.io/eng-practices/review/developer/small-cls.html
- Git documentation, `git-bisect`, https://git-scm.com/docs/git-bisect
- Kent Beck, on making the change easy before making the easy change (2012).
- This repository: [pipeline/README.md](../../pipeline/README.md), the root README section on
  the hook.

## See also

- [Team workflow](team-workflow.md)
- [Parallel work](parallel-work.md)
- [Static analysis and pipeline](../tools/static-analysis-and-pipeline.md)
- [Event versioning](../concepts/event-versioning.md)
- [Architecture reference](../ARCHITECTURE.md)

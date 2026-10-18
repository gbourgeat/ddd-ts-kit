**English** · [Français](story-workflow.fr.md)

# Story workflow: one session per user story

**Summary.** A user story crosses contexts; a session of a coding agent can take it from its
statement to a green pull request on its own, as long as the questions come first and the code
comes last. `/ddd-ts-kit:story <code>` does that in its own git worktree: it asks the owner
every question at once, then writes the story file and its acceptance criteria, the rows of the
story, a design review of each row and the acceptance tests, locked, before any code; it builds
row by row with one agent confined to one context, reviews, verifies, opens the pull request and
reports every decision it took without the owner. Several terminals take several stories at
once. The guard of the plugin holds the order: no code before the design and the acceptance.

## When to use it

- A project is bootstrapped and its contexts exist (steps 1 to 5 of the
  [methodology](methodology.md)); the story fits them, or the questions of phase 1 say it does
  not.
- One story at a time per session. To build several contexts of one plan at once instead, see
  [parallel work](parallel-work.md); the story workflow reuses its worktrees, its briefings and
  its merge rules.

```text
terminal 1: /ddd-ts-kit:story US5 "A customer places an order and is invoiced"
terminal 2: /ddd-ts-kit:story US6 docs/backlog/us6.md
```

## The phases

| # | Phase | Artefact | Who decides |
|---|---|---|---|
| 0 | its worktree: `npx ddd-ts-kit story-scope US5` | `.worktrees/us5` on `story/us5`, `.ddd-ts-kit/story.json` | |
| 1 | every question, at once | `## Questions` of `docs/architecture/stories/US5.md` | the owner, once |
| 2 | specification and rows | `## Acceptance criteria` (`- AC1: ...`), the rows `US5.01`, ... of `slices.md` | the session |
| 3 | a design review of each row | `docs/architecture/reviews/US5.md`, one `## #US5.02 ...` section per row, read by `architecture-reviewer` | the session |
| 4 | the acceptance, before any code | `test/acceptance/us5.acceptance.spec.ts` and its lock | the session |
| 5 | the build gate: `npx ddd-ts-kit story US5 --gate build` | the guard opens the code of the contexts | |
| 6 | build, row by row | one commit per row, one `context-builder` agent per slice row | the session |
| 7 | close: trunk merged in, review, `npm run verify`, `acceptance US5 --gate passing` | a green branch | |
| 8 | the report, then the pull request | `## Report`, the body of the pull request | the owner, at the review |

`npx ddd-ts-kit story US5` prints the phases with what each one holds and the next step; a
session that starts in the worktree of a story is told the same by the guard.

## Questions first, then provisional decisions

Phase 1 lists every question whose answer changes an artefact: a business rule the session would
have to guess, who holds a permission, a missing term, a criterion that cannot be observed, a
boundary. They are asked in one batch, each with a recommended option. From then on the session
does not stop to ask: it takes the option easiest to undo, records it as `D1 (provisional)`
with its reason, its alternatives and where it lives in the code, and goes on. The report puts
each one back to the owner. A boundary, a new context or a relationship pattern is never
decided this way: asked in phase 1, or, when it appears later and nothing reversible exists, the
one reason to stop, with a report that says so.

## The design before the code

Each row gets a section of the design review before anything is generated: the aggregate and
its invariants, the command or query and its permission, the events, the errors by business
name, the route, the ports, the contract read from another context. The `architecture-reviewer`
agent reads it as a design review of rows still to build; its blocking findings change the
design. `npx ddd-ts-kit cited --rows <ids>` lists the names the design cites that the trunk
replaced in the meantime. `worker-scope` names the section of a row in the briefing of its agent.

## The acceptance before the code, and locked

The acceptance criteria become scenarios through the API, one or more per criterion, in
`test/acceptance/us5.acceptance.spec.ts`, each named after its rows and its criterion
(`'#US5.02 AC1 ...'`) and wrapped in `pending(...)` until its rows are built. They are run
once to see each fail on an assertion, then locked: `npx ddd-ts-kit acceptance US5 --lock`. A
locked scenario changes only with its criterion. A criterion changed after the lock, or a
scenario that did not match its criterion, is judged before it is locked again, by the
`acceptance-judge` agent, which did not make the change: it compares the locked version, the
new one, the criterion and the owner's answers, and writes a verdict for that very version.
Each verdict is an amendment the report lists for the owner to validate. No agent makes a test
pass by rewriting it: the guard lets a sub-agent only remove `pending(...)`, and only the judge
writes a verdict. See [testing strategy](../concepts/testing-strategy.md) and
`ddd-ts-kit acceptance` in the [commands](commands.md).

## Agents confined to one context, one after the other

A story crosses contexts, a worker does not. Each slice row is built by one `context-builder`
agent, briefed with `npx ddd-ts-kit worker-scope <context> --here --rows <id>` in the worktree
of the story: the guard confines it to that context, and its blocking needs (a contract field,
a dependency, a grant, a migration) come back to the session, which does them on the branch.
The agents run one after the other in the one worktree: the rows of a story mostly depend on
each other (contract, producer, consumer), and the parallelism is between stories, one per
terminal.

## Several stories, several terminals

`story-scope` refuses a story already open in another worktree, and cuts the branch from the one
the trunk follows (`origin/main` for `main`), so that a `git fetch` is enough to see the trunk
move. `npx ddd-ts-kit stories` says, from any worktree, where the open stories meet while they
are built: the contexts the rows of two of them name, the files both worktrees change
(committed or not), what merging the branch of one into the other would leave to settle by hand
and what `merge-trunk` settles alone (computed with `git merge-tree`, nothing written), and how
far each story is behind its trunk. The session reads it before cutting its rows and before
each row; the guard says it at session start, and once per file when the session writes a file
another story changes. The session keeps its rows off what another story changes when it can,
otherwise records which one lands first. Each branch brings the trunk in before its pull
request with `npx ddd-ts-kit merge-trunk --trunk <base>`: the files shared by construction
(generated documents, registries, migrations, `slices.md`) merge as [parallel work](parallel-work.md)
says, the rest is left to the session; the second story to land settles the conflict the two
share. The pull requests merge one after the other, each on a green trunk.

## What holds the order

| What | Enforced by |
|---|---|
| no code of a context before each row is designed and the acceptance written and locked | the guard, in the worktree of a story (`story --gate build`, read once per change of its inputs) |
| a locked scenario changed while its criterion was not, or a criterion changed | `ddd-ts-kit acceptance` and `--lock`, until a verdict of the `acceptance-judge` agent; the guard, which lets only the judge write a verdict |
| an agent outside its context | the guard, from `.ddd-ts-kit/worker.json` |
| the same story in two sessions | `story-scope` |
| two stories that change the same file | `stories`; the guard, at session start and on the first write of such a file |
| a session that ends before its report | the guard, which refuses the first stop of each step |
| the pull request: every row done, no scenario pending, the trunk merged in, the report written | `story --gate close` |

## Hosts

Claude Code runs the whole workflow: the skill, the agents and the guard. Codex and Copilot run
the skill and the guard; without the agents of the plugin the session builds each row itself
with the `use-case` skill, and nothing confines it to one context but the briefing and the
review.

## Limits

- The session asks once. An answer that turns out wrong comes back through the report and the
  review of the pull request, not mid-story.
- The judge is an agent, not the owner: its verdict is a second reading before the lock, and the
  owner validates each amendment at the review of the pull request.
- Two stories on the same aggregate in two terminals still conflict at the merge of the second:
  `stories` and the guard say it as soon as both change a file, they do not prevent it.
- The trunk is read as the last `git fetch` left it: neither the guard nor the CLI goes to the
  network. The skill fetches before each row and before closing; the guard says when the last
  fetch is more than an hour old.

## See also

- [Methodology](methodology.md), [parallel work](parallel-work.md), [commit discipline](commit-discipline.md)
- [Which command, when](commands.md), [the plugin for coding agents](coding-agents.md)

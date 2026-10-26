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
terminal 3: /ddd-ts-kit:story US7 docs/architecture/intents/faster-checkout.md
```

## Where a story comes from

A story starts from plain words, a file, a ticket, or an intent. An intent is the idea written
by whoever has it, in their own words, before anyone designs anything: `/ddd-ts-kit:intent`
brainstorms with the originator until the idea is concrete (what is wrong, what would be true
once it is solved, who and what it touches, the constraints, what the author would observe),
maps the affected systems on `npx ddd-ts-kit list` when it runs inside the project, and writes
`docs/architecture/intents/<slug>.md` from the template of the story skill with
`Status: draft`. The person runs it from Claude Code, from Cowork or claude.ai with a git
connector, or fills the template by hand. The product owner corrects the intent in a pull
request and accepts it by setting `Status: accepted`: the merge is the acceptance, and nothing
is decided for the owner. The story then reads it, `npx ddd-ts-kit story-scope US7 --from
docs/architecture/intents/faster-checkout.md` (refused while the intent is not accepted):
`## Problem` and `## Proposed outcome` seed `## Statement`, each constraint is a question
answered "by the intent", the open questions join phase 1, and each line of the acceptance the
author wrote is the first draft of a criterion. An incident record
(`docs/architecture/incidents/<id>.md`, [closing the loop](closing-the-loop.md)) is accepted the
same way, as it is. An intent is not a ticket: a project whose tracker is the source of truth
writes the key in the intent and the path in the ticket, and `## Origin` carries both.

## The phases

| # | Phase | Artefact | Who decides |
|---|---|---|---|
| 0 | its worktree: `npx ddd-ts-kit story-scope US5 [--from <intent or incident>]` | `.worktrees/us5` on `story/us5`, `.ddd-ts-kit/story.json` (`kind`, `from`) | |
| 1 | every question, at once | `## Origin` and `## Questions` of `docs/architecture/stories/US5.md` | the owner, once |
| 2 | specification and rows | `## Acceptance criteria` (`- AC1: ...`), the rows `US5.01`, ... of `slices.md` | the session |
| 3 | a design review of each row | `docs/architecture/reviews/US5.md`, one `## #US5.02 ...` section per row, read by `architecture-reviewer` | the session |
| 4 | the acceptance, before any code | `test/acceptance/us5.acceptance.spec.ts` and its lock | the session |
| 5 | the build gate: `npx ddd-ts-kit story US5 --gate build` | the guard opens the code of the contexts | |
| 6 | build, row by row | one commit per row, one `context-builder` agent per slice row | the session |
| 7 | close: trunk merged in, review, `npm run verify`, `acceptance US5 --gate passing` | a green branch | |
| 8 | the report, then the pull request | `## Report` with `### Verification`, the body of the pull request | the owner, at the review |

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

## The record of the story

The story file is the record an auditor reads: who asked (`## Origin`), who answered
(`## Questions`), what the session decided alone (`D<n>`), under which rules, and who approved
(the merge of the pull request). `## Origin`, written at phase 1, holds three lines: `From:`,
the intent, the ticket or the incident the story comes from; `Built with:`, the version of the
kit and of the plugin, the base and its commit; `Policies in force:`, the skills loaded at
phase 3. `story --gate close` refuses a story without its `From:` and `Built with:` lines, and
the body of the pull request repeats the block, so that the trunk links back to where the story
came from. The report ends the record with `### Verification`: the last lines of
`npm run verify`, of the acceptance run and of `story-check`, pasted as the toolchain printed
them, and `not verified:` for what could not run (a broker, a provider, a platform); the close
gate reads it too. The block is what the
[AI-native SDLC playbook of Anthropic](https://cdn.prod.website-files.com/6889473510b50328dbb70ae6/6aba736348bdf4f08183f463_AI%20Native%20SDLC%20Playbook_designv2%20(1).pdf)
asks as governance evidence: the spec, what produced it and the policies in force, logged with
it.

## The design before the code

Each row gets a section of the design review before anything is generated: the aggregate and
its invariants, the command or query and its permission, the events, the errors by business
name, the route, the ports, the contract read from another context. A criterion that states a
law over every value of a value object ("never negative", "symmetric") gets a `Laws:` line there,
and the build states it as a property (`generate property`): on the example, the symmetry of
`Range.overlaps` stated as a property kills a mutant of a bound the examples of the time missed. The `architecture-reviewer`
agent reads it as a design review of rows still to build; its blocking findings change the
design. The policies of the project are skills, those of the plugin (access control,
persistence, cross-cutting concerns, testing) and the project's own under `.claude/skills/`:
the session lists the ones it loaded on the `Policies in force:` line of `## Origin`, and writes
in the section of a row `Policies: <skill>: <what it imposed here>` when a policy changed the
design, a line the reviewer reads with the rest; two policies that contradict each other become
a decision for the owner. `npx ddd-ts-kit cited --rows <ids>` lists the names the design cites
that the trunk replaced in the meantime. `worker-scope` names the section of a row in the
briefing of its agent. Once a row is done, its section stays true:
`npx ddd-ts-kit story-check US5` holds every name it cites to the tree (a path, a class, a
`Class.member`), unless `### Compromises` of `## Report` in the story file lists the name with why
it was built otherwise; the guard says it once at the stop of the session, without blocking. The
comparison of the built code with its design comes from
[the AI-native SDLC playbook of Anthropic](https://cdn.prod.website-files.com/6889473510b50328dbb70ae6/6aba736348bdf4f08183f463_AI%20Native%20SDLC%20Playbook_designv2%20(1).pdf).

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

## A fix: the regression spec first, locked

A defect found in production or in use is repaired the same way, with one row and no design
review. `/ddd-ts-kit:fix <code>` opens its worktree (`npx ddd-ts-kit story-scope <code> --kind fix`),
finds the layer of the defect and writes the spec that reproduces it at that level (an aggregate
spec, a handler spec through the test application, a case of a contract suite, an end-to-end
scenario), named after the defect and run once to fail on an assertion. The story file holds the
defect under `## Statement` and lists each spec under `## Regression`, one path per item;
`npx ddd-ts-kit acceptance <code> --lock` records the fingerprint of each test of those files in
`test/acceptance/<code>.acceptance.lock.json`, and that commit comes before any code. The guard
opens the code of the contexts once the lock exists, and from then on refuses every edit of a
locked spec, by the editor tools and by the shell, to its sub-agents: the proof of the fix
predates the fix and stays out of the builders' reach. A spec that turns out wrong is amended by
the session of the fix, as the acceptance of a story is: it writes the new version,
`acceptance <code>` reports the change since the lock, the `acceptance-judge` agent rules on that
version, the statement of the defect being the criterion, and `--lock` takes it on an `amend`
verdict and refuses it otherwise. `--lock` also refuses a spec (a regression spec, or the
acceptance spec of a story) that fails the formatter or the linter of the project, run on those
files only and named with their findings, since a locked file can no longer be touched: run
`npm run format` and `npm run lint -- <file>` before locking. A project without a `format` or a
`lint` script, or without the tool installed, is locked as before. `acceptance <code> --gate passing` holds that each locked test is there, unchanged
and no longer pending; the test runner proves it passes (`npm run verify`). The fix closes as a
story does: the review of the diff, the report with its origin and its verification, the pull
request. The failing test first, committed, and a hook that stops the agent editing it during
the fix come from [the AI-native SDLC playbook of Anthropic](https://cdn.prod.website-files.com/6889473510b50328dbb70ae6/6aba736348bdf4f08183f463_AI%20Native%20SDLC%20Playbook_designv2%20(1).pdf).

## Agents confined to one context, one after the other

A story crosses contexts, a worker does not. Each slice row is built by one `context-builder`
agent, briefed with `npx ddd-ts-kit worker-scope <context> --here --rows <id>` in the worktree
of the story: the guard confines it to that context, and its blocking needs (a contract field,
a dependency, a grant, a migration) come back to the session, which does them on the branch.
The agents run one after the other in the one worktree: the rows of a story mostly depend on
each other (contract, producer, consumer), and the parallelism is between stories, one per
terminal.

## At the close of a story

The trunk is merged in, the `architecture-reviewer` agent reads the branch, and its findings are
fixed or written as `TODO(review)` markers tied to their row. The rule of two applies there: a
finding that repeats one already recorded for the project (the same rule id or the same remark
in an earlier review file, or a `TODO(review)` marker) is written in the same branch as a line
under `## Mistakes seen here` of `AGENTS.md`, or as a rule of `ddd-ts-kit.config.json` when the
kit has one for it, so that the next session does not make it a third time. The review itself is
kept: the session appends it to `docs/architecture/reviews/<code>.md` under `## Findings`, one
line per finding with its pass, its `file:line` and its outcome (`fixed in <commit>`,
`written as TODO(review)`, `dismissed by ADR-<n>`), so that the record outlives the pull
request, survives a move between GitHub and GitLab, and feeds the rule of two.

A second reading then comes from a context that did not build the code: the `story-verifier`
agent, read-only, starts the application the way the end-to-end tests do, runs the acceptance of
the story and the end-to-end specs of the two nearest flows, calls the routes the specs leave
unexercised when the project starts without a service, reads the design review and the report,
and reports what it ran, what it saw, and every behaviour that does not match the design or a
`D<n>` decision. It fixes nothing; the session settles each mismatch as a finding. The
acceptance tests remain the stronger check, since they fail before the code and cannot be
rewritten by the agent that builds; the verifier adds the neighbouring flows and a reading of
the compromises.

A team that wants the commits of an agent told apart from those of a person sets
`commit.agentTrailer` to `true` in `ddd-ts-kit.config.json`
([configuration](../CONFIG.md)): the story skill, the `context-builder` agent it briefs and the
fix skill then end each commit they make with the trailer
`Agent: <host> ddd-ts-kit@<plugin version> <agent name>`, and the report counts the commits made
by an agent against those made by hand. It is off by default: many teams refuse attribution
lines in commits, and the separation an audit really wants is by the identity of the run (its
own account, its own token), which a trailer only approximates.

After the pull request is opened, the review and the checks of the platform answer. When the
owner asks for it, `/ddd-ts-kit:pull-request <number>`, run from the worktree of the story,
takes the pull request to green: it sweeps the unresolved review comments and the failing
checks, addresses each under the rules of the story (a change the design review did not
foresee becomes a `D<n>` decision, a request to weaken a check goes through the `deviation`
skill, a failing check is fixed in the code and never in the check, no force-push), replies to
each thread, pushes, waits for the checks and repeats until the pull request waits only on the
code owner; then it reports what was changed and what was declined and why.

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
| the regression spec of a fix, once locked | `ddd-ts-kit acceptance <code> --lock`; the guard, in the worktree of a fix (`"kind": "fix"` in `.ddd-ts-kit/story.json`), which refuses every edit of a locked spec by a sub-agent and opens the code once the lock exists |
| an agent outside its context | the guard, from `.ddd-ts-kit/worker.json` |
| the same story in two sessions | `story-scope` |
| two stories that change the same file | `stories`; the guard, at session start and on the first write of such a file |
| a session that ends before its report | the guard, which refuses the first stop of each step |
| a done row that departed from its design review, no compromise listed | `story-check`, which blocks on each name the section cites that the tree lacks; the guard, once at the stop of the session, without blocking |
| a commit of the story that changes a migration or a container without its `Change: <id>` trailer | `story-check`, which lists it with its files, and blocks on it under `agents.profile: regulated` or with `--strict` |
| the pull request: every row done, no scenario pending, the trunk merged in, the origin recorded, the report written with its verification | `story --gate close` |

## The optional end state: the specification as a job

The playbook's end state fires the design pass on the merge of the intent, as a job that
commits the specification as a pull request. The kit has it as `/ddd-ts-kit:story <code>
--headless <intent>`: phases 1 to 4 without an owner, every question that changes an artefact
written under `## Open questions` of the story file with its recommended option taken
provisionally and marked `(provisional, headless)`, the rows, the design review and the
acceptance written and locked, the build gate left closed, and a pull request whose body is the
list of questions. The owner answers in the review; the pull request merges with the answers
written into the story file, and the build phase starts from them in a session that runs the
story again. A boundary, a new context or a relationship pattern is written as a question with
no option taken: the rows that depend on it wait for the owner.

`pipeline/github/workflows/intent-to-spec.yml` is the workflow template that runs it: on a pull
request merged into the default branch that turns an intent of `docs/architecture/intents/` to
`Status: accepted`, it installs the project, Claude Code and the plugin, and runs `claude -p`
with the `ANTHROPIC_API_KEY` secret, one story per accepted intent, under the token of the
workflow or a token of the team (`INTENT_TO_SPEC_TOKEN`, so that the checks of the story run on
the pull request it opens). It is opt-in and paid: `npx ddd-ts-kit init --ci-extras intent-to-spec`
writes it (`ci.extras` of the config, GitHub only), the team adds the secret, and each accepted
intent consumes API tokens. The template was parsed and not executed on GitHub.

## Hosts

Claude Code runs the whole workflow: the skill, the agents and the guard. Codex and Copilot run
the skill and the guard; without the agents of the plugin the session builds each row itself
with the `use-case` skill, nothing confines it to one context but the briefing and the
review, and the verification by a fresh context is skipped, which the report says.

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

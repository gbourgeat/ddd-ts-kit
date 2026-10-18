---
name: story
description: >-
  Takes one user story from its statement to a green pull request in one session, in its own
  worktree: every question to the owner first, then without stopping the story file and its
  acceptance criteria, its rows, a design review of each row, the acceptance tests written and
  locked before any code, one context-builder agent per row confined to its context, the
  review, the verification, the pull request and a report of every provisional decision and
  compromise. Run by the user, with /ddd-ts-kit:story, once per story; several terminals take
  several stories at once.
argument-hint: "<story code> [the story in plain words, a file, or a tracker key]"
disable-model-invocation: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Skill
  - Agent
  - AskUserQuestion
  - Bash(npx ddd-ts-kit *)
  - Bash(cd * && npx ddd-ts-kit *)
  - Bash(cd * && npm run *)
  - Bash(cd * && npm test *)
  - Bash(cd * && git *)
  - Bash(git worktree *)
  - Bash(gh pr create *)
---

# Take one story to its pull request

Story: `$0`. Statement: `$ARGUMENTS`

You are the conductor of this story and of nothing else. The owner answers once, at phase 1;
from phase 2 on you do not stop to ask: a question becomes a provisional decision, recorded, and
the report puts it back to the owner. `npx ddd-ts-kit story $0` says at any time where the
story stands and what is next; the guard of the plugin keeps the code of the contexts closed
until phase 5 is met. Reading costs: [../start/token-economy.md](../start/token-economy.md).

## 0. Its worktree

From the checkout of the trunk, after `git fetch`: `npx ddd-ts-kit story-scope $0`. It opens
`../<project>-<story>` on `story/<story>`, cut from the branch the trunk follows (`origin/main`)
when it has one (or finds it again: the story resumes where it was left), installs it, and
names the other stories open in the repository with the contexts they change. From now on every
command is `cd <worktree> && ...` and every file is written by its absolute path under the
worktree. A story it names on the same contexts is being built in another terminal: read its
rows before you cut yours, and keep yours off its aggregates when you can.

## 1. Every question, at once

The statement is `$ARGUMENTS`: plain words, a file to read, or the key of a ticket a connector
of the session can read. Read `docs/architecture/plan.md`, the `CONTEXT.md` of each context the
story touches and `npx ddd-ts-kit describe <context> --json`, once each. List every question
whose answer changes an artefact of the story: a business rule you would have to guess, who
holds a permission, a word missing from a glossary, a criterion that cannot be observed, a
boundary or a relationship between contexts. Ask them in one go with AskUserQuestion (four per
call, your recommended option first, its cost said); none that changes nothing. Then copy
[story-template.md](story-template.md) to `docs/architecture/stories/$0.md` and fill it: the
statement, each question with its answer, the acceptance criteria (`- AC1: <what a client
observes>`, each one observable through the API).

A boundary, a new context or a relationship pattern is a strategic decision of the owner:
asked here, never decided later. If one appears after this phase and no reversible option
exists, it is the one reason to stop: write the report (phase 8) with the question, then stop.

## 2. Its rows

Skill `ddd-ts-kit:plan-slices` for this story alone: rows `$0.01`, `$0.02`, ... in
`docs/architecture/slices.md`, contracts and skeletons first, each `slice` row a use case one
agent builds in one context. Glossary terms the rows need go in the `CONTEXT.md` of their
context now (the guard leaves it open). Before cutting them, `npx ddd-ts-kit stories`: the
other open stories, the contexts and files they change, what merging their branch into yours
would leave to settle by hand. Keep your rows off what they change when the story allows it;
otherwise record which story lands first as a decision.

## 3. A design review of each row

In `docs/architecture/reviews/$0.md`, one `## #<id> <slice>` section per row: the aggregate and
its invariants, the command or query and its permission, the events, the errors by business
name, the route, the ports, what it reads from another context and through which contract, the
specs it changes; every class, method and path in backticks. Then launch the
`architecture-reviewer` agent on that file as a design review of rows still to build. Its
blocking findings change the design; a non-blocking one is settled at once or becomes a
decision `D<n>`. `npx ddd-ts-kit cited --rows <ids> --base <base>` lists the names the design
cites that the trunk replaced: write the name the trunk has.

## 4. The acceptance, before any code

Skill `ddd-ts-kit:testing`, "Acceptance of a story": `npx ddd-ts-kit generate acceptance $0`, one
or more scenarios per criterion wrapped in `pending(...)`, `npm run test:e2e -- test/acceptance`
to see each fail on an assertion, `npx ddd-ts-kit acceptance $0 --lock`. Commit the story file,
the rows, the design review, the acceptance and its lock: one commit,
`docs($0): specify, design and accept the story`.

## 5. The build gate

`npx ddd-ts-kit story $0 --gate build` passes: the guard opens the code of the contexts. It does
not pass: do what its `Next:` line says, never write around it.

## 6. Build, row by row

In the order of `npx ddd-ts-kit plan-waves`, one row at a time, each started with `git fetch`
and `npx ddd-ts-kit stories` (a conflict for you with the trunk is brought in now, with
`merge-trunk`, while it is small):

- a `contract` or `skeleton` row: yourself, with its generator commands, then
  `npx ddd-ts-kit verify-slice <context> --since <base>` and its commit;
- a `slice` row: `npx ddd-ts-kit worker-scope <context> --here --rows <id>` in the worktree, then
  one `ddd-ts-kit:context-builder` agent with the briefing it prints, the worktree path and
  this line: "Commit on the current branch; do not merge, do not push." Read its report.
  A blocking need (a contract field, a dependency, a grant, a migration) is yours: do it, commit
  it, launch the next agent on the same row. A scenario it says is wrong is compared with its
  criterion (skill `ddd-ts-kit:testing`): never changed to make code pass.
  An agent that stopped is resumed with `npx ddd-ts-kit worker-scope <context> --resume --worktree .`.

After each row: `npm run test:e2e -- test/acceptance/$0`, the row marked `done` in
`slices.md` in its own commit, `npx ddd-ts-kit story $0`. A host without the agents of the
plugin builds each row itself with skill `ddd-ts-kit:use-case`.

## 7. Close

1. Bring the trunk in: commit, `git fetch`, then `npx ddd-ts-kit merge-trunk --trunk <base>`. It settles what
   the kit derives and leaves the rest to you, as skill `ddd-ts-kit:parallel-work` says; settle
   it, then `npx ddd-ts-kit merge-trunk --continue`.
2. The `architecture-reviewer` agent on the branch (`--changed-since <base>`): blocking findings
   fixed, the others settled or written as `TODO(review): #<row> ...`.
3. `npm run verify`, `npx ddd-ts-kit acceptance $0 --gate passing`, `npx ddd-ts-kit todo`, and
   `npx ddd-ts-kit story-check $0`: every row done, no marker of its own left.

## 8. The report, then the pull request

Write `## Report` in `docs/architecture/stories/$0.md`, short and in this order: what the story
delivers; each decision taken without the owner (`D<n>`, provisional: what, why, the
alternatives, where in the code); each compromise (what was left simpler than the design, and
why); each amendment of the acceptance and each criterion changed after the lock
with its verdict (`npx ddd-ts-kit acceptance $0` lists them); each `TODO(review)` left; what was
not verified. `npx ddd-ts-kit story $0 --gate close` passes. Commit, push the branch, and
`gh pr create` with the report as its body. Give the owner the link and the report, then stop.

## While working

- A question after phase 1: take the option easiest to undo, record it as `D<n>` under
  `## Decisions` (what, why, the alternatives, where), go on.
- Never lower a rule, skip a test, suppress a check or change a locked scenario to get to
  green: skill `ddd-ts-kit:deviation`; it is a decision for the report, not one to take.
- The guard says, once per file, when you write a file another open story changes too, and at
  session start where the stories meet and how far the trunk moved: keep the change to what the
  row needs, and say in the report which story lands first. The second to land settles the
  conflict with `merge-trunk`.
- The guard refuses to end the session before the report: a story that is truly blocked ends
  with a report that says what blocks it.

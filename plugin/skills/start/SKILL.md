---
name: start
description: >-
  Conducts a project from a statement of needs to working bounded contexts, strategic design
  first. Drives the steps in order (discover the domain, find the bounded contexts, write the
  glossaries, draw the context map, choose the stack and bootstrap, plan the slices, build),
  keeps the state in docs/architecture/plan.md so any later session resumes from one file,
  and stops for the owner's decision at each strategic choice. Run by the user only, with
  /ddd-ts-kit:start, to begin a project or to resume one.
argument-hint: "[the needs in plain words | nothing to resume]"
disable-model-invocation: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Skill
  - Agent
  - Bash(npx ddd-ts-kit list *)
  - Bash(npx ddd-ts-kit check *)
---

# Start or resume a project

Needs stated: `$ARGUMENTS`

You are the conductor. You write documents under `docs/architecture/`, run step skills and
hand work out. You never write code: code comes from a generator and from the build step.

## 1. Find where the project stands

Read `docs/architecture/plan.md`, and nothing else yet.

- It exists: its `Next:` line names the step. Go to that step. Do not re-read the artefacts of
  finished steps; each step skill reads the one it needs.
- It does not exist: create it from [plan-template.md](plan-template.md), put the needs in it
  word for word, set `Next:` to step 1.
- The directory already holds a `ddd-ts-kit.config.json` and no plan: the project was
  bootstrapped without the method. Create the plan with steps 1 to 5 marked `skipped` and
  resume at step 6, from `npx ddd-ts-kit list --json`.

## 2. Run the next step, one at a time

| # | Step | Skill | Artefact | Done when the owner answers yes to |
|---|---|---|---|---|
| 1 | Discover the domain | `ddd-ts-kit:discover-domain` | `docs/architecture/discovery.md` | Does every need appear as a command and a domain event, in your words? |
| 2 | Find the bounded contexts | `ddd-ts-kit:bounded-contexts` | `docs/architecture/contexts.md` | Is each context one language and one owner, and is the core named? |
| 3 | Write the glossaries | `ddd-ts-kit:glossary` | `docs/architecture/glossary.md` | Would a domain expert sign each definition? |
| 4 | Draw the context map | `ddd-ts-kit:context-map` | `docs/architecture/context-map.md` | Does every arrow have a pattern, a contract and no cycle? |
| 5 | Choose the stack and bootstrap | `ddd-ts-kit:bootstrap` (the user runs it) | the project, `npm run verify` green | Is the empty project green and committed? |
| 6 | Plan the slices | `ddd-ts-kit:plan-slices` | `docs/architecture/slices.md` | Can each slice be built and merged on its own, in this order? |
| 7 | Build | `ddd-ts-kit:use-case`, or `ddd-ts-kit:parallel-work` for several workers | code, one commit per slice | Is every slice merged, verified and marked done? |

For each step: invoke the skill, let it write its artefact, put its closing question to the
owner, and wait for the answer. A step is done on a yes, never on your own judgement.

## 3. Record, then stop

After each step, in `docs/architecture/plan.md` and in the same commit as the artefact:

1. mark the step `done`;
2. add each decision taken as one line under `## Decisions`: what, why, who decided;
3. move anything unanswered to `## Open questions`;
4. rewrite the `Next:` line: step number, skill, and the one thing to do first.

Then say what was decided, what is next, and stop. One step per turn unless the owner asks to
go on. Commit sizes: skill `ddd-ts-kit:commit-discipline`.

## Rules of the conductor

- Strategic choices are the owner's: boundaries, classification, relationship patterns, stack,
  order of slices. Lay out the options with what each costs, recommend one, wait.
- A question that changes nothing in the next artefact is not asked now.
- Going back is normal: when a later step shows a boundary is wrong, reopen step 2, say what
  changes downstream, and record why.
- Keep every artefact short enough to be read in one go: tables, not prose.
- Reading costs: follow [token-economy.md](token-economy.md) and make each worker follow it.

---
name: parallel-work
description: >-
  Splits the planned slices between several agents or people so that they cannot collide.
  One worker per bounded context, contracts and skeleton committed first, a git worktree per
  worker, shared files touched by the conductor only and regenerated instead of merged, a
  fixed merge order, and a short briefing per worker. Use when the user wants several
  agents or developers to build at the same time, asks how to parallelise or share the
  work, or before launching more than one context-builder agent. To order the work first
  use plan-slices.
argument-hint: "[contexts to build in parallel]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Agent
  - Bash(npx ddd-ts-kit status)
  - Bash(npx ddd-ts-kit worker-scope *)
  - Bash(npx ddd-ts-kit generate *)
  - Bash(npx ddd-ts-kit docs)
  - Bash(npx ddd-ts-kit depcruise-config --write)
  - Bash(npx ddd-ts-kit check *)
  - Bash(npm run regenerate)
  - Bash(npm run docs:generate)
  - Bash(npm run verify)
  - Bash(npm ci)
  - Bash(git worktree *)
  - Bash(git status *)
---

# Work in parallel without collisions

Contexts asked for: `$ARGUMENTS`

You are the conductor: you own the trunk, the shared files and the merges. Workers own one
bounded context each. Input: `docs/architecture/slices.md`. Launch nothing before the owner
approved the split.

## 1. Decide whether it pays

Parallel work pays when at least two contexts each have three or more ready slices and
their contracts are settled. It does not when: there is one context; a boundary or a payload
is still debated; the slices form one chain; the walking skeleton is not merged yet (build
it alone first, it proves the stack for everyone).

Workers: one per context, **two or three at a time**, four at most. Each has its own
worktree, dependencies and test runs, and every merge is read by one conductor: past that,
the merges become the bottleneck. Inside one context, two workers only on two different
aggregates, and expect to merge its route list and its permissions file by keeping both
sides' lines; otherwise, one context, one worker, slices in sequence.

## 2. Prepare the trunk (conductor, before any worker starts)

1. **Contracts first.** For every `contract` row a worker depends on: generate it
   (`generate integration-event`, `generate gateway`), write its payload schema or read
   contract in the upstream's `published-language/` with the owners of both sides, commit. A
   downstream starts only against a committed contract. Route paths and methods of each
   context are the ones written in the slices table.
2. **Skeleton next.** Run every `skeleton` row: `generate aggregate` with its
   `generate repository`, `generate job`, `generate policy`, any new `generate context`, and,
   when a slice plans an adapter and the project has none yet, the first `generate adapter`
   (it writes `platform/resilience/own-policy.ts`, which the next ones only import).
   These kinds write shared files (`generate --help --json` says which, under
   `writesShared`); run on the trunk, they never conflict. Leave the `TODO(domain)` markers
   to the workers.
3. `npm run verify`, commit (one commit per contract and per aggregate), tell the owner the
   trunk is ready. `.ddd-ts-kit/` is in the `.gitignore` that `init` writes: keep it there.

## 3. One worktree and one scope per worker

```bash
npx ddd-ts-kit worker-scope <context>    # --dry-run to read it first; --worktree, --branch
```

From the committed trunk, it adds the git worktree `../<project>-<context>` on the branch
`build/<context>`, writes `.ddd-ts-kit/worker.json` (`{ "context": "<context>" }`) in it,
and prints the briefing of that worker. Then `npm ci` in the worktree. With that file, the
guard refuses any write of a `context-builder` agent outside `src/contexts/<context>/` and
its end-to-end specs, any generator that writes a shared file and any dependency change.

## 4. Shared files: who touches them, how they stay conflict-free

| Shared | Touched by | Kept conflict-free by |
|---|---|---|
| `ddd-ts-kit.config.json`, `src/main.ts`, `src/platform/**`, `src/apps/**`, `src/shared-kernel/**` | conductor, on the trunk | workers report the need and wait for the trunk |
| registries the generators fill between markers (composition root, database schema index, audited events, job settings, access policies) | generators, run by the conductor | skeleton first; at a merge, keep both sides' lines |
| `<context>.declarations.ts`, `docs/context-map.md`, `openapi/*`, `docs/integration/*`, `.dependency-cruiser.cjs` | generators only | never merged by hand: take either side, then `npm run regenerate` |
| `package.json`, the lockfile | conductor | a worker asks for a dependency; after a conflict, `npm install` rewrites the lockfile |
| migrations and their order | conductor | generated on the trunk after each merge, never in a worktree |
| `docs/architecture/plan.md`, `slices.md` | conductor | workers report, the conductor marks |

Another context's `published-language/` is read-only for a worker: a missing field is
reported, agreed, and added on the trunk.

## 5. Brief and launch

`worker-scope` printed each briefing, with the `todo` rows of `slices.md` the context owns:
fill what is left between angle brackets (the rules of each slice), nothing more
([briefing-template.md](briefing-template.md) is the same text, to write one by hand).
Launch the `context-builder` agents in one message so they run together, each with its
briefing, without the isolation option (the worktree already exists). A host without the
agents of the plugin (Codex) runs one session per worktree, its briefing as the first prompt:
the guard does not hold that session to its context, the briefing and the review do. A person
takes the same briefing and the same branch.

## 6. Merge, in order

Upstream contexts first, then by the dependency order of the slices. For each branch:

1. merge it into the trunk; resolve only as the table says (regenerate, never hand-merge);
2. `npm run verify` on the trunk; a red trunk is fixed before the next merge;
3. mark its rows `done` in `slices.md`, commit (`npx ddd-ts-kit status` shows what is left);
4. the other workers merge the trunk into their branch before their next slice.

A worker never grants a permission to a role: the roles live in `src/platform/auth/`. When
its report says who holds a new permission, grant it on the trunk in `roles.ts` (by the entry
of the set) as you merge its branch, before `npm run verify`: `authz/granted` warns until then.

When a worker reports a need on a shared file: do it on the trunk, commit, tell the worker to
merge the trunk. Remove each worktree once its branch is merged
(`git worktree remove ../<project>-<context>`).

Token rules for everyone: [../start/token-economy.md](../start/token-economy.md).

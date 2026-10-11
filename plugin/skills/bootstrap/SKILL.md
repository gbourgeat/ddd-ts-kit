---
name: bootstrap
description: >-
  Chooses the stack by criteria and creates the project with the ddd-ts-kit CLI: config,
  composition root, platform, database, Docker Compose, pipeline, agent rules, then one
  bounded context per row of the strategic artefacts, with its glossary and its
  relationships. Works in an empty directory or adopts an existing backend. Run by the user
  only, with /ddd-ts-kit:bootstrap, usually as step 5 of /ddd-ts-kit:start.
argument-hint: "[stack hints, for example: fastify prisma keycloak]"
disable-model-invocation: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash(ls *)
  - Bash(git remote *)
  - Bash(npx ddd-ts-kit init *)
  - Bash(npx ddd-ts-kit@* init *)
  - Bash(npx ddd-ts-kit generate context *)
  - Bash(npx ddd-ts-kit docs)
  - Bash(npx ddd-ts-kit list *)
  - Bash(pnpm exec ddd-ts-kit generate context *)
  - Bash(pnpm exec ddd-ts-kit docs)
  - Bash(pnpm exec ddd-ts-kit list *)
  - Bash(corepack enable)
  - Bash(pnpm install)
  - Bash(pnpm run verify)
  - Bash(pnpm run hooks:install)
  - Bash(npm install)
  - Bash(npm run verify)
  - Bash(npm run hooks:install)
---

# Choose the stack and bootstrap

Stack hints given: `$ARGUMENTS`

## 1. Look before asking

Read `docs/architecture/plan.md`, `contexts.md`, `glossary.md` and `context-map.md` there when
they exist, and `package.json` when there is one. An existing project is adopted, never
overwritten: the CLI skips existing files unless `--force`. Without strategic artefacts, say
that `/ddd-ts-kit:start` produces them first and ask whether to go on without.

## 2. Choose the stack by criteria

Follow [stack-criteria.md](stack-criteria.md): infer each choice from the artefacts, the
hints and `package.json`, and ask only what it marks as not inferable, in one batch. Show the
resulting table (choice, value, why) and the full `init` command; the owner confirms. Record
the command under `## Decisions` of the plan.

## 3. Create the project

```bash
npx ddd-ts-kit@latest init <flags> --dry-run --json   # read `created` and `skipped`
npx ddd-ts-kit@latest init <flags> --json             # its `notes` end with the two commands to run next
pnpm install                                          # `npm install` with --package-manager npm
pnpm run verify                                       # the bare project is green before its first context
```

A project is on pnpm unless `--package-manager npm` was chosen: every command below is said for
pnpm, and reads `npm run <script>` and `npx ddd-ts-kit <command>` on npm. pnpm is pinned in
`package.json` and provided by corepack (`corepack enable`, once per machine). A red `verify`
on a project nothing was generated in is a bug of the kit: report it, do not patch the project.

No `--context` here: contexts come next, with their language.

## 4. Create the contexts, upstreams first

One command per row of `contexts.md`, in the order of the context map (a context after its
upstreams), with the purpose, every term of its glossary and its relationships:

```bash
pnpm exec ddd-ts-kit generate context <name> --classification <core|supporting|generic> \
  --purpose "<two sentences>" --term "<Term>=<meaning>" --term ... \
  --upstream <upstream>:<pattern> --json
```

Then, by hand, only what a flag cannot carry: the sentence under `## Classification` of each
`CONTEXT.md`, the "Not to be confused with" cells, and in `docs/context-map.md`, outside the
markers, the reasons from the draft map and from `contexts.md`. Delete
`docs/architecture/glossary.md` and `docs/architecture/context-map.md`: their content now
lives in the `CONTEXT.md` files, the config and `docs/context-map.md`, and a second copy
would drift.

## 5. Prove it and commit

```bash
pnpm run verify          # types, lint, format, tests, end to end, architecture, import graph, dead code, docs drift
pnpm run hooks:install   # pre-commit checks and conventional commit messages
```

Report the real output. Propose the commits (skill `ddd-ts-kit:commit-discipline`): one for
the bare project (`chore: bootstrap the project`), then one per context
(`feat(<context>): declare the context and its language`). `init` creates no
repository: in a fresh directory `git init` comes first, by the owner. Then `pnpm run infra:up` and
`pnpm run dev` when the owner wants to see it run; the API documentation is on `/docs`.

## 6. Hand over

Update the plan: step 5 `done`, `Next: 6 plan-slices - ...`. Say what exists now.

Never hand-write a file the CLI generates. A generated file that is wrong is a bug of the
template: report it, do not patch it locally.

## Done when

Put this to the owner: **is the empty project green on `pnpm run verify`, with one
`CONTEXT.md` per context, and committed?** On a yes, the next step is
`ddd-ts-kit:plan-slices`.

**English** · [Français](README.fr.md)

# Briefings of the workers

One file per worker, filled from the kit's `parallel-work/briefing-template.md`. What follows is
common to all of them and specific to this example: there is no git here, so the workers share one
tree instead of a worktree each, and the example measures the tooling.

## Common rules

- Project: `/home/gbourgeat/ddd-ts-kit/examples/scheduling` (an npm workspace of the kit's
  repository). Run every command from there. Never run git, `npm install`, docker, or anything
  that writes outside your scope. Never edit the kit itself (`/home/gbourgeat/ddd-ts-kit/packages`,
  `plugin`, `docs`, `pipeline`).
- Other workers write in the same tree at the same time. Stay inside your scope. The tree may be
  red because of someone else's unfinished file: look only at errors in your own files, never fix
  or revert a file outside your scope, and read a shared file again right before you edit it.
- Read first, and only: the agent rules `init` generated at the root of the project (the instruction file and its `rules/` folder), the `CONTEXT.md` of
  your context, your rows and rules in `docs/architecture/slices.md` (with its table "Permissions
  and the element they bear on"), then `node scripts/kit.mjs list --json` once. Your procedure is
  the kit's skills, to read when you reach the matter: `/home/gbourgeat/ddd-ts-kit/plugin/skills/`
  `use-case`, `scaffold` (with `kinds.md`), `testing`, `persistence`, `integration-event`,
  `access-control`, `cross-cutting`. API details: the README of the package concerned under
  `/home/gbourgeat/ddd-ts-kit/packages/<name>/README.md` (search it, do not read it whole).
- Create every file of a generated role with the generator, never by hand:
  `KIT_WORKER=<your name> node scripts/gen.mjs <kind> <args>` (it prints the `next` places; it is
  `npx ddd-ts-kit generate <kind> <args> --json`, serialised and measured). A name whose words the
  glossary lacks takes `--term "<Term>=<meaning>"`. Then fill every `TODO(domain)` and replace
  every `it.todo` by a real test. Never restructure generated code, never edit
  `<context>.declarations.ts` (run `node scripts/kit.mjs docs` after adding or deleting a role
  file by hand). When a generated file is wrong or forces a hand fix, do the smallest fix and
  write it down for your report.
- Tests: domain specs without doubles, handler specs through the buses with fakes, adapter specs
  on the in-process PostgreSQL, no mocks. Time through `Clock`, identifiers through `IdGenerator`.
- No suppression, no lowered severity, no `any`, no non-null assertion, no skipped test. English
  only. Never an em dash or an en dash character. No mention of AI vendors.
- While iterating: `npx eslint src/contexts/<context>`, `npx vitest run src/contexts/<context>`,
  `node scripts/kit.mjs check src/contexts/<context>`, `npm run typecheck` (whole project: ignore
  errors outside your files). Do not run `npm run verify`: the conductor does, on the whole tree.
- Needs outside your scope (the platform, the config, another context's contract, a system actor
  to relate, a binding in `src/platform/platform.module.ts`): do not work around them, finish
  what does not depend on them and put them in your report, precise enough to be done without
  asking you again. The platform worker is adding, in parallel: a persistent `RelationTupleStore`
  (the port class of `@ddd-ts-kit/auth/rebac`, bound by the platform, in-memory in handler specs),
  the relationship schema and the combined authorizer described in `slices.md`.

## Report (the last thing you write, under 400 words, no code)

1. Slices done; slices not done and why; `TODO(domain)` or `it.todo` left (there must be none).
2. Generator commands you ran, counted per kind, and for each kind whether its output compiled
   and passed the analyzers untouched.
3. Every hand fix of generated code (file, what, why) and every file you had to write by hand that
   a generator should plausibly produce.
4. Contradictions between a skill, a README and the tool's behaviour; rule violations you hit and
   whether the message told you what to do; what was pleasant.
5. Which files you had to open per slice, roughly (the reading the tool cost you).
6. Needs on shared files or other contexts; glossary terms added; open business questions.
7. Results of your last eslint, vitest, check and typecheck runs (errors in your files only).

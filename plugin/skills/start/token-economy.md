# Token economy

What an agent reads and writes is the cost of the project. These rules keep it low without
losing correctness; the generators and the checker do the rest.

## Write less

1. **Generate, then fill.** `npx ddd-ts-kit generate <kind> ... --json` writes the file, its
   spec, its fake and its registration. Fill the `TODO(domain)` markers and the `it.todo`
   entries, and nothing else. Never retype what a generator writes.
2. **Never paste generated code back.** Report paths and decisions, not file contents. A
   generated file that is wrong is a bug of the template: say so, do not patch around it.
3. **Never restructure generated code** (constructor visibility, factories, folders,
   suffixes): the checker will send it back.

## Read less

4. **The map, not the tree.** `npx ddd-ts-kit describe <context> --json` gives one context
   as facts: use cases, routes, events, ports with their adapters, policies, gateways,
   dependencies; `npx ddd-ts-kit list --json` gives every context in less detail. Do not
   `ls`, `find` or glob `src/` to learn what exists.
5. **One `CONTEXT.md`.** It holds the purpose, the glossary and the generated lists of one
   context. Read the one you work in, and of a neighbour only its `published-language/`.
6. **Open only named files.** The `todos` places of a generator (`file:line`, the sentence is in the file), the lines of
   `npx ddd-ts-kit todo <context>`, the file of a violation, the file of a failing test.
   Read a range around the line, not the file.
7. **The rule, not the reference.** `npx ddd-ts-kit explain <rule-id>` instead of the whole
   architecture reference; the rule files of `.claude/rules/` (`.github/instructions/` for
   Copilot) load by themselves with the files of their layer, and an agent that does not load
   them (Codex) reads the one of the layer it edits.

## Check less often, on less

8. `check-file` runs by itself after every write. While iterating:
   `npx ddd-ts-kit check --changed-since <base>` and the tests of the context
   (`npm test -- <context>`). `npm run verify` once, before a commit that closes a slice or
   before a merge.

## Keep conversations small

9. **One bounded context per conversation or per agent.** Its language, its files, its tests.
   Crossing a boundary means switching context: finish, commit, start again there.
10. **State lives in files.** `docs/architecture/plan.md` says what is next,
    `docs/architecture/slices.md` what is done; `npx ddd-ts-kit status` reads both. Resume
    from them, not from history.
11. **Explore through a read-only sub-agent** when the answer needs more than three files or
    another context: the agent `domain-explorer` answers "where is X", "what does context Y
    expose", "who consumes event Z" in a few lines, and its reading stays out of your context.
    Ask it one precise question. Do not delegate a lookup whose file you already know.
12. **A briefing fits in a few hundred tokens**: scope, files, commands, definition of done,
    what to report. The worker reads the rest itself, from the map.

## Rough budget

| Activity | Reads | Writes |
|---|---|---|
| a strategic step | the previous artefact only (1 file, under 150 lines) | one artefact |
| a use case | `CONTEXT.md` of the context, then the 5 to 8 `todos` places | the bodies behind the markers, 3 to 6 tests |
| a review | the diff and the `CONTEXT.md` of touched contexts | findings |

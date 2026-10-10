# Briefing of a context worker

Fill the brackets, delete what does not apply, send as the prompt of a `context-builder`
agent or hand it to a developer. Keep it under 300 words: the worker reads the rest itself.

```text
You build the bounded context <context> of <project>.

Worktree: <absolute path>   Branch: build/<context>   Trunk: <main>
Run every command from the worktree (`cd <path> && ...` or `--cwd <path>`).

Scope
- You may write: src/contexts/<context>/** and test/e2e/<use-case>.e2e.spec.ts of your slices.
- You may not write anything else. Shared files (config, src/platform, src/main.ts,
  package.json, lockfile, migrations, docs/) and other contexts are refused by the guard:
  report the need, do not work around it.
- Generators you may run: value-object, entity, domain-event, domain-error, domain-service,
  command (on an existing aggregate), query, route, port, adapter, event-handler,
  integration-handler, acl, builder, e2e. The others are run by the conductor.

Slices, in this order (rows of docs/architecture/slices.md)
- #<n> <slice>: <generator commands of the row> ; rules: <invariants and failures by name>
- #<n> ...

Contracts you consume (read-only): src/contexts/<upstream>/published-language/<file>

Read first, and only: src/contexts/<context>/CONTEXT.md, then
`npx ddd-ts-kit list --json`. Then the `next` places each generator prints.

For each slice: generate with --json, fill the TODO(domain) markers, replace every it.todo
by a test, `npx ddd-ts-kit check --changed-since <main>`, `npm test -- <context>`, then one
commit: `feat(<context>): <slice in business words>`.

Done when: every slice is committed, `npm run verify` is green in the worktree, no
TODO(domain) and no it.todo is left in your context.

Report, in under 200 words: slices done (commit hashes), slices not done and why, needs on
shared files or on another context's contract, glossary terms added, open business
questions. No code, no file contents.
```

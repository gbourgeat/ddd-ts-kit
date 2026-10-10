# Briefing of a context worker

`npx ddd-ts-kit worker-scope <context>` prints this briefing with the paths, the branch,
the contracts and the slices of the project filled in. Complete the brackets, delete what
does not apply, send it as the prompt of a `context-builder` agent or hand it to a
developer. Keep it under 300 words: the worker reads the rest itself.

```text
You build the bounded context <context> of <project>.

Worktree: <absolute path>   Branch: build/<context>   Trunk: <main>
Run every command from the worktree (`cd <path> && ...` or `--cwd <path>`).

Scope
- You may write: src/contexts/<context>/** and test/e2e/<use-case>.e2e.spec.ts of your slices.
- You may not write anything else. Shared files (config, src/platform, src/main.ts,
  package.json, lockfile, migrations, docs/) and other contexts are refused by the guard:
  report the need, do not work around it.
- Generators you may run: aggregate, builder, entity, value-object, domain-event,
  domain-error, domain-service, command (on an aggregate that has its repository), query,
  port, route, integration-handler, event-handler, acl, e2e, adapter.
  The others are run by the conductor.

Slices, in this order (rows of docs/architecture/slices.md)
- #<n> <slice>: <generator commands of the row> ; rules: <invariants and failures by name>
- #<n> ...

Contracts you consume (read-only): src/contexts/<upstream>/published-language/

Read first, and only: src/contexts/<context>/CONTEXT.md, then
`npx ddd-ts-kit describe <context> --json`. Then the `next` places each generator prints.

For each slice: generate with --local-only --json, fill the TODO(domain) markers, replace every it.todo
by a test, `npx ddd-ts-kit check --changed-since <main>`, `npm test -- <context>`, then one
commit: `feat(<context>): <slice in business words>`.

Done when: every slice is committed, `npm run verify` is green in the worktree, and
`npx ddd-ts-kit todo <context>` lists nothing.

Report, in under 200 words: slices done (commit hashes), slices not done and why, needs on
shared files or on another context's contract, glossary terms added, open business
questions. No code, no file contents.
```

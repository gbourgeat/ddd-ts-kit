# Briefing of a context worker

`npx ddd-ts-kit worker-scope <context> --base <trunk> --rows <id>` prints this briefing with
the paths, the branch, the contracts, the rows and their rules filled in. Written by hand,
complete the brackets, delete what does not apply (the `design:` line and the block of names
when `npx ddd-ts-kit cited --rows <n> --base <main>` reports nothing), send it as the prompt of
a `context-builder` agent or hand it to a developer. Keep it under 300 words: the worker reads
the rest itself.

```text
You build the bounded context <context> of <project>.

Worktree: <absolute path>   Branch: build/<context>   Trunk: <main>
Run every command from the worktree (`cd <path> && ...` or `--cwd <path>`).
Without node_modules: `npm ci`, never an install that names a package.

Scope
- You may write: src/contexts/<context>/**, test/e2e/<use-case>.e2e.spec.ts of your slices (split by behaviour into
  test/e2e/<use-case>-<behaviour>.e2e.spec.ts when one grows long), and their helpers and worlds in
  test/e2e/support/<context>/.
- You may not write anything else. Shared files (config, src/platform, src/main.ts,
  package.json, lockfile, migrations, docs/) and other contexts are refused by the guard:
  report the need, do not work around it. The shell writes inside your scope only, as the editor tools do:
  a write outside it is refused, and inline code (`node -e`, a heredoc) that changed one stops you. A slice that changes the stored state generates a
  working migration only: `npm run db:generate working-<what-it-does>`. A decision taken in a slice is
  recorded by `generate adr` (without --deviation), and committed with it. The derived files (generated
  documents, barrels, context map, dependency rules) are written by `npm run regenerate`, never by hand.
- Generators you may run: aggregate, builder, entity, value-object, domain-event,
  error, domain-service, command (on an aggregate that has its repository), query,
  port, route, integration-handler, event-handler, acl, e2e, adapter, adr (without --deviation).
  The others are run by the conductor.

Slices, in this order (rows of docs/architecture/slices.md, one or two per agent)
- #<n> <slice>: <generator commands of the row> ; rules: <invariants and failures by name>
  design: <docs/architecture/reviews/<topic>.md (section "#<n> <slice>"), when a document holds part of it>
Names of the design that <main> does not have (checked at <commit>): build on what <main> has,
and put each line in your report as a note for the conductor, who corrects the document.
- <document>:<line> `<name>`: <removed by, refused, or not on <main>; and what <main> has instead>

Contracts you consume (read-only): src/contexts/<upstream>/published-language/

Read first, and only: src/contexts/<context>/CONTEXT.md, then
`npx ddd-ts-kit describe <context> --json`. Then the `next` places each generator prints.

For each slice: generate with --local-only --json, fill the TODO(domain) markers, replace every it.todo
by a test, then `npx ddd-ts-kit verify-slice <context> --since <main>` (regenerate, the rules on your changed
files, the tests of the context, the files near the size limit) until it passes, then stage the paths it lists,
one by one, never one it leaves out, and commit with the command it prints:
`feat(<context>): <slice in business words>` with the trailer `Slice: <row>`.
Format with `npm run format`, then `npm run lint:fix` (a blank line asked after a wrapped line is expected);
never Prettier nor a bare `npx biome`.
To bring the trunk in: `npx ddd-ts-kit merge-trunk --trunk <main>` only, never `git merge` alone, `-X theirs/ours`
or `checkout --theirs/--ours` on a source file. On a stop, resolve each hunk keeping the intent of both sides,
`git add` it, then `npx ddd-ts-kit merge-trunk --continue`: it commits only once no line, row or test is lost.
A spec of a delivered row that a change of this branch broke is adapted in this branch, in a commit of its own.

Budget: one row is one agent's work, two at most. The guard counts your tool calls and warns you twice,
early rather than late: about 30 turns before your limit (finish the slice under way, start no other) and
about 12 before (stop changing code, commit what verify-slice passed, end with your report). Without
these notices (another host), stop after your second slice. Stopping loses nothing: your commits, the files
you leave and your report are read by `worker-scope --resume`. When your context grows long, act as at the
first notice.
Your report is your final message, in the form of the report below; never write a report file.

Done when: every slice is committed, `npm run verify` is green in the worktree (the whole tree:
`check --changed-since` sees your files only), and `npx ddd-ts-kit todo <context>` lists nothing but
`TODO(review)` lines: those remarks of a review are followed by the conductor, leave them. A
`TODO(review)` you write names its row first, `TODO(review): #<row id> <remark>`: `story-check`
holds the story of that row open on it, and no other.

Report, always, even when you stop early, in under 200 words: slices done (commit hashes),
slices not done and why, with the files left modified by an unfinished one, needs on shared
files or on another context's contract, each marked blocking (a slice cannot be finished
without it: a migration, a contract field, a shared file, a dependency) or note (done at the
merge: a permission to grant, a registration), glossary terms added, open business questions.
No code, no file contents.
```

# Changelog

What each version changes for someone who uses the kit. The packages of `packages/` are released
together, under one version; the notes of each [GitHub release](https://github.com/gbourgeat/ddd-ts-kit/releases)
list the pull requests behind it.

## 0.27.0

**The worktrees of a project live inside it, and a new project writes its code in a worktree.**
`worker-scope`, `story-scope` and the new `ddd-ts-kit worktree <name>` (any other piece of work,
on `work/<name>`, cut from `origin/main` when run from the trunk, installed) open their worktree
in `.worktrees/` of the main checkout, whichever worktree they run from, instead of a sibling
folder `../<project>-<name>`; `plan-waves` names `.worktrees/<context>-<batch>`. `init` lists
`.worktrees/` in `.gitignore`, the formatter, ESLint, the checker and the Docker context leave it
out. A new project gets `"worktrees": "required"`: the guard of the plugin refuses the code of a
context and the generators that write it (`context`, `adr` and `acceptance` aside) in the main
checkout of the trunk, and says so at session start with the command that opens a worktree; the
conductor of a parallel build writes its contracts and skeletons in a worktree of its own and
lands them as a pull request. In a worktree of `.worktrees/` without its own `node_modules`,
whose Node would resolve the packages of the main checkout above it, the guard refuses that code
until it is installed. `story-scope` and `worktree` take the remote branch of the trunk as their
base only from the trunk itself: any other branch is its own base.

To move: nothing is required. A project started before has no `worktrees` key, read as
`"advised"`: the guard only says where the code goes. Run `npx ddd-ts-kit init` once to add
`.worktrees/` to `.gitignore` (until then the commands open their worktrees next to the project,
as before, with a note), commit it, and set `"worktrees": "required"` when the team works in
worktrees. Update the plugin, and `@ddd-ts-kit/eslint-plugin` for its ignore of `.worktrees/`;
add `"!**/.worktrees"` to the `files.includes` of `biome.json`. A worktree opened before keeps its
place: `git worktree move <path> .worktrees/<name>` moves it.

**Where the open stories meet, while they are built.** The new command `ddd-ts-kit stories`
lists the stories open in the worktrees of the repository and, for each pair that meets, the
contexts the rows of both name, the files both worktrees change (committed or not, those
`merge-trunk` settles by their kind aside), and what merging the branch of one into the other
would leave to settle by hand and what `merge-trunk` settles alone, computed with
`git merge-tree` without writing anything; for each story, how far it is behind its trunk and
what bringing the trunk in would leave to a person. From the worktree of a story it names the
stories that one meets. The guard of the plugin says it at session start in the worktree of a
story, with the trunk that moved and a last fetch more than an hour old, and says once per file
when the session writes a file another open story changes. `story --gate close` now also waits
for the trunk merged in (the phase `trunk`), and `story-scope` cuts a story from the branch the
current one follows (`origin/main` for `main`) when it has one, so that a `git fetch` is enough
to see the trunk move: nothing of the kit goes to the network. The skill `story` reads
`stories` before cutting the rows and before each row, and fetches before closing.

To move: `npx ddd-ts-kit init` adds the permission of `npx ddd-ts-kit stories`; update the
plugin. A story opened before this version keeps its base: `story-scope` resumes it as it was.

**One session takes one user story to its pull request, one story per terminal.** The new skill
`/ddd-ts-kit:story <code>` (run by the owner) works in the worktree of the story: it asks every
question at once, then without stopping writes `docs/architecture/stories/<code>.md` (statement,
questions and answers, acceptance criteria, decisions), the rows of the story, a design review
section per row in `docs/architecture/reviews/<code>.md` read by `architecture-reviewer`, the
acceptance written and locked; it builds row by row with one `context-builder` agent confined to
one context, merges the trunk in, reviews, verifies, writes `## Report` (each provisional
decision, compromise and amendment) and opens the pull request. New commands:
`ddd-ts-kit story-scope <code>` opens the worktree of a story on `story/<code>` (or finds it
again), refuses a story open in another worktree and names the other open stories with the
contexts they change; `ddd-ts-kit story [<code>] [--gate build|close]` says where a story stands,
phase by phase, and its next step; `worker-scope <context> --here` briefs the next agent inside
the worktree of a story, without a worktree of its own. In the worktree of a story, the guard of
the plugin refuses any code of a context until `story --gate build` passes, says the phase at
session start, and refuses once to end the session before the report. New guide:
[story workflow](docs/guides/story-workflow.md).

To move: update the plugin; `npx ddd-ts-kit init` adds the permissions of `story` and
`story-scope`.

**A story's acceptance tests are written, locked and run before its code, and a locked scenario
changes only with its criterion.** A story states its acceptance criteria in
`docs/architecture/stories/<story>.md` (`- AC1: ...` under `## Acceptance criteria`).
`ddd-ts-kit generate acceptance <story>` writes `test/acceptance/<story>.acceptance.spec.ts`, an
`it.todo` per criterion (per slice row when the story states none), on the support of
`test/e2e/`. Each scenario names the rows that make it pass and the criterion it proves
(`'#US5.02 AC1 ...'`) and runs wrapped in the new `pending(...)` of `@ddd-ts-kit/testing/e2e`:
it passes while an assertion fails, and fails once the scenario passes (the slice removes the
wrapper) or stops on anything but an assertion (the scenario is broken). The new command
`ddd-ts-kit acceptance [<story>]` reads the scenarios against the rows of `slices.md` and the
criteria: `--gate written` before the code (every slice row and criterion covered, nothing left
to write, the acceptance locked), `--gate passing` before the story closes. `--lock` writes
`test/acceptance/<story>.acceptance.lock.json`, the fingerprint of each criterion and scenario
(the wrapper, the layout and the comments aside). Afterwards a criterion changed, or a scenario
changed or removed while its criteria were not, is reported whatever the gate, and locking again
takes a verdict `amend` on that very version from the new `acceptance-judge` agent, which compares
the locked version, the new one, the criterion and the owner's answers
(`test/acceptance/verdicts/*.md`); a refusal wins, and the verdicts become amendments the command
lists for the owner to validate. The guard of the plugin lets a sub-agent only remove
`pending(...)` in an acceptance spec, refuses it `acceptance --lock`, lets the judge alone write a
verdict and nothing else, refuses the lock and the verdicts to any hand edit or shell write, and
refuses an acceptance spec written by hand instead of generated. `verify-slice` stages the
acceptance spec with the slice. The new rule `test/acceptance-black-box` (a warning) refuses an
acceptance spec that imports from the source root anything but the builders and the published
language of a context. The skills `testing`, `use-case`, `plan-slices`, `quality-gate`,
`parallel-work` and the `context-builder` agent follow.

To move: a new project runs its acceptance specs with `npm run test:e2e`; in an existing one, add
`'test/acceptance/**/*.acceptance.spec.ts'` to the `include` of `vitest.e2e.config.ts` (the
`testMatch` of `jest.e2e.config.js`). `npx ddd-ts-kit init` adds the permission of
`npx ddd-ts-kit acceptance *` and the refusal to edit a lock; update the plugin.
`ddd-ts-kit check --rule test/acceptance-black-box` lists the acceptance specs to take up.

**`drizzle-generate --replay` replays only what forks, and refuses to lose a migration edited by
hand.** The replay first reads the history on disk: when the journal lists every migration in
order, each snapshot from the one before, the branch's already follow the trunk, and nothing is
generated again (a name that changes, `working-` dropped, is renamed in place). Otherwise it
deletes the branch's migrations and generates them again on top as before, then compares each
generated one with what the branch had: when drizzle-kit now writes other statements (its SQL was
edited by hand, or the trunk changed what it changes), it puts the migrations folder back as it
found it and refuses, naming the statement that differs; the fix is to generate that migration on
top by hand and write the edit again, after which a replay, or `merge-trunk --continue`, finds
nothing forked. Several migrations of a branch that change the schema and fork are still
refused rather than joined: drizzle-kit diffs the final schema and cannot split them again, and
one migration in their place would join steps planned apart (a table, then a constraint once it
is filled, fails on a database that holds rows). Its fix said to generate them as one; it now
says to generate them again one at a time, in their order. Measured with the real drizzle-kit
0.31.11: the replayed history is applied by `drizzle-kit migrate`.

**`persistence/primary-key-order` (a warning).** Under drizzle-kit, a migration that adds the new
primary key of a table before its old one is dropped, or drops a column before the key that holds
it, is reported on the line of the statement that runs too early: PostgreSQL refuses it when it
runs. `drizzle-generate` already warned once when it wrote one; the rule keeps reporting it. Fix:
drop the old key first, in that migration while it is still unapplied, or write it with
`--custom`. `ddd-ts-kit check --rule persistence/primary-key-order` lists the migrations to take
up; the rule stays a warning in this version.

**Two migrations kept apart.** The `persistence` skill and the persistence page say how: change
the schema in two steps, with a `db:generate` after each, since one `db:generate` writes every
change since the last migration as one.

## 0.26.0

**The guard recognises the CLI of the kit however it is launched.** The refusal of
`worker-scope` to a sub-agent (without `--dry-run` or `--resume`) and the refusal to a worker of a
generator that writes shared files or another context read the command word by word: the
`ddd-ts-kit` binary (`npx`, `npm exec`, `pnpm exec`, `bunx`, `node_modules/.bin`), the entry file
of the CLI run by node (`node .../dist/bin.js`) and the kit script of a project
(`node scripts/kit.mjs`) are held alike; until now only `ddd-ts-kit <command>` was.

**A context-builder is warned before its turn limit, and the conductor resumes a stopped worker
from `worker-scope --resume`.** An agent cannot count its turns, and one that stopped at its limit
left the conductor to inspect the worktree by hand to write the next message. The guard of the
plugin now counts the tool calls of a `context-builder` inside the hooks that already run on its
shell commands and its writes (no hook on every tool call: an ordinary session starts no more
processes) and adds two notices, once a run: finish the slice under way, then stop changing code,
commit what passed and end with the report. It records the agent's runs in its worktree
(`.ddd-ts-kit/agent.json`), restarts the count at each launch or resume (`SubagentStart`), and,
when the agent ends on its own (`SubagentStop`), keeps it going once to commit a slice that passed
`verify-slice` or to rewrite a stale report; both hooks are filtered by the agent. In a worker's
worktree, `verify-slice` prints the exact commit command with the trailer `Slice: <row>` and keeps
its result in `.ddd-ts-kit/verification.json`. `status --workers` adds a `state:` line per worker
(`progress` in JSON), and `worker-scope <context> --resume` reads where a stopped worker stands
and prints the `SendMessage` text for its agent, or the briefing of a new agent holding the row
under way only and the files left. A session start names the workers to resume. `worker-scope`
without `--rows` now briefs the first batch `plan-waves` cuts for the context (one or two rows),
with a note naming the next, and the briefing carries the turn budget. The parallel-work skill
says what to do on each kind of stop, with a limit of two stops on one row.

To move: update the plugin; the conductor's skill may now use `SendMessage`. A worker briefed
before this version commits without the trailer: its rows are matched in order with its
`feat(<context>)` commits and shown `(by order)`.

**`story-check` says whether a story or a milestone can close.** The kit said that a slice may
merge with `TODO(review)` markers while a story closes only once none of its own is left; nothing
checked it. `npx ddd-ts-kit story-check <code>` (`M1` for the rows `M1.01`, `M1.02`: the id
without its last `.<number>`) exits 0 when every row of the story is `done` in
`docs/architecture/slices.md` and no marker of its own is left, 1 listing the rows not done with
their status and each marker that keeps it open, with why it is the story's, its `file:line` and
its fix (handle it, or dismiss it by a decision record with `generate adr`, then delete the
marker), and 2 on a code no row carries or without a slices table. Since several stories often
build one context at once, a `TODO(domain)`, `TODO(platform)`, `it.todo` or `TODO(review)` is
attributed before it blocks: to the rows its text names (`#M1.03` or `M1.03`), else to the rows
the commit that wrote its line names (`git blame`, once per file: its `Slice: <id>` trailer, else
the ids its message names), else, not committed in a worker's worktree, to the rows of
`.ddd-ts-kit/worker.json`. A marker of a context that belongs to no row blocks only when no other
open story has a row in that context, and is listed without blocking otherwise; `--strict` blocks
on every marker of the story's contexts. `status` adds a line for a story whose rows are all done
while markers of its own keep it open (`story M1: every row done, 3 markers left: npx ddd-ts-kit
story-check M1`, `slices.unclosed` in `--json`), and `init` allows `story-check` to the agent. The
plan-slices, quality-gate and parallel-work skills and the architecture-reviewer agent run it
before a story or a milestone is declared closed, and the review now writes each non-blocking
remark as `TODO(review): #<row id> <remark>`.

To move: `npx ddd-ts-kit init` adds the permission to `.claude/settings.json` (`doctor` names it
while it is missing). Name the row in the `TODO(review)` markers already written
(`TODO(review): #M1.03 <remark>`) so that each is held against its own story.

**`language/declared-vocabulary` accepts a word of another language when its type says so.**
A context that reads a published payload or an outside record meets words that spell a value of
its own vocabulary (catalog publishes a `state` of `'draft' | 'issued'`, billing declares
`InvoiceStatus` with the same strings); the checker and ESLint reported them, and the only way out
was to write `InvoiceStatus.Issued` for a word of catalog. Outside `domain/`, such a word is no
longer judged when its type says which language it belongs to: a key of a table typed
`Record<T, ..>`, a value of one typed `Record<.., T>` (by an annotation or `satisfies`), or a
literal written `'issued' satisfies T`, `T` being one type imported from a published language,
imported as a type from a package, or imported from or declared in
`infrastructure/anti-corruption/` or `infrastructure/external/`; there, the literal types of an
interface or a type alias that describe an outside record are not judged either. The compiler
holds the spelling of such a word. A key of a table typed by the vocabulary of the context, a
comparison or a `case` without `satisfies` and a value of the context in a translation table are
still reported, and in a file that reads another language the fix names the types it reads from
there and how to type the literal by one (ESLint message `rawBesideOtherLanguage`).

Nothing to move: the rule only reports less. A workaround such as
`[InvoiceStatus.Issued]: InvoiceStatus.Issued` in a table keyed by a foreign type can be written
with the foreign word again, `'issued': InvoiceStatus.Issued`.

**The git hooks run in every worktree, and fail loudly where they cannot.** The `lefthook.yml`
that `init` writes starts with `lefthook: node_modules/.bin/lefthook`. The hooks of a repository
are shared by all its worktrees; until now the hook script held the absolute path of the lefthook
of whichever checkout installed it last, then fell back to other launchers. Once that checkout was
removed, a worktree without its dependencies skipped every check silently, or had pnpm install
the project inside it. Now each checkout runs its own lefthook, and one without its dependencies
fails the commit with `node_modules/.bin/lefthook: not found`. The repository of the kit does the
same.

**`worker-scope` installs the dependencies of the worktree it creates.** It runs the clean install
of the package manager of the project there (`npm ci`, `pnpm install --frozen-lockfile`),
quietly, and its notes say how long it took. When the install fails, the note gives the end of
its output and what to run; `--no-install` leaves the install out, with the same note.
`--dry-run` and a worktree it keeps install nothing.

**`doctor` checks the git hooks.** Under a new area, `hook`: a `lefthook.yml` without the
`lefthook:` line (missing, fails `--strict`), and a pre-commit hook this clone has not installed,
or that lefthook did not write (said, never failing `--strict`: it is a state of one clone).
Outside a git repository only the file is judged.

**`status --workers` says which worktree lacks its dependencies.** `dependencies not installed`
in the line of a worker whose copy of the project has no `node_modules`; `installed` in `--json`.

**The guard holds the shell of a worker to its scope.** For a `context-builder` agent with its
`.ddd-ts-kit/worker.json`, a file the shell writes by name is judged as a write of the Edit and
Write tools: an in-place edit (`sed -i`, `perl -i`), a redirection (`>`, `>>`, `&>`) or `tee`
pass inside the scope of the worker and are refused outside it (a shared file, another context,
a generated file, another checkout) or on a path only the shell knows (`"$FILE"`); so are `cp`,
`mv`, `rm`, `touch`, `truncate`, `dd`, `install`, `ln`, `find -delete`, `git checkout -- <path>`,
`git restore`, `git rm`, `git mv` and `git clean` outside its scope, and `git apply` and `patch`
always. Inline code given to an interpreter (`node -e`, `python3 -c`, `-` or a heredoc) cannot be
read in advance: it runs, the guard notes the files outside the scope before it, and at the next
command or write of that worker a file it changed there stops the worker until it is put back,
with the `git restore` or `rm` the refusal names, allowed for those files only. Commands nested
in `bash -c`, `eval`, `$(...)`, `xargs` and `find -exec` are read the same way. Output to
`/dev/null`, a descriptor (`2>&1`) or a path out of any project (the system temp directory)
stays free, and so does a heredoc fed to git (`git commit -F - <<EOF`). The conductor and the
other agents are not held to it.

**The guard refuses a worker another formatter.** `npx prettier` in a project whose `format`
script runs Biome, and a bare `npx biome` (without `--no`: it can run an unrelated package of the
registry named biome, which formats nothing), are refused with "format with `npm run format`
only, then `npm run lint:fix`".

**The guard reads a dependency change wherever its flags stand.** `npm i -D zod`,
`npm install --save-dev zod`, `pnpm add -D zod`, `yarn add --dev zod`, `npm i zod@1 --save-exact`
are refused to a worker like `npm i zod`; `npm ci`, `npm install` and
`pnpm install --frozen-lockfile` stay free. At session start, a worktree whose `package.json`
already lists the kit but has no `node_modules` is told to run the clean install, not to install
the kit.

**Format, then lint.** The briefing of a worker, the `context-builder` agent and the `quality-gate`
and `clean-code` skills say `npm run format`, then `npm run lint:fix`: when Biome wraps a long
line, the lint then asks for a blank line around it, and that finding is expected.

**A new project has no warning on its first commit.** The `vitest.config.ts` that `init` writes
declared its two projects inside the function of `defineConfig`, 32 lines long against the limit
of 30 of `clean/function-size`. They are constants of the file now.

To move:

- add `lefthook: node_modules/.bin/lefthook` at the top of `lefthook.yml` (or
  `npx ddd-ts-kit init --force` writes the kit's file over yours), then `npm run hooks:install`
  once per clone; `npx ddd-ts-kit doctor` says whether it is done;
- `worker-scope` now installs the dependencies of a new worktree: drop an `npm ci` you ran after
  it, or pass `--no-install` to keep doing it yourself;
- optional: the `vitest.config.ts` of a project generated before can take the same shape
  (`npm run lint` warns `ddd-ts-kit/clean-function-size` on it while it is over the limit).

**`cited` reports the names of a row's design that the trunk removed or renamed.** The design of
a row is its `Slice` and `Start with` cells and its rule lines in `slices.md`, the section of a
document of `docs/architecture/` whose heading names the row, and a document that names it or that
its rule line links to (by convention a design review in `docs/architecture/reviews/<topic>.md`,
one `## #<id> <slice>` heading per row). `npx ddd-ts-kit cited [<context>] [--rows <id,...>]
[--base <ref>]` reads the names it cites as code (paths, classes, `Class.member`) against the
ref, from git, and reports only what has evidence: a name its history removed, with the commit and
what replaced it (the file it was renamed to, a file the same commit added); a place the canonical
tree refuses; a name never there when a close name of the same part (a port for a service) arrived
after the line was written. A planned name stays silent, and so does a name whose sentence says
it was removed. `--removed-since <ref>` lists instead the names a change removes that such a
design still cites. It reads only and exits 0; `init` allows `npx ddd-ts-kit cited *` to agents.

**`worker-scope` and `verify-slice` read the design of the rows.** The briefing names, under each
row, the documents of its design, then the names the base does not have (eight lines at most,
the rest in `--json` under `citations`), and the conductor gets a note naming the lines to correct
on the trunk; a local base behind its upstream and a shallow clone are noted. `verify-slice` ends
with the names the slice removes that the design of a row not done still cites, the worker's own
rows left out: informational, it never fails on them.

**`tree/documented-paths` judges paths written relative to a context.** A path of
`docs/architecture/` that starts with `domain/`, `application/`, `infrastructure/`,
`presentation/` or `published-language/` is judged in every declared context, their extra
directories considered, and reported when every one of them refuses it. The rule stays a warning.

To move: `npx ddd-ts-kit check --rule tree/documented-paths` lists the paths of
`docs/architecture/` the canonical tree refuses, the context-relative ones included: write the
place the code has now. Before building a row designed in a document, run
`npx ddd-ts-kit cited --rows <id> --base origin/main`, and correct the names it reports on the
trunk. `npx ddd-ts-kit init` (or `doctor`) adds the permission of `cited` to the agent settings.

**`verify-merge` reports the lines, rows and tests a merge lost.** `npx ddd-ts-kit verify-merge`
reads git only and checks every merge commit since the trunk (the base of
`.ddd-ts-kit/worker.json`, then `origin/HEAD`, then `origin/main`, or `--since`) and the merge in
progress, or one named commit; a squash commit takes `--theirs <branch head>`. It reports as
errors a line one side added (or both kept) that the result lacks, a file neither side deleted
gone from the result, a row of `slices.md` done on one side and no longer done, a test or spec
file of one side gone, a migration whose description the result lacks, a conflict marker. As
warnings: a line one side removed and the merge brought back; a line one side wrote where the
other side changed the same lines, inside a block it deleted or in a file it deleted (the merge
chose between them); a line the merge replaced by lines of its own. A line laid out again, moved
to another file or an import merged into one statement is not a loss; derived files, files a
tool says it wrote, migrations and lockfiles are left out of the lines. The base is `--base`,
else a `Merge-Base:` trailer, else `git merge-base`; a `Lost-Accepted: <file:line>,...` trailer
records a removal decided on purpose, listed without failing, and a loss a later commit restored
is listed as repaired. Silent and exit 0 without a merge, exit 1 on an error, `--json` for data.

**`verify-merge` reaches projects as a warning first.** It is an estimate: on 150 merges that
resolved conflicts in three public projects, one in five still reported an error, most of them a
change of one branch dropped on purpose because the other branch had replaced the feature. So in
this version `--warn` prints the same report and exits 0, the pre-push hook of `init` runs
`npx --no -- ddd-ts-kit verify-merge --warn` (lefthook shows its output), and `verify-slice`
reports the merges since `--since` in a step of their own, `merges since <since>`, without
failing the slice. A later minor version makes the hook and `verify-slice` block on an error;
`verify-merge` run alone already exits 1 on one.

**`.ddd-ts-kit/worker.json` records the commit of the base.** `worker-scope` writes `baseCommit`,
the commit the base names when it creates or keeps the worktree, next to `base`, a moving name.
Readers accept a file without it.

**The guard refuses to a sub-agent the commands that take one side of a merge.** `git merge` or
`git pull` with `-X theirs`, `-X ours` or `-s ours`, and `git checkout` or `git restore` with
`--theirs` or `--ours` on a path under the source root or the tests, are refused to a sub-agent
with the way to resolve each hunk and `verify-merge`. A derived file outside the sources
(`openapi/`, the context map) is not judged by this rule: the conductor takes either side and
regenerates, and a worker leaves it to the conductor, its scope ending at its context. The
briefing of `worker-scope`, the parallel-work skill and the `context-builder` agent say the same.

To move: `npx ddd-ts-kit init --force` writes the pre-push job into `lefthook.yml` and the agent
permissions `Bash(npx ddd-ts-kit verify-merge)` and `Bash(npx ddd-ts-kit verify-merge *)`
(`npx ddd-ts-kit doctor` lists what is missing). Read what the hook prints after a merge of the
trunk: each error is a loss to restore, or a decision to record in the merge commit with
`Lost-Accepted:`, before a later version blocks the push on it. A worktree prepared by an older
version has no `baseCommit` until `worker-scope` runs again for it; nothing reads it yet.

**`merge-trunk` brings the trunk into a branch from its own diff, settles what a kit derives and
checks that no line was lost.** `npx ddd-ts-kit merge-trunk` makes one merge commit, never a
rebase. It finds the newest commit of the branch the trunk already holds: a squash merge is
recognised by patch id (derived files, migrations, `slices.md`, `plan.md` and lockfiles left out),
on the branch, on the branch it was stacked on, or on a local branch sharing commits with it;
else the base worker-scope recorded, when its lines are on the trunk; else `git merge-base`
(`--since <commit>` overrides). From there `git merge-tree` computes the merge, so a branch reused
after its first row landed, or stacked on a branch squash-merged since, no longer conflicts on
what landed nor keeps a working migration next to the real one. Derived files, the generated
regions of `CONTEXT.md` and of the context map, conflicts inside generated registries, the rows
of `slices.md`, the drizzle-kit journal, the lockfile and the stored-events lock are settled
without a person; the rest stays a merge in progress git understands, with what each side did in
each hunk (exit 1), and `--continue` goes on. Then the drizzle migrations of both sides are
replayed, decision records renumbered, `regenerate` runs, `verify-merge` checks the uncommitted
result (an error stops it; `--accept-lost` records a `Lost-Accepted:` trailer), and the paths of
the merge alone are committed with the trailers `Merge-Base:`, `Trunk:` and `Landed:`.
`--dry-run` previews, `--abort` undoes. The report says how many files a plain `git merge` would
leave conflicted against the branch's own diff; `--json` gives the same.

**`merge-trunk --to-land` gives the migrations of a branch their real names before its squash
merge.** Under drizzle-kit the replay drops `working-` even in the worktree of a worker; under
knex, Prisma and TypeORM each migration of the branch the trunk does not have is renamed after the
trunk's last, its content kept (TypeORM's class and `name`, Prisma's folder), and the merge stops
when a migration the trunk gained and one of the branch change the same table. The guard of the
plugin refuses `--to-land` to a sub-agent, however it launches the CLI: it is the conductor's step. `plan-waves` ends with what
runs before each merge.

**`status` counts a worker's branch from where it landed.** Once a branch was squash-merged into
its base, `status --workers` shows the commit that took it in (`landed`), counts its commits ahead
and its files from there (no stale count, no false overlap with what landed), and adds its commits
behind and what `merge-trunk` would leave conflicted now (`behind`, `mergePreview`). A row that
landed with a branch is no longer counted on its way, and `status` names a landed row the slices
file of the trunk does not mark done.

**A worker brings the trunk in with `merge-trunk`, never with `git merge` alone.** The briefing of
`worker-scope`, the parallel-work skill, the briefing template and the `context-builder` agent say
so; the guard's refusal of `-X theirs` and `checkout --theirs` points to `merge-trunk --continue`,
and `worker-scope` refusing a worktree that does not contain its base gives the `merge-trunk` that
brings it in.

To move: `npx ddd-ts-kit init --force` (or `doctor`) adds the agent permissions
`Bash(npx ddd-ts-kit merge-trunk)` and `Bash(npx ddd-ts-kit merge-trunk *)`. Bring the trunk into a
branch with `npx ddd-ts-kit merge-trunk` from now on, and run `merge-trunk --to-land --cwd
<worktree>` before each squash merge of a worker's branch. It needs git 2.40; an older git merges
only from `git merge-base`.

## 0.25.1

**The places that teach how a spec builds its test application point to worlds.** The command
handler specs `generate` writes say, in their `TODO(domain)`, that `generate test-world <context>`
writes the arrangement once in `test/worlds/` when several specs of the context share it; the
`wiring` and `use-case` skills, `docs/tools/dependency-injection.md` and the README of
`@ddd-ts-kit/di` say the same where a reader writes that arrangement.

**The example application arranges through worlds.** `identity` and `notification` get their
world, and 42 handler, projection and integration handler specs take their test application from
the world of their context, their starting data in `given`. A spec keeps its own setup when it
builds what a world does not: a database wired by hand, a handler built by hand, a fake with
constructor arguments, a platform port.

Nothing to move: specs already written keep working; a project takes a world when its specs
repeat the same arrangement.

## 0.25.0

**`generate test-world` gives the shared arrangement of a context its place, `test/worlds/`.**
`npx ddd-ts-kit generate test-world <context> [Name]` writes `test/worlds/<name>.world.ts`, the
name defaulting to the context: `a<Name>World({ now, idPrefix, given })` reads the fakes of
`test/fakes/` and the port each one implements, builds them, hands them to `given` so that a spec
stores what it starts from, then to the test application (`modules` adds the authorization of the
spec) or, wired by hand, to the buses of `createTestBuses`, each repository wrapped by
`dispatching`; it returns every fake under the name of its port. A fake that needs constructor
arguments, or, under a container, the fake of a port nothing binds or depends on yet, is left out
with a note. `test/worlds/` (`*.world.ts`) joins the canonical tree; `list` and `describe` name
the worlds of each context, and the import graph (rewritten by the next `generate`) and the knip
config of a new project keep a world no spec imports yet, as they keep a fake.
The identity preset writes its shared arrangement in `test/worlds/<context>.world.ts`, and three
handler specs of the example application use the world of `scheduling`.

**`test/helper-placed` (a warning).** A `.ts` file of a context's `test/unit/` or
`test/integration/` that is not a spec (`*.spec.ts`, `*.test.ts`) is reported: an arrangement
several specs share goes to `test/worlds/`, test data to `test/builders/`, an in-memory port to
`test/fakes/`.

To move: `npx ddd-ts-kit check --rule test/helper-placed` lists the helpers written among the
specs; move each to its place, or replace a shared arrange function by the world `generate
test-world` writes. A project created by the identity preset moves
`test/unit/identity-application.ts` to `test/worlds/<context>.world.ts` and updates the imports of
its specs.

## 0.24.0

**`plan-waves` orders the work, and `status` says when a row can start.** `npx ddd-ts-kit
plan-waves [<context>]` reads the rows of `slices.md` not done and gives waves (the rows whose
dependencies are done, then the rows waiting only for earlier waves), batches of one or two rows
per owner, the batches of one context and one wave that touch the same aggregate, the
`worker-scope` command that briefs each batch, and a merge order. A cycle, an unknown dependency,
a row without owner or an id used twice is reported alone. `status` gives each row not done its
readiness: on the trunk, on a branch (its dependencies are rows of a worker whose worktree has
commits), or waiting, with what it waits for.

**`drizzle-generate` formats, warns and replays.** After a migration, it formats the files it wrote
under `meta/` with the formatter the `format` script names (Biome or Prettier), and warns when the
SQL changes a primary key in an order PostgreSQL refuses. `npx ddd-ts-kit drizzle-generate --replay
[--base <ref>]`, run on a branch after merging the trunk, deletes the branch's migrations the base
does not have and generates them again on top of the trunk's last snapshot, with their names; the
`persistence` and `parallel-work` skills use it at the merge. It is Drizzle's only.

**Each spec opens a copy of a started test database.** With Vitest on an ORM, a global setup starts
PGlite once and saves it; every integration spec opens a copy and creates its tables there, so the
slow start is paid once per run and the code that creates the tables still counts in the coverage
of each context. `settled()` of `@ddd-ts-kit/testing/e2e`,
and `application.settled()` of the generated end-to-end support, wait until the outbox has nothing
pending instead of a fixed delay, and fail with what is still pending.

**`tree/documented-paths` (a warning).** A path of a context cited as code in a Markdown file of
`docs/architecture/` is judged as `tree/closed` judges a file: a plan, a design note or a review
that names a directory the canonical tree refuses describes a design the code no longer has. A path
that does not exist yet is not reported.

To move: `npx ddd-ts-kit check` reports, as a warning, the paths of `docs/architecture/` the tree
refuses: write the place the code has now. To take the test database template in an existing
project, regenerate `vitest.config.ts`, `vitest.e2e.config.ts`,
`src/platform/database/open-test-database.ts` and `test/e2e/support/start-application.ts`
(`npx ddd-ts-kit init --force`, which rewrites every file of the platform); plain `npx ddd-ts-kit
init` adds the setup file and the rest keeps working as before.

## 0.23.1

**`verify-slice` proposes to stage the paths of the slice only.** In 0.23.0 it listed every path
`git status` reported in the repository as the paths to commit: a file of another context or of
the platform, an editor's folder, notes or a document left at the root of a shared checkout. The
list is now closed: the files of the context, an end-to-end spec of `test/e2e/`, a working
migration with its snapshot and the journal, and the derived files `regenerate` rewrites when git
already tracks them. Every other changed path is listed as left out, never to stage with the
slice; `--json` gives `toStage` and `leftOut`. The briefing and the `context-builder` agent say
that a path left out is never staged nor deleted. Upgrade from 0.23.0 now.

**`doctor` lists what an upgrade left to do.** `npx ddd-ts-kit doctor` compares the project with
what the installed version writes: the scripts of `package.json` (missing, or written otherwise),
the packages of the kit (missing, or at another range) and the permissions of
`.claude/settings.json` (missing). `npx ddd-ts-kit init` adds what is missing and leaves what the
project wrote. `--strict` exits 1 while something is missing. The version gap the plugin says at
session start points to it.

**`clean/function-size` does not count one parameter typed `Actor` or `Date`.** Who acts and when
are the context of an intention rather than its input: `invoice.issue(lines, customer, actor,
now)` counts three. The rule reports less, never more.

## 0.23.0

**A domain event declares its name once, with `NamedDomainEvent`.** `export class InvoiceIssued
extends NamedDomainEvent('billing.invoice.issued') { .. }` gives the class `eventName` and each
instance `name`, both typed with the literal, in place of the two lines `static readonly eventName`
and `readonly name = X.eventName`. The generators and the identity preset write it; the rules and
generators that read an event's name recognise it. The former form stays accepted.

**`verify-slice` closes a slice in one run.** `npx ddd-ts-kit verify-slice <context> --since
<trunk>` runs the `regenerate` script, the architecture rules on the files changed since the trunk
(new files included) and the `test` script for the context, then names the changed files past 300
of the 350 lines and the paths to stage, one by one. Every step runs, so one answer says all that is
left; it exits 1 while a step fails. The briefing of `worker-scope` and the `context-builder` agent
use it in place of three commands. It needs the `regenerate` script of 0.21: run
`npx ddd-ts-kit init --force` if it is missing.

**`status --workers` shows who builds what.** For each git worktree that `worker-scope` prepared:
its branch, context, rows, base, commits ahead, the files it changed and its report; then the files
more than one worker changed, where the second merge will conflict. `worker-scope` now writes the
rows, the base and the branch in `.ddd-ts-kit/worker.json`. `parallel-work` has the conductor run
it before briefing a second worker in a context and before each merge, and says how a stacked
branch moves its own commits onto the trunk after a squash merge.

**A non-blocking review remark is a `TODO(review)` marker.** `architecture-reviewer` sorts its
findings into blocking and non-blocking, and gives each non-blocking one its `file:line` and the
marker line to write there. `todo` lists `TODO(review)`, `status` counts it per context. A slice
may merge with such markers; a story or a milestone is closed when none is left, each handled or
dismissed by a decision record.

**Slices are numbered within their story.** `plan-slices` gives each row the code of its story or
milestone and a number within it (`US5.03`, `M2.07`), never one sequence across stories, and an id
is never renumbered. `status` names a bare number. A rule line under the slices tables may omit the
`#` (`- 5.01: ..`): `worker-scope` reads it. A slice that changes a behaviour already delivered
adapts its tests in the same row. The example application numbers its rows `M1.01` to `M1.39`.

**The briefing of a worker says what blocks.** A worker marks each need of its report blocking (a
migration, a contract field, a shared file, a dependency) or a note for the merge, and the run goes
on for a note. It records a decision of its own slices with `generate adr` (without `--deviation`,
which stays the conductor's), formats with `npm run format` only, and is done when `npm run verify`
passes on the whole tree. The conductor merges the trunk into a branch before its review and
`verify`. Only the conductor prepares a worktree: the guard refuses `worker-scope` without
`--dry-run` to a sub-agent.

**`check --changed-since` judges the new files.** A file git does not track yet, as a generator
just wrote it, was left out until it was staged; it is judged now.

**`clean/file-size` judges `test/` and `scripts/`, and tells an aggregate how to shrink.**
`ddd-ts-kit check` now holds the end-to-end specs and the scripts to the 350 lines, as the ESLint
rule already did in the lint gate. For an aggregate past the limit, the fix names a domain service
that returns the new state and its events, which the aggregate applies, or a value object; never a
public setter.

**`language/declared-vocabulary` leaves the storage names alone.** In `infrastructure/persistence/`,
the name of a column, a table or a schema (the first argument of a call, `name`, `tableName`,
`schema`) is no longer taken for a value of a vocabulary; a stored value (`.default(..)`, a value
compared in a query) still is.

To move: run `npx ddd-ts-kit init --force`, which adds the `regenerate` script when it is missing
and allows `verify-slice` to agents in `.claude/settings.json`; run
`npx ddd-ts-kit check` once and split each file of `test/` or `scripts/` it reports past 350 lines
(the lint gate already refused them).

## 0.22.0

**A context builder keeps its report current and regenerates with each slice.** The
`context-builder` agent has 150 turns instead of 80, and after each step of a slice it rewrites
`.ddd-ts-kit/report.md` in its worktree, in the form of its final report: an agent that stops
early leaves its state there, and `parallel-work` tells the conductor to read it. The guard lets a
worker write that one file. After each slice the worker runs `npm run regenerate` and commits the
derived files with it, as the briefing of `worker-scope` now says: they were left to the conductor,
so a worker stopped on "regenerate" and the run stopped with it. The agent never shortens a
comment, a test or a written rule to stay under a size limit: it extracts instead.

**`generate event-handler` and `generate integration-handler` take `--name <Name>`.** A reaction
was named after the event it handles; when the design names it after what it does in its context,
`--name` gives that name to the file, the class, the spec and the registration, and for an
integration handler to its consumer name and its system actor. The name passes the same checks
as any concept of the context (`--term`, `--allow-name`). Without it, nothing changes.

**`clean/function-size` names the fix.** More than three parameters: group them in a typed props
object or a value object (`Invoice.draft({ ... })`), never a fourth parameter. A `describe`
past the 100-line ceiling: one top-level `describe` per behaviour, in the same file. The ESLint
rule no longer takes production code such as `context.run(callback)` for a group of tests: such a
callback is now held to the limit of a function, and may be reported where it was not.

## 0.21.0

**A rule can be set for some files only, and a rule off everywhere is said.** `rules.<id>` in
`ddd-ts-kit.config.json` also takes `{ "severity": "error" | "warn" | "off", "files": ["<glob>"] }`:
a finding on a matching file takes that severity, every other file keeps the one of the project.
The ESLint preset applies the same setting to the same files. A lowered setting still needs its
`deviations` entry. The new rule `config/rule-off-everywhere` (a warning) reports a bare `"off"`,
which hides every finding of the rule and not only the ones its exception was about. To move,
narrow each reported rule to the files it is about, or write `"files": ["**"]` when the whole
project is meant.

**The generated barrel of a context is not judged by `clean/file-size`.** `<context>.declarations.ts`
and `<context>.dependencies.ts`, at the root of their context, are written by the kit and may grow
past 350 lines; a project no longer has to turn the rule off for them. A file of the same name
elsewhere is still judged. To move, remove an exception you wrote for them.

**`worker-scope` briefs one batch, from a checked base.** `--base <ref>` cuts the worktree from
that ref (`origin/main`) and gives it as the trunk of the checks; `--rows <id,...>` limits the
briefing to those rows of `slices.md`, in that order. Without `--base`, the command refuses to run
from a worker's worktree, and an existing worktree or branch that does not contain the base is
refused with the fix. The `rules:` of a row is filled from the line of rules that `plan-slices`
writes under the table. The `context-builder` agent takes one or two rows, keeps its last turns for
its report and never ends without it; `architecture-reviewer` keeps turns for its verdict.

**A worker may generate a working migration.** `npm run db:generate working-<what>` in a worker's
worktree is allowed by the guard, and `persistence/migration-history` accepts it there, so a branch
that changes the stored state is green alone. On the trunk the same file is reported: at the merge
the conductor deletes it and generates the real one (`parallel-work`, merge step). Any other
migration stays refused to a worker.

**`db:generate` under drizzle-kit no longer waits or pretends.** Without a terminal, drizzle-kit
refused its rename question, wrote no migration and exited 0; under a pseudo-terminal it waited
for an answer. `db:generate` is now `ddd-ts-kit drizzle-generate --name`: in a terminal it is
`drizzle-kit generate` as before; without one, those two silent failures exit 2 with the fix (split
the rename, or write a custom migration). To move, in a Drizzle project, set the `db:generate`
script to `ddd-ts-kit drizzle-generate --name`, or run `npx ddd-ts-kit init --force`.

**One `regenerate` script for every derived file.** `npm run regenerate` runs
`ddd-ts-kit depcruise-config --write` then `npm run docs:generate` (the context documents, the
barrels, the OpenAPI and event documents, the clients): the one step after a change of route,
schema, event or config. To move, run `npx ddd-ts-kit init --force` after the upgrade, which adds
the script and allows it to agents.

**`generate adr` takes `--number <n>`.** A team that numbers its decision records by block
(`0401` for one story, `0701` for another) chooses the number instead of taking the highest plus
one. The number goes to the file, the `# ADR-NNNN` title and the `deviations` entry; a number
already taken, or one that is not a number, is refused.

**Where a shared type, a pure function and a strategy live in the domain.** `docs/ARCHITECTURE.md`
says it, with no new directory: a side-effect-free function on one value is a method of that value
object, a computation over several is a domain service, a shape of business data is a value object,
an interchangeable rule is an abstract class of `domain/services/` with its implementations.
`test/spec-required` no longer asks a spec of a file that exports abstract classes only; each
implementation keeps its own.

**The integration specs of a generated project give the test database a minute to open.** Their
hooks had the default 10 seconds of Vitest, which opening PGlite outlasted under coverage on a busy
machine. To move, add `hookTimeout: 60_000` to the `integration` project of `vitest.config.ts`, or
run `npx ddd-ts-kit init --force`.

## 0.20.0

**A permission no role holds is said.** In a project whose rights are roles (`stack.authz`
`rbac`), `authz/granted` (`ddd-ts-kit check`) reports each permission a context declares that no
role names in `platform/auth/roles.ts`, nor `platform/auth/signed-in-grants.ts`: the super-admin
`*` was the only one to reach it, so the checks stayed green and every other person was refused
at run time. It is a warning: `check` does not fail on it. A grant counts by the entry of the set
(`billingPermissions['invoice.issue']`), by the id (`'billing:invoice.issue'`) or by the wildcard
of the context (`'billing:*'`); a grant to `Role.System`, written by `generate job`, counts too.
The rule is silent under attributes, relationships or an authorizer of the project's own.

**`generate command`, `query` and `file-upload` take `--grant <role>`.** With `--permission`, it
writes the grant in `platform/auth/roles.ts` and adds the role to `platform/auth/role.ts` when it
is new. It is refused with `--public`, and when the rights are not roles. Without it, a `next`
step points at the roles to edit. `init --force` writes the roles from their template again, and
the warning names the grants to give back. To move, run `ddd-ts-kit check --rule authz/granted`
and grant each permission it lists to the roles that hold it, by the entry of its set, in
`roles.ts`; a permission meant for administrators only is granted to `Role.Admin` by name. A
context worker never passes `--grant` (`--local-only` refuses it): the conductor grants on the
trunk.

## 0.19.0

**`status` and `worker-scope` read every slices table.** `docs/architecture/slices.md` may plan
the work in several tables, one per milestone or story, under the same header: only the first was
read, so `status` counted a part of the plan and a worker started on a later table got an empty
briefing. Every table is now read, in the order of the file, and `status` names a row number that
more than one row carries (`duplicates` in `--json`).

**The notes travel with the CLI, and a version gap is said.** The `ddd-ts-kit` package ships this
file, so an agent finds the steps of a version in `node_modules/ddd-ts-kit/CHANGELOG.md`, offline.
The plugin states the version of the packages its skills describe: when the installed
`ddd-ts-kit` is another one (below 1.0.0, another minor version), the session start says so and
what to do, upgrade the packages together or update the plugin. It never blocks.

**Every domain event declares its name once, consumed or not.** `events/name-declared-once`
(`ddd-ts-kit check`) reports a class of `domain/events/` without `static readonly eventName`, and
one whose `readonly name` writes the name again instead of reading it. Until now an event that no
handler or projection reacted to could keep the form 0.5 wrote, `readonly name = '..'` alone, and
the first reaction attached to it failed to compile. To move, give each reported class
`static readonly eventName = '<context>.<aggregate>.<fact>'` and `readonly name = <Event>.eventName`.

## 0.18.0

**The tenant check of `RoleBasedAuthorizer` follows memberships and the tenant of the work.**
With `tenantOf`, an actor of several tenants (its `tenants`, from a list claim or the
`organization` claim of Keycloak) was refused in each of its own tenants and listed nothing, and
a system actor of a per-tenant job was refused in the tenant it ran for. The guard of the bus and
`PolicyAccess` now give the authorizer the tenant of the work (`workTenantId` on `CheckRequest`
and `ListRequest`), read from the execution scope that `authorizationModule` wires. A request is
refused when the actor does not belong to the tenant it targets, when that target is not a tenant
id, and when it is another tenant than the one the work runs in; a system actor belongs to the
tenant its work runs in. A list is filtered on the tenant of the work, and is empty for an actor
of several tenants outside of a tenant's work. `RoleBasedAuthorizer` now refuses at construction
a cross-tenant role or a system role that no role declares, and `crossTenantRoles` without
`tenantOf`: each silently did nothing. To move, declare the role named by `systemRole` or
`crossTenantRoles` in `roles`, and give `tenantOf: tenantOfContext` where `crossTenantRoles` is
set. `authorizationMiddleware` and `PolicyAccess` built by hand take the `scope` option to do the
same.

**A policy is asked, or the use case fails.** The bus decides the permission of a use case before
its handler runs, with the identifier of the element at most; a policy, the part of the right
that needs the element, applies only when the handler asks `Access` once the element is loaded.
Forgetting to ask is now caught twice. `authz/policy-asked` (`ddd-ts-kit check`) reports the
handler of a command or query whose permission a policy refines (`@Policy` or `definePolicy`)
when it never asks `Access` about that permission. At run time, `authorizationModule` refuses the
result of such a handler with `PolicyNotAskedError`, inside the unit of work, so that its change
is rolled back: the guard gains a step that wraps the handler alone, `UseCaseGuard.within`, which
the buses of `kernelModule()` run with `aroundHandler`, a new method of the in-process buses that
places a middleware right around the handler, inside every other one: a middleware that answers
in place of the handler, as a spec that records the commands a job sends, is not judged. Without
the container, `policiesAskedMiddleware({ map, refined })` is the same check. The generators
follow: a command or a plain query generated once a policy refines its permission receives
`Access` and asks it, about the message until the element is loaded, with a `TODO(domain)` to
ask about that element instead; `generate policy` writes a use case of its permission again that
way when its files are still as generated, and otherwise leaves a `TODO(domain)` where the policy
is asked, which the rule accepts and `ddd-ts-kit todo` lists.

To move: a handler whose permission a policy refines calls `await this.access.authorize(actor,
permission, element)` before its change; `npx ddd-ts-kit check --rule authz/policy-asked` lists
the ones that do not. A project that binds its own `Access` instead of `PolicyAccess` passes
`policiesAsked: false` to `authorizationModule`, since only `PolicyAccess` records the questions.
A bus of your own, given through `kernelModule({ commandBus })`, runs `UseCaseGuard.within` with
`aroundHandler`.

**A domain event handler names its event once.** `@DomainEventHandler` and `@On` no longer take
the name of the event: they read the one its class declares, `static readonly eventName`. A
handler is now `@DomainEventHandler(InvoiceIssued)`, `@DomainEventHandler(InvoiceIssued, { phase:
'after-commit' })` or, with a dependency list, `@DomainEventHandler(InvoiceIssued, [Mailer])`; a
method of a projection applies a domain event with `@On(AppointmentBooked)`, as it already did an
integration event. The compiler refuses an event class without a `static readonly eventName`, or
one that declares it empty, and the decorator refuses at declaration a name that is empty when it
is read. `NamedDomainEventType` (`@ddd-ts-kit/kernel/declarations`) is the type of such a class.
Since a handler can no longer be written under another name than the one its event carries,
`declarations/role-declared` (in `ddd-ts-kit check` and `@ddd-ts-kit/eslint-plugin`) no longer
judges that name. In the declared style, `generate event-handler` and `generate integration-event`
refuse an event class that does not declare its name, and say the two lines to write.
`@IntegrationEventHandler(definition, { consumer })` is unchanged: the consumer name is the
identity of the handler, not of the event.

To move:

1. give every domain event class that declares only `readonly name = '..'` its
   `static readonly eventName = '..'` and `readonly name = <Event>.eventName` (the classes
   generated since 0.7 already have them);
2. remove `name: ..` from the options of `@DomainEventHandler` and `@On`, and the options object
   when nothing is left in it: `@DomainEventHandler(X, { name: X.eventName })` becomes
   `@DomainEventHandler(X)`, `@DomainEventHandler(X, { name: X.eventName }, [Mailer])` becomes
   `@DomainEventHandler(X, [Mailer])`;
3. `npx tsc --noEmit` lists what is left.

**A quieter, more legible documentation website.** The site takes the pine green of the domain
layer of its diagrams as its accent instead of the default blue, cool slate greys, and IBM Plex
Sans and Plex Mono served with the site (no request to a font service). Headings, links, tables,
inline code, the current page of the sidebar and the cards of the home page are restyled; keyboard
focus stays visible and reduced motion is respected.

**Codex and GitHub Copilot, beside Claude Code.** `init` writes the guide of the project in
`AGENTS.md`, which Codex, Copilot and most coding agents read, and `CLAUDE.md` imports it; a
project initialised before keeps its `CLAUDE.md`, and `ddd-ts-kit sdk` writes in whichever of the
two it has. The rules by layer of `.claude/rules/` are also written for Copilot in
`.github/instructions/<layer>.instructions.md`, scoped by `applyTo`;
`.github/copilot/settings.json` declares the plugin of the kit, which the Copilot cloud agent
installs and VS Code recommends; with `--ci github`, `copilot-setup-steps.yml` installs the
project before the cloud agent starts. The plugin installs in Codex
(`codex plugin marketplace add gbourgeat/ddd-ts-kit`, from `.agents/plugins/marketplace.json`)
and in the Copilot CLI (`copilot plugin marketplace add gbourgeat/ddd-ts-kit`). Its guard reads
the patches of Codex and the tool calls of Copilot: a hand-written file of a generated role is
refused there as in Claude Code, and a stop with architecture errors is refused once per session
on a host that does not say it already was. Codex cannot ask the user, so a suppression or a
change of the rules is announced there instead of put to the project owner. The agent
configuration of Copilot and of Codex joins the files whose change the guard puts to the owner.

## 0.17.0

**Names of the business, never `target`.** The command handler templates named the aggregate
they load or build `target`, and every project generated from them inherited the word. A
generated handler now names it after its concept, `const invoice = Invoice.create(..)`, and a
generated search names its lines after what it searches (`invoice`, `invoices`, never `item`).
A new rule, `naming/business-name`, held by `ddd-ts-kit check` and by `@ddd-ts-kit/eslint-plugin`
(`ddd-ts-kit/naming-business-name`), reports a variable, a loop variable, a destructured binding,
a parameter or a property of `domain/`, `application/` and the shared kernel named `target`,
`targets`, `data`, `item`, `items`, `obj`, `object`, `thing`, `things`, `stuff`, `info`,
`element`, `el`, `tmp`, `temp`, `foo`, `bar` or `baz`. ESLint fixes what it can name: a variable
built by `X.create(..)` or `new X(..)`, read from a repository (by the type of the call when the
parser has types, as the presets give it, by `xRepository.findById(..)` otherwise), or both
(`found ?? X.create(..)`) is renamed with every use to the camel name of the concept, unless that
name is taken; a loop variable is reported with the singular of its collection. The list is
`businessNames` of the config (`{ "words": [..], "allow": [..] }`), which the `words` and `allow`
options of the ESLint rule come over. `ddd-ts-kit explain naming/business-name` gives the reason
and both forms; the clean code and ubiquitous language pages say why `target`, `data` and `item`
hide the language.

The rule is on in every project, new or existing: a config without `businessNames` reads the
default list. To move:

1. `npx eslint . --fix` renames the bindings whose initializer names the concept (in the example
   application, 23 of 27);
2. `npx eslint .` and `npx ddd-ts-kit check` list what is left, each message with the name to
   write when the code says it (a loop variable, the result of a domain service): rename them;
3. a word that is the term of your business (`item` of a catalogue, `object` of a relationship
   model) goes in `businessNames.allow` of the config.

**The documentation is a website.** Every page of the documentation, the README of every package,
the page of every ESLint rule and the documents of the example are published at
<https://gbourgeat.github.io/ddd-ts-kit/>, in English and in French under `/fr/`, with search,
a sidebar that follows the reading path of the concepts, a dark theme and the diagrams of the
pages. The Markdown files of the repository stay the only source: `site/` assembles them at each
build (a private workspace, never published), `npm run site:dev` previews it, and the site is
deployed to GitHub Pages from `main`. A link or an anchor that leads nowhere fails its build,
which the CI runs on every pull request that touches the documentation.

## 0.16.1

**The documentation is in French too.** Every reader-facing page of the repository (the root
pages, `docs/`, the README of every package, the page of every ESLint rule and the docs of the
example) has a French translation next to it, `X.fr.md`, reached by a switcher on its first
line; start at `README.fr.md` or `docs/README.fr.md`. A French page records the version of the
English page it translates, so a change to the English page without its translation is
reported. Release notes, agent instructions (`CLAUDE.md`, `.claude/`, `plugin/`), generated
files and the partly generated `CONTEXT.md` stay in English only.

**The pages teach with diagrams and samples that compile.** The concepts, guides, tools pages,
package READMEs and the example docs are enriched with worked examples and hand-written SVG
diagrams (one English and one French drawing each, readable in dark mode and on npm). A
TypeScript block marked `<!-- checked sample -->` is compiled against the packages of the
workspace, in both languages, so a sample cannot drift from the API; several samples that no
longer matched the API were corrected on the way.

**Two new checks.** `npm run docs:translations` (in `ci:docs`) reports a page without its
switcher, a missing or stale French page, a link or anchor that leads nowhere, a French page
that links to an English page whose French sibling exists, and a diagram without its French
drawing or malformed. `npm run docs:samples` (in `ci:typecheck`) compiles every checked sample.
[docs/translation.md](docs/translation.md) says what is translated, the shape of a French page,
the glossary, the style of the diagrams and how to keep it all current.

## 0.16.0

**A new project writes its values as classes, and the kit checks it.** `init` writes
`"stack.values": "classes"` (`--values classes|free`), under which a new rule,
`domain/value-object-class`, held by `ddd-ts-kit check` and by `@ddd-ts-kit/eslint-plugin`
(`ddd-ts-kit/domain-value-object-class`), judges the model. A file of `domain/value-objects/` (or
a `*.vo.ts` of the shared kernel) exports exactly one class extending `ValueObject`, directly or
through another value object of the project, with a private or protected constructor and static
factories, and no function, arrow constant or object literal, inline, by an export list or by
default; the types of its props may sit next to it. In `domain/` and in the shared kernel outside
`presentation/`, an exported function that answers a record of data,
`export const money = (amount, currency) => ({ amount, currency })`, is reported with the command
that writes the class (`npx ddd-ts-kit generate value-object`): an object is a record of data when
it holds data (a literal, a parameter, a call of the language), no spread and nothing a call or
`new` of the model built. A domain service, a state machine, a specification answering a boolean
or functions only, a record of value objects the function builds, a reducer that spreads its state
and a function declaring a return type of a package are not concerned; a decision answered as a
plain record is. `ddd-ts-kit explain domain/value-object-class` gives the reason and both forms.

A config without the key reads as `free`: an existing project upgrades without a change, and
nothing is reported. To move: set `"stack.values": "classes"`, run
`npx ddd-ts-kit check --rule domain/value-object-class` and ESLint, write each reported value as a
class with `generate value-object` (its checks in the static factory, its helpers as methods, its
callers on `Money.of(..)` and `equals`), make each reported constructor private and add the
factory the rule names. The steps are in `docs/CONFIG.md`; until they are done, the rule can stay
at `warn` under `rules`, recorded in `deviations`.

**The text checker reads a class whose heritage holds an object type.** `class Money extends
ValueObject<{ readonly cents: number }> {` was read as a class whose body was the object type:
its methods and constructor are now found, for every rule that reads them.

**Why a value object is a class.** `docs/concepts/entities-and-value-objects.md` explains it with
three diagrams (the two forms, what the rule reads, how an answered object is read entry by
entry) and both forms side by side: equality without identity, invariants checked once in
the factory, behaviour next to the data, refusals from static factories, immutability and
`instanceof` in the boundary mappers. The domain rules `init` writes and the `scaffold` and
`clean-code` skills say the same.

**The example models its values as classes.** In the analytics context, the outcome the occupancy
measure reads and the figures it answers are value objects, `MeasuredOutcome` and
`OccupancyFigures`, each with its spec. Each checks its rules in its factory: an outcome never
ends before it starts, figures are whole numbers, none below zero, with at least as many
appointments held as completed and missed ones, refused through `OccupancyError`.
`CalendarDesk` and `FreedSlot` stay parameter objects: they group the arguments of one factory,
and `FreedSlot` holds a `Calendar`, an entity no equality by value can compare.

## 0.15.0

**A context written whole: the identity preset** ([Bootstrap with well-designed contexts](docs/guides/bootstrap-with-well-designed-contexts.md)).

- `init --preset identity` and `generate context <name> --preset identity` write a generic
  context instead of an empty one: accounts provisioned from the identity provider at the first
  sign-in (no password kept), organisations (the tenants under `--tenancy shared-table`, their
  tables then under a decision record), members with roles of a declared vocabulary, invitations
  by token with an expiry, delegations of rights for ninety days at most; seven policies, the
  published language (`member.joined`, `member.role-changed`, `account.deactivated`...), a
  search, controllers, specs with builders and fakes, the Knex or Drizzle adapters, and the port
  `IdentityProviderAdmin`, kept in line at least once by consumers of the published facts, with a
  Keycloak 26 adapter given as a recipe (run once by hand against Keycloak 26.8.0, not in the
  pipeline). Nobody changes their own role or acts above it, whatever
  a delegation lends, and a change decided under a delegation names it (`delegationId`); every
  change of a member saves its organisation, so two owners who remove each other at once cannot
  both commit; a deactivated account leaves its organisations; an address the provider did not
  verify (`email_verified`) provisions no account. With tenants and Keycloak, the authenticator
  reads the `organization` claim as the tenants of the person. Written for the declared style on
  Knex or Drizzle on PostgreSQL, Zod or class-validator, Express or Fastify, with a token
  verifier, and for both `stack.schemas`: shared, its identifier answers are `acceptedSchema` and
  the token of an invitation one shared schema; per route, each route keeps its own; another stack is refused with the flag to change, and so is a second context of the
  same preset. Nothing is recorded in the config. Which other contexts deserve one:
  [Context presets](docs/proposals/context-presets.md).
- `@ddd-ts-kit/auth`: `SignedInGrantsAuthorizer({ grants, otherwise })` grants every signed-in
  person (an actor of type `user`) the same permissions before the model of the project decides
  the rest, whatever that model is. The preset wraps `createAuthorizer` in it, its grants in
  `platform/auth/signed-in-grants.ts`.
- `@ddd-ts-kit/auth`: the default mappings of `JwtAuthenticator` and `keycloakAuthenticator` read
  a tenant claim that lists several tenants (the `organization` claim of a member of several
  organizations) as the `tenants` attribute of the actor, among which a request names one, where
  they gave no tenant; and both give the attributes `username`, `email` and `emailVerified`
  (`email_verified`), where `JwtAuthenticator` gave none.
- The barrels and dependency files the CLI writes set a call that takes several lines apart by
  blank lines, as `@stylistic/padding-line-between-statements` asks.
- Plugin 0.22.0: the skill `bootstrap` proposes the preset for a generic identity context.

**The example serves several networks of practices, one tenant each** (its ADR-0003, accepted).

- `@ddd-ts-kit/knex`: `addTenantColumn(knex, { schema, table, tenantOfExistingRows })`, the
  migration of a table of a project that becomes multi-tenant: the rows already there go to the
  tenant named (refused when there are rows and none), then the column is required and indexed; a
  table that has the column is left alone. `derivedTable(context, query, alias)` selects from a
  query confined by `tenantTable`, for a measure grouped then paged by its output columns.
- `@ddd-ts-kit/knex`: `addOutboxTenantColumn(knex, { schema, tenantOfUnpublished })` gives the
  events not published yet (pending or dead) the tenant the database served, so that their
  consumers run in it.
- `@ddd-ts-kit/http`: `servedTenantOf(resolver, served)` answers 404 to a tenant the deployment
  does not serve, whoever names it, and reads the headers its resolver reads, so that a cached
  answer still varies on them.
- `@ddd-ts-kit/knex`: `createProcessTable(knex, { tenant: true })` adds `tenant_id` to the
  instances of the process managers, and `KnexProcessStore(context, { tenant: scope })` keeps each
  one in the tenant of the work that saves it: an instance of another tenant is neither found nor
  changed, and work that names no tenant is refused (`NoCurrentTenantError`).
- `@ddd-ts-kit/di`: `kernelModule({ tenants })` binds a `TenantDirectory` and gives it to the
  default scheduler, so that a job declared `tenancy: 'per-tenant'` can be registered; the test
  application takes `tenants` too, by default the tenant of its execution context, and composes
  with none named (such a job then runs for no tenant), where it refused the job before.
- `tenancy/scoped-statement` reads the literal text of a raw call: a statement of the schema with
  no word of rows, and an expression that holds no word reading or writing rows or starting a
  statement (`table`, `with`, `values`, `call`, `do`...) and calls only known expression
  functions (aggregates, casts, arithmetic, text), are no longer reported; raw SQL whose text is
  not a literal, or a template that interpolates, still is. Bind a list as one value
  (`state = any(?)`) instead of interpolating its placeholders.
- Plugin 0.22.0: the guard lets `test/e2e/journey-*.e2e.spec.ts` be written by hand, since a
  journey crosses several routes and no generator writes it.
- Example: `"stack.tenancy": "shared-table"`, a tenant column on its twelve tables and the
  migration that adds it to an existing database, `tenantIsolationContract` on every Knex
  repository, the jobs run per network (`NETWORKS`), the audit trail read by platform staff
  through a recorded elevation, `x-tenant-id` refused at the edge for another network than the
  caller's, and a network missing from `NETWORKS` not found. Its HTTP contract changed: `POST
  /practices` asks the role `network-admin`, `GET /audit/entries` takes `network`, every request
  that reaches data needs the `tenant_id` claim, a token or header naming a network not served is
  answered 404, and a person registered in one network who registers in another is refused
  (422, `CONCURRENCY_CONFLICT`). What 0.11 to 0.14 added to it is confined the same way: the
  instances of the confirmation deadline keep their network, the migration gives the network to
  the instances and the unfinished background jobs already there, a clearance is read in the
  network of its job, and the public opening hours are tagged and purged per network
  (`cacheTags.perTenant`, `PublishedCacheInvalidation` with `perTenant`), named by `x-tenant-id`
  for an anonymous caller and varying on it; their tags read `<network>/calendar:<id>`.

## 0.14.0

**A route answers in JSON, XML or CSV, as the request asks.** `Representations.standard()` of
`@ddd-ts-kit/http`, given to the adapters (`representations` of the mount options) and to
`generateOpenApi`, chooses per request the media type the `Accept` header prefers among those
the route declares in `produces` (on `@Controller` or `defineRoute`), JSON first; none
acceptable is `406 NOT_ACCEPTABLE`, before the handler runs. A refusal is written as
`application/problem+xml` when XML was negotiated. A route that declares `consumes:
['application/xml']` reads an XML body into the value the JSON path produces, validated by the
same schema; another media type is `415 UNSUPPORTED_MEDIA_TYPE`. XML follows one convention,
the default of the XML object of OpenAPI, with a parser of the package's own that refuses any
document type declaration (no new dependency). CSV is written for a page or a list of flat rows,
and a handler that answers an `AsyncIterable` under `streamSchemaOf(item)` is streamed in every
representation; one that fails once its status is sent is reported to `onError` with
`interrupted: true`. `everyPage(readPage)` streams a search page after page, each page a query
sent through the bus, so each one runs under the middlewares of the bus (transaction, tenant
session, timeout, tracing). A route that declares no body schema (a file, a redirect, no
content) is never refused 406 and its answer, a `Readable` included, goes out as the handler
wrote it. The contract follows the representations it is given, which must be those the
server is mounted with: every media type of each route, `406 NOT_ACCEPTABLE` on every route a
representation writes, `415 UNSUPPORTED_MEDIA_TYPE` on every route that reads a body; without
them, JSON only and neither status. Mounting a route that declares `produces` or `consumes`
without representations is refused. Both codes join the default error mapping and the codes
of the kit. Without the option nothing changes: every answer stays JSON. `money` and
`decimalText` write money and decimals as strings, the rule every representation follows.
The documentation page of a generated project (`withDocumentation`) is written with the error
mapper and the representations of the boundary; the contract script looks for stale files in
`openapi/` itself and, with forms, in `openapi/forms/` only.

**A generated project negotiates its representations and serves its forms.** Two keys of
`stack`, chosen at `init`: `representations` (`negotiated`, `json`) and `forms` (`on`, `off`),
both on by default with an HTTP stack. `negotiated` writes `src/platform/http/presentation-of.ts`,
which gives the HTTP boundary and the contract script `Representations.standard()` and a field
decider over the `Access` of the application; `forms: on` writes `with-forms.ts`, which serves
`GET /forms/<operationId>` for each route that declares `form`, and `npm run docs:generate`
writes the forms to `openapi/forms/`. A config without the keys is read as `json` and `off`:
nothing changes until `init --force --representations negotiated --forms on`. `generate
representation <context> <UseCase> xml,csv` adds `produces` (and `consumes` of XML for a
route with a body) to a controller, `generate form <context> <UseCase>` its `defineForm`
hints, and `describe` lists the media types and the form of each route.

**A route describes its body as a form.** A route that declares `form` (on `@Controller` or
`defineRoute`, `defineForm<Body>(hints)` next to the schemas of the controller) is served by `formRoutes(routes,
{ fieldAccess })` at `GET /forms/<operationId>`: JSON Forms by default (schema, UI schema,
data), or a neutral tree of groups and fields with `?format=blocks`. Fields, constraints and
options come from the request schema and its closed vocabularies, layout, widgets, lookups and
conditions (`visibleWhen`, `requiredWhen`) from the hints, labels are translation keys, and
values given in the query prefill it. The form respects the caller: given only to who may run
its use case when it declares `requires` (the permission asked as `@Requires` asks it, from the
values of the query; 403 otherwise), a field they may not see is absent (and not echoed in
`data`), one they may not set is read-only, an object with every field it holds; the server
still validates and the use case still decides. `formDocumentsOf(routes)` writes every form whole for the documentation.

**A field of an answer can be reserved to some callers.** `withFieldAccess(schema, { field: {
read, write, subject } })` of `@ddd-ts-kit/http` marks a field with a permission or a policy:
the pipeline leaves it out of every representation (JSON, XML, CSV, streamed lists) for an actor
who may not read it, refuses it with 403 in a request body from one who may not set it, and the
contract marks it with `x-field-access` and no longer lists it as required. `fieldDeciderOf({
access, clock })` decides through the `Access` of `@ddd-ts-kit/auth`, once per element and per
request, remembering the last 256 elements per requirement; without a decider a restricted
field is refused to everybody. A field shown or hidden is decided without being recorded, a
field set in a body is recorded: `Access.decideOn({ actor, permission, subject, context,
recorded })`, new and optional on `Access`, implemented by `PolicyAccess`. The new rule
`authz/fields-by-schema` (checker and ESLint) refuses a test on the roles of the actor under
`application/queries/`, the hand-written way of shaping an answer.

**The JSON Schema of a class-validator class holds what it inherits.** A class that extends
another one, `class SearchPracticeAgendaLine extends SearchAppointmentsLine {}`, was described as
an empty object: the contract said nothing of its fields. `classSchema` now gives it the
properties and the required names of its ancestors. A project with such classes sees its
contract grow on the next `npm run docs:generate`. The end-to-end client of
`@ddd-ts-kit/testing` sends a string body as it is when the call names another content type
(`{ headers: { 'content-type': 'application/xml' } }`), as JSON otherwise.

The concepts and the tools are explained in two new pages, `docs/concepts/representations-and-forms.md`
and `docs/tools/representations-and-forms.md` (JSON Forms renderers for React, Angular and Vue,
the alternatives, why no XML or CSV library), and parts 2 and 3 of `docs/proposals/read-side.md`
are marked built.

**Representations, caching and the four adapters together.** `mountHono` serves what
`mountExpress` and `mountFastify` serve: a body in a media type the route consumes is read as
text under `bodyLimit`, a streamed list is streamed, and the mount refuses `produces` or
`consumes` without representations. A cached answer written in XML or CSV keeps the validators
and tags of its policy: the version, the instant and the tags are read from what the handler
answered, a strong `ETag` digests the bytes of the media type sent (none on a streamed list),
and `Vary` holds the headers of the policy and `accept`, in the answer and in the contract. A
public answer chosen by `Accept` is refused at the mount behind a cache that ignores `Vary`, and
so is a public answer with fields reserved to some callers whose `vary` names neither
`Authorization` nor `Cookie`, even on a route anybody may call: a shared cache would hand the
fields one caller may read to the next. A shared schema keeps its restricted fields whichever
wraps the other (`withFieldAccess(sharedSchema(...))` or `sharedSchema(name,
withFieldAccess(...))`, through `schemaBehind` of `@ddd-ts-kit/validation`), in the definition it
refers to and in the answer, and the page of a shared item keeps the restricted fields of the item.

## 0.13.0

**A schema shared by several routes is documented once.** Declared once, a schema used whole or
inside other schemas by several routes lands once in `components.schemas` of the OpenAPI
contract and every route points at it with `$ref`: a zod schema with `.meta({ id })`,
`classSchema(Dto, { shared: true })`, or any schema through `sharedSchema(name, schema)` of
`@ddd-ts-kit/validation`. class-validator gains `pickClass`, `omitClass` and `partialClass` to
reuse a DTO class in part, and the Standard Schema adapter documents a schema its library
converts itself (Standard JSON Schema, verified with zod 4) when no JSON Schema is given. The
platform shares its own: `acceptedSchema` (`Accepted`, the `{ id }` a command route answers),
the page of a shared item (`<Item>Page`) and the problem document. A shared `params`, `query`
or `headers` schema still gives one parameter per property.

**The contract of a project on the Standard Schema adapter can change.** `standardSchema(schema)`
without a JSON Schema documented `{}` (any value); it now documents what the library converts
itself, so a project on `"stack.validation": "standard-schema"` whose schemas implement Standard
JSON Schema (zod 4 does) sees its OpenAPI contract and client SDK grow the real shapes, and
`openapi --check` or `sdk --check` report drift until they are regenerated. To move: run
`npm run docs:generate` and commit the contract and the client; to keep a schema documented as
any value, pass `{}` as its second argument. A schema the library cannot convert (a date, a
custom check) is still documented `{}`, never a failure.

**A new project declares a shape once.** `init` writes `"stack.schemas": "shared"`: a generated
command route answers its identifier with `acceptedSchema` instead of a schema of its own,
`generate schema <context> <Name>` writes a shape several routes use in
`presentation/http/shared/<name>.schema.ts` (`generate schema shared-kernel <Name>` in
`presentation/` of the shared kernel, for what several contexts answer with), and two rules hold
it: `schema/no-duplicate-shape` reports a DTO class or an object schema that declares by hand
the shape of another one of its context or of the shared kernel (two contexts may say the same
thing in their own words; a placeholder the generator left to fill is not judged), `schema/presentation-only` keeps every schema in a presentation layer
(the second in ESLint too). A config without the key reads as `per-route`: nothing changes and
nothing is reported; the steps to move are in `docs/CONFIG.md`. The example now shares its
schemas: its twenty identifier answers are the one `Accepted` component, its two agenda
searches answer `AgendaLinePage` pages of one `AgendaLine`, and one `TimeSpan` is the body of
the time off route whole and the start of a booking or a rescheduling through
`pickClass(TimeSpan, ['startsAt'])`; the bytes on the wire are unchanged.

**Hono and TypeBox.** `@ddd-ts-kit/http/hono` mounts the routes on Hono 4 (`mountHono`), through
the same pipeline and the same behaviour suite as Express, Fastify and NestJS, uploads and signed
file links included. The adapter reads a JSON body chunk by chunk up to `bodyLimit` (1 MiB by
default, as Fastify): a larger one is answered 413 `BODY_TOO_LARGE`, one that is not JSON 400
`MALFORMED_BODY`, both as problems. `@ddd-ts-kit/validation/typebox` validates with TypeBox 1
(`typeboxSchema`, compiled once, defaults filled, undeclared properties dropped, the failed
keyword as the issue code and a missing property at its own path, `{ coerce: true }` for query
strings) and documents the schema as it is, a nested schema with an `$id` shared once in the
contract (`Type.Intersect` extends it and keeps the reference). Both libraries are optional peers.

**Four contract pairs a project starts from.** `init --http hono` serves the routes with Hono on
Node (`@hono/node-server`, the limiter and the readiness probe in front when the cache is
shared), and `init --validation typebox` writes every schema of a route (the line of a search
included), a function route and a shared schema with TypeBox. A new end-to-end spec,
`contract-pairs.spec.ts`, generates one project per pair (Express and zod, Fastify and TypeBox,
Hono and zod, NestJS and class-validator), shares one shape between two routes, adds a search,
and holds each to zero finding, its specs and end-to-end specs (401, 403, 201 and the trace of
the request), a current contract that documents the shape once, and a client generated from it
that names `Money` and `Accepted` once and compiles. NestJS with class-validator, generated before but never run end to end, is now.

**Which pair for which team.** `docs/tools/contract-pairs.md` compares the four pairs (type
inference, composition of shapes, contract fidelity, issue codes, ecosystem, maintenance) with
numbers measured by `pipeline/monorepo/measure-contract-pairs.mjs`: the pipeline of the kit costs
about a microsecond per request before validation, zod parses in about half a microsecond,
class-validator and TypeBox (through the adapter) in five to ten. oRPC was run and is documented
as not fitting: its procedures, error format and second contract generator would sit next to the
kit's, and the typed client it offers comes here from the generated contract.

## 0.12.0

**Cache policies on routes, and `no-store` for authenticated answers.** A controller, a route
group or a function route declares `cache: { scope, maxAge, sMaxAge, staleWhileRevalidate,
staleIfError, mustRevalidate, vary }` of `@ddd-ts-kit/http`: the pipeline answers its
`Cache-Control` and `Vary`, the contract documents them, and a policy that would let a cache keep
what it must not is refused when the route is declared, above all the `public` answer of a route
that knows its caller without the request headers it varies on. When the routes are mounted, a
public answer is held to the options of the application: on a route that knows its caller, `vary`
names `Authorization`, `Cookie` or the header its tenant is read from; behind a cache that ignores
`Vary` (Cloudflare, Bunny; `cacheTags.honoursVary` to say otherwise) a varying answer is refused;
and every kept answer varies on the headers `resolveTenant` reads (`TenantResolver.headers`, set by
`tenantFromHeader` and `firstTenantOf`). The policy of a route group reaches its reads only: a
write of the group keeps the default of a write. A route that is not public and
declares nothing now answers `Cache-Control: no-store`, refusals included (before, nothing): a
generated contract gains that header on every authenticated operation, regenerate it with
`npm run docs:generate`. The ESLint rule `presentation/shared-cache-varies` reports in the editor a
public policy, without `vary`, on a declaration that writes guards or security schemes. See
`docs/concepts/http-caching.md`.

**Conditional requests.** A cache policy names the version of an answer, `etag: 'representation'`
(a strong tag hashed from the bytes) or `etag: { version: 'version' }` (a weak tag from a field of
the body), and `lastModified: 'changedAt'`: the pipeline answers `ETag` and `Last-Modified`, and
`304 Not Modified` to `If-None-Match` and `If-Modified-Since`. A write declares
`ifMatch: 'optional' | 'required'`: the version named in `If-Match` reaches the handler as
`context.expectedVersion`, `expectVersion(aggregate, expected)` of the kernel refuses a stale one
with `PreconditionFailedError` (`PRECONDITION_FAILED`, 412), and a required one that is missing
answers `PRECONDITION_REQUIRED` (428). Both codes join the default error mapping and the codes a
route may declare without a class of its own (`errors/known-code`). The contract documents the
parameters, headers and answers.

**Cache tags, purged after the commit.** A public policy names the resources its answer shows
(`tags: [{ resource: 'calendar', param: 'calendarId' }]`), sent in the header the shared cache
reads (`cacheTags: { header: CacheTagHeader.xkey }` of the options; `surrogate-key`, `cache-tag`,
`cdn-tag`), filed under the tenant of the request when the application says so (`perTenant`, on
the answers and on the purges). The kernel gains two ports: `CacheInvalidation`,
which a `before-commit` handler asks and which `kernelModule()` binds to purge requests published
on the outbox (a rollback purges nothing, a commit purges even across a crash), and `CachePurger`,
which the relay calls through `new PurgingPublisher(purger, broker)` and which
`domain-events/transactional-before-commit` now refuses before the commit. `@ddd-ts-kit/http/purgers`
holds `VarnishCachePurger` (xkey or ban, with the purge `key` of the VCL), `FastlyCachePurger` and
`CloudflareCachePurger`, all held to `cachePurgerContract` of `@ddd-ts-kit/testing/contracts` (the
CDN ones on a fake of the purge API each documents); the test application exposes
`cacheInvalidation`. `RepeatedCachePurger` purges once more a little later, for a read that reached
the cache after the purge. Filed per tenant, a tagged answer to a request naming no tenant is
`no-store`, a tagged public route anybody may call needs `resolveTenant`, and an invalidation asked
without a tenant throws `NoCurrentTenantError`. `CacheInvalidation` and `CachePurger` join the
standard interfaces (`standard/no-parallel-interface`: `CacheInvalidator`, `CdnPurger` and the
like). Varnish 9.1.0 runs in the integration job. See `docs/tools/http-caches.md`.

**Varnish in front of a generated project.** `init --http-cache varnish` (recorded as
`stack.httpCache`; a config without it is `none`) adds the Varnish 9.1.0 service to the compose
file with its VCL in `docker/varnish/default.vcl` (it keeps only what an answer allows by
`max-age` or `s-maxage`, and lets a purge in from its machine or with `VARNISH_PURGE_KEY`),
validates `VARNISH_URL` and `VARNISH_PURGE_KEY`, tags the public answers in `xkey` from the HTTP
boundary, and has the outbox relay of `main.ts` and of every `generate service` entry point purge
through `PurgingPublisher` and `VarnishCachePurger`; the end-to-end application records the purges
(`purges.purged`). It needs an HTTP framework and `--events outbox`. On `--di manual` and `nest`
the platform gains `cacheInvalidation`. With `--tenancy`, the answers and the purges are tagged
per tenant and the HTTP boundary reads the tenant of a request from `x-tenant-id`.
`generate controller --cache public|private|no-store` writes the cache policy of a controller.
The generated presentation rules say when to cache, purge and condition a write.

## 0.11.0

**File import and export, designed.** `docs/concepts/file-import-export.md` says how a large
file is to be processed on the job queue and the file storage: an import read as a stream and
sent as commands batch by batch, with its checkpoint, its progress and a rejection report; an
export written in parts; chunks followed by a process manager beyond one attempt. Nothing of it
is built in this version; the page lists what would be added.

**A long background job in the example.** A practitioner going away clears a period of their
calendar: `POST /calendars/:calendarId/clearances` (202, the identifier of the clearance) enqueues
`ClearCalendarBackgroundJob` in the unit of work of the command, which cancels the appointments
of the period one by one as the person who asked, with a checkpoint and its progress after each,
and `GET /calendars/:calendarId/clearances/:clearanceId` answers its status (an enum of
`QueuedJobStatus`) and `{ done, total }`, for a clearance of that calendar only (the subject of
its job);
then the time off is accepted. Both routes are new, with the permission `scheduling:calendar.clear`
and the error code `UNKNOWN_CLEARANCE` (404); no existing route of the contract changes. The
end-to-end support of the example can start the worker (`startApplication({ jobs: true })`).

**Generators for background work.** `ddd-ts-kit generate background-job <context> <Name>
--command <UseCase>` writes a background job that sends its command as the actor that enqueued
it (`execution.actor`, new on `BackgroundJobExecution`), with one field of its payload per other
input of the command (a `Date` as its ISO text), registered by `@Background()` or on the builder
of the module file, and a spec that enqueues a payload of every field and runs what is due. `generate
state-machine <context> <Aggregate> --value <state>... --transition "<intention>:<from>>[<to>]"`
writes the status vocabulary (or adds the values it misses), the machine and its spec; a machine
without `refused` throws the new `TransitionError.forbidden` (code `FORBIDDEN_TRANSITION`), and
`lifecycle/status-through-machine` asks an aggregate to import its machine once it writes a
status. `generate process <context> <Name>` writes a process manager, the background job of its
timeouts and their specs. The two that run on the queue need `--di tsyringe`. `init --queue
database|redis|memory` chooses where jobs and process instances are kept (`stack.queue`):
`database` by default on Knex or Drizzle with tsyringe, the jobs and processes tables created by
the first migration and bound by the platform module; `redis` puts the jobs on the server of the
cache, a write lost after the commit logged and reported (`reportLostJobs`); a config without
the key is read as `memory`, as before. A queue kept in the memory of a process is consumed by
that process even with its jobs off, so the API of a project with a worker still runs the jobs
it enqueues. Under standard decorators,
`@Background` records the job once the class is defined, when its static `jobName` exists.

**Process managers.** A long-running process that reacts to events, keeps its own state and
sends commands is a class of `application/processes/` whose steps decide (`ProcessDecision`: the
next state, the commands, the timeouts armed or disarmed, the end). The new `ProcessRunner`
port (runner in `@ddd-ts-kit/scheduling`) runs a step in one unit of work: it loads the instance
an event correlates, saves its state with optimistic concurrency through `ProcessStore`
(`InMemoryProcessStore` in the kernel, `KnexProcessStore` and `createProcessTable`,
`DrizzleProcessStore` and `processesTable`, held by `processStoreContract`), arms its timeouts
as delayed background jobs and sends the commands. `givenProcess` of `@ddd-ts-kit/testing`
tests a step without infrastructure. The new rule `process/sends-commands-only` (checker and
ESLint) refuses a process that imports an aggregate, a repository, a port or infrastructure;
`CONTEXT.md` gains a `Process managers` section and `describe` lists them. In the example, the
confirmation deadline of a requested appointment is a process manager; the booking trace gains
one handler span, the HTTP contract is unchanged.

**State machines.** `defineStateMachine` (kernel) declares the lifecycle of an aggregate once,
in `domain/state-machines/<aggregate>.state-machine.ts`: its states, the states it starts in,
transitions named after the intention methods, guards, and the refusal of a forbidden transition
from a static factory of the concept error. The aggregate asks `machine.next(status, 'confirm',
context)`; the new rule `lifecycle/status-through-machine` (checker and ESLint) refuses a status
written by hand in an aggregate whose machine exists, and `ddd-ts-kit docs` draws each machine in
a new `State machines` section of `CONTEXT.md` (and lists the background jobs in a
`Background jobs` section); `describe` lists both. A CONTEXT.md written before gains the
sections by hand: copy them from a context generated by this version. In the example, the
appointment lifecycle is a state machine; its HTTP contract is unchanged.

**Background jobs.** A use case hands work to a worker with the new `JobQueue` port of the
kernel: `jobs.enqueue(CompileStatementsBackgroundJob, { month }, { delay, runAt, idempotencyKey, subject })`, the
job a class with a static `jobName` declared with `@Background({ maxAttempts, backoff, timeout,
lease })`, its payload typed by its `run`. With a database the job is a row of the jobs table of
its context, written by the transaction of the command (`KnexJobStore` and `createJobTable` in
`@ddd-ts-kit/knex`, `DrizzleJobStore` and `jobsTable` in `@ddd-ts-kit/drizzle`), so a command
that rolls back leaves no job and one that commits loses none; `RedisJobStore` and
`InMemoryJobStore` write it, and a cancellation or a revival, once the unit of work committed
(`whenCommitted`, new in the kernel). An idempotency key is scoped by the tenant of the job, and
work done for a tenant finds and cancels the jobs of that tenant only; `find` answers the tenant
and the `subject` of a job, never its payload, and its status is the closed vocabulary
`QueuedJobStatus`. The `QueueWorker` of `@ddd-ts-kit/scheduling` claims the jobs of the queues of its
contexts with a lease it extends by heartbeats, at least once, with retries and an exponential
backoff, dead jobs, cancellation, progress, checkpoints for long jobs, a concurrency per queue
and a graceful stop; each attempt runs as the actor, in the correlation, the tenant and the
trace of the work that enqueued it, is counted in `background_job_runs_total` and
`background_job_duration_ms`, and reports an unexpected failure to the error reporter.
`@ddd-ts-kit/di` registers the declared jobs and runs the worker in the processes that run the
jobs; the test application gains `jobQueue` and `backgroundJobs.runDue()`. One contract,
`jobStoreContract`, holds every store; the Knex and Drizzle stores are proven on PostgreSQL in
CI behind a pool of several connections, the Redis store on Dragonfly. Prisma and TypeORM get no
store yet. `givenProcess(..).thenState` fails a state that JSON would change, as the runner
stores it. See [Background jobs](docs/concepts/background-jobs.md).

## 0.10.0

**Event sourcing, chosen per aggregate.** `EventSourcedAggregate` in the kernel: a command
checks its invariants and records an event, the state changes only in the apply method of each
event, and the aggregate is rebuilt by replaying its stream, from a snapshot when one was
taken. An `EventStore` port (append at an expected version, a concurrency conflict otherwise,
each stream in order, the whole store by position), `InMemoryEventStore`, stored events
declared with `defineStoredEvent` and read back through upcasters (a stored event is never
rewritten), `EventSourcedRepository` for the adapters, snapshots per aggregate, and
crypto-shredding of personal data (`personalData`, `PersonalDataCipher`, `SubjectKeyStore`).
`@ddd-ts-kit/testing` adds `eventStoreContract`, `eventStoreUnitOfWorkContract` (nothing is
published for an append rolled back), `givenEvents` (given events, when a command, then events,
without a database) and `expectSnapshotEquivalence`. The other aggregates of a context keep
their state in tables: nothing changes for a project that does not opt in.

**An event store on PostgreSQL through every ORM adapter.** One implementation in the kernel
(`PostgresEventStore`, with the snapshot, checkpoint and data-subject key stores), run by
`createKnexEventSourcing`, `createDrizzleEventSourcing`, `createPrismaEventSourcing` and
`createTypeOrmEventSourcing`, each held to `eventStoreContract` and to
`eventStoreUnitOfWorkContract`. The tables come with the migrations of the project:
`createEventStoreTables` (knex), `eventStoreTables` (drizzle-kit), the models of
`prisma/event-store.postgresql.prisma`, `eventStoreEntities` (TypeORM), or the statements of
`eventStoreTablesSql`. An append locks the head of the store until its transaction ends, so
positions follow the commits without gaps; two appends never run side by side.

**Projections fed by the event store.** `@Projection(name, { feed: 'event-store' })` is applied
by a `CatchUpSubscription` with a stored checkpoint (one batch and its checkpoint per unit of
work), never by the dispatcher, and rebuilt from position zero by
`EventStoreProjectionRebuild` into a copy that takes the place of the table.

**Five rules for event-sourced aggregates**, in `ddd-ts-kit check` and in the ESLint plugin:
`event-sourcing/state-in-apply` (the state changes only in apply methods, which record nothing),
`event-sourcing/past-tense`, `event-sourcing/store-behind-repository` (the domain and the use
cases never read the store), `event-sourcing/projection-never-appends` (no projection names the
event store; one declared `{ feed: 'event-store' }` names no repository either) and
`event-sourcing/upcaster-required`: the data of a stored event is a named type declared in its
codec file with every named type it reaches, a version above 1 has an upcaster from each
version below, and the shape of each version is recorded by `ddd-ts-kit docs --stored-events`
in `stored-events.lock.json`, so a shape changed in place is refused. `ddd-ts-kit docs --check`
(`npm run docs:check` in the generated pipeline) fails while a declared version is not
recorded. The rules judge event-sourced code, the kernel's event store and projections declared
`{ feed: 'event-store' }`, all new in this release: a project that has none sees no new finding,
and a projection fed by the dispatcher may still name a repository port.

**`ddd-ts-kit generate aggregate <context> <Name> --event-sourced`** writes the aggregate with
its birth event (`<Name>Created`) and its apply method, the codec of its stored events
(`infrastructure/persistence/<name>-events.mapper.ts`), a builder that replays a history and a
given-events spec; `generate domain-event` on such an aggregate adds the event to its union, to
`appliers()` with an empty apply method, and to the codec. `CONTEXT.md`, `describe` and `list`
mark the event-sourced aggregates. `ddd-ts-kit docs --stored-events` records the stored shapes.
Like every reaction since 0.7.0, `appliers()` and the codec read the name an event declares
once, `[LedgerCredited.eventName]: ...`; the checker and `docs --stored-events` resolve that key.

**Documentation.** A concept page, [Event sourcing, per aggregate](docs/concepts/event-sourcing.md):
when to choose it and when not, what it costs, crypto-shredding, projections fed by the store,
and how to move an aggregate to it and back. The example keeps the attendance record of a
patient as its events (scheduling), with a history rebuilt from the store and the erasure of a
patient (`npm run erase:patient`: the key destroyed, the projections fed by the store rebuilt);
its only change of
HTTP contract is the additive route `GET /practices/{practiceId}/patients/{patientId}/attendance`.
Plugin 0.13.0: the persistence, testing and scaffold skills say how.

## 0.9.0

**Files live in a storage, never in the database.** The kernel gains the ports `FileStorage`
(streams in and out, `stat`, `delete`, `copy`, `move`, `list`, short signed download and upload
links), `FileKeys` (keys generated on the server, under the tenant when there is one) and
`FileScanner` (an antivirus or content check before a file is accepted), the reference an
aggregate keeps, `StoredFile` (key, size, media type, checksum), and `FileStaging`, which stages a
file, moves it to its key as the last step of the transaction that records it
(`promoteOnCommit`, on the new `atCommit` step of the unit of work, undone on a rollback) and
purges the staged files, every one an orphan since no committed row points into `staging/`. A
command carries a client's file as a `FileUpload`, which `fileUploadsMiddleware` stages after
the permission and before the unit of work, so no transaction waits on an upload. A direct
upload is confirmed from the `PendingUpload` grant the server kept (`uploadUrl` answers the link
and the grant, `confirm(pending)` checks the size cap it carries), and the upload links of the
storages the application serves enforce that cap. Media types are checked on the bytes.
`InMemoryFileStorage` and `LocalFileStorage` pass the new `fileStorageContract` of
`@ddd-ts-kit/testing/contracts`; a signed download link is an attachment on every connector.

**`@ddd-ts-kit/s3`, the connector of a deployment.** `S3FileStorage` holds files in a bucket of
any provider of the S3 protocol (AWS, MinIO, OVHcloud, Scaleway, Cloudflare R2): multipart
uploads streamed part by part, presigned links whose upload signature covers the media type,
copy and move by the service. The AWS SDK v3 packages are optional peers. The contract runs on
MinIO in the integration job (`pgsty/minio`, pinned by digest: the upstream project no longer
publishes images).

**A controller declares the file it receives.** `upload: { field, maxBytes, mediaTypes }` on
`@Controller` puts the multipart form, the size and the media types in the OpenAPI contract
(with the 413, 415 and 422 refusals) and streams the file to `handle` as `upload`, checked on
its way: `multipartUploads()` of the new `@ddd-ts-kit/http/uploads` entry reads it (busboy, an
optional peer); a client that drops the connection part-way fails the file stream, so nothing
waits on it. `FILE_TOO_LARGE` answers 413, `UNSUPPORTED_MEDIA_TYPE` 415 and `FILE_NOT_FOUND`
404 by default. `signedFileRoutes(storage)` answers the signed links of the local and in-memory
storages, and a handler may answer a stream.

**A generated project keeps files, from its first day.** `init --storage local|s3|none` (new key
`stack.storage`, `local` in what `init` writes, `none` when a config does not say it, so an
existing project changes nothing) writes `platform/files/` and `platform/config/read-files.ts`
(with `local`, `FILES_PUBLIC_URL` and `FILES_SIGNING_SECRET` are required in production, even
before the first file arrives):
a local directory in development, a bucket of the S3 protocol with a MinIO service in
`docker-compose.yml` for `s3`, the memory in the tests; the ports bound, the hourly purge of
staged files, the routes that answer the links of a served storage and the upload reader.
`generate file-upload <context> <UseCase> --path ...` writes the controller that declares the
file, the command that carries it as a `FileUpload`, the handler that records and promotes it,
and their specs.
Two rules: `persistence/no-file-content` (no binary or base64 column in a schema or a
migration) and `files/port-not-connector` (the model and the use cases name the port, never a
connector); `@ddd-ts-kit/s3` is refused in `domain/` and `application/`. To add files to an
existing project: `npx ddd-ts-kit init --force --storage local`.
`FileStaging.deleteAfterCommit` deletes, once committed, a file an aggregate no longer
references, and the refusals of a file are codes of the kit for `errors/known-code`.

**The example keeps the documents of appointments.** A practice attaches a document (`POST
/appointments/{appointmentId}/document`, multipart, at most 10 MiB of PDF, PNG or JPEG checked on
its bytes), reads it through a link of five minutes (`GET`, every read recorded in the audit
trail) and removes it (`DELETE`); the contract only gains these three operations. The local
directory serves development and the memory the tests; MinIO waits behind the `files` profile
of the compose stack.

## 0.8.0

**The tenant travels with every unit of work** ([Multitenancy](docs/concepts/multitenancy.md)).

- `IntegrationEvent.tenantId`: `scopedPublisher` stamps the tenant of the work on every event
  published without one, `executionContextOfEvent` runs the consumer in it, and the four brokers
  carry it in the envelope and in a header (`x-tenant-id`; `tenant-id` for Redis Streams). The
  outbox keeps it where asked: `createOutboxTables(knex, { tenant: true })` or
  `addOutboxTenantColumn` with `KnexOutboxStore`'s `tenant: true`, `tenantOutboxTable()` for
  Drizzle. Without them nothing changes: the tenant is not stored, as before.
- Jobs state `tenancy: 'global'` (the default, as before) or `'per-tenant'`: the in-process
  scheduler, given a `TenantDirectory` (`tenants`), runs a per-tenant job once per tenant, each
  run in that tenant's scope, and `JobExecution.tenantId` says which.
- One grammar for a tenant id, `isTenantId` (letters, digits, `_`, `-`, at most 63): the edge
  answers 404 to any other, a broker treats an envelope carrying one as poison, and
  `executionContext` throws `InvalidTenantIdError`. A project whose tenant ids hold other
  characters (a `.`, a `:`) must map them before upgrading.
- Kernel: `tenantReachOf`, `tenantsOf`, `isTenantMember`, `tenantKey`, `tenantCacheKey`,
  `TenantDirectory` and `InMemoryTenantDirectory`, and `acrossTenants`, the explicit elevation of
  platform staff over tenants, refused without a reason and written to the audit trail before
  the work runs (`ExecutionContext.elevation`, logged as `elevation`).
- `@ddd-ts-kit/testing`: `eventBusContract` checks that the tenant of an envelope arrives intact;
  `outboxStoreContract` does with `carriesTenant: true`.

**Tenant isolation, four strategies, proven by one contract.**

- Shared tables: `tenantTable`, `ownTenantTable` and `whereTenant` (Knex), `tenantCondition` and
  `ownTenantCondition` (Drizzle): reads reach the tenant of the work or the tenants of an
  elevation, writes the one tenant of the work. The read model stores of both take `tenant`, and
  `TenantAuditReader` (`@ddd-ts-kit/audit`) confines every search of the trail to the tenant.
- Row-level security on PostgreSQL, the second line: `enableTenantIsolation` and
  `tenantIsolationStatements` (Knex), `tenantPolicies` and `forceRowLevelSecurity` (Drizzle), and
  `tenantSession(scope)`, the new `begin` option of `createKnexUnitOfWork` and
  `createDrizzleUnitOfWork`, which sets the tenant of each transaction only. One policy per
  command: an elevated update or delete still touches only the tenant of the work.
- Schema per tenant (Knex): `tenantSchemaOf`, `tenantSchemaTable`, `migrateTenantSchema` with
  `tenantOfMigration`, `tenantSearchPath`. Database per tenant (Knex): `TenantDatabases` (one
  bounded pool per tenant held by a lease, at most `maxTenants` instances closing ones included,
  an idle one closed first and work waiting rather than exceeding the bound),
  `createTenantRoutedUnitOfWork` (statements inside the unit of work only, one tenant per
  transaction), `migrateEveryTenant`.
- `@ddd-ts-kit/testing`: `tenantIsolationContract`, run against every strategy above on PGlite
  and PostgreSQL; `asTenant(scope, tenantId, work)` and `anExecutionContext().elevatedOver(...)`.
- Prisma and TypeORM get the `tenant_id` column and the kernel helpers, applied by hand; no
  helper, no row-level security, no contract run yet.

**The tenant of a request is resolved at the edge** (`@ddd-ts-kit/http`): `resolveTenant` with
`tenantFromSubdomain`, `tenantFromHeader`, `tenantFromPath`, `tenantFromClaim` or `firstTenantOf`;
the pipeline answers 403 to an authenticated caller that does not belong to the tenant named,
before any guard or handler. The guard `TenantMember` keeps routes for the members of the tenant
of the request. Without `resolveTenant` the tenant is the actor's, as before.

**`init --tenancy shared-table`** (Knex or Drizzle) records `"stack.tenancy"` and generates every
repository confined to the tenant through the helpers above, the outbox keeping the tenant of each
event, the search of the audit trail confined to the tenant of the work by `TenantAuditReader`; the new rule `tenancy/scoped-statement` reports a statement of a context that reaches a table
straight from the executor. `init` refuses the strategy with Prisma, TypeORM, `custom` or no ORM,
and refuses row-level security, schema per tenant and database per tenant, which are wired by hand
for now. `generate repository --tenant-scoped` writes the same helpers. A config without the key is
`none`: nothing changes for an existing project.

**Access control: a decision guide, scopes, and the refusals at the edge in the audit trail.**

- [Choosing access control](docs/guides/choosing-access-control.md): five questions that pick
  roles, attribute policies or relationships (Zanzibar), a worked preset for each (typed
  permissions and roles, a policy on one element, a scoped search), the combined model of the
  example, and where relationships are evaluated.
- `Session.scopes`, filled by the JWT and Keycloak authenticators from `scope` (or `scp`);
  `hasScope`, and `SessionScopes` to declare the vocabulary of a project; the guard `HasScope`
  (`@ddd-ts-kit/http`) refuses a request whose session lacks a scope named.
- A request refused by a guard (`HasRole`, `HasScope`, `TenantMember`, a tenant the caller does
  not belong to) is reported to the new `onGuardRefusal` of the HTTP pipeline, and
  `auditGuardRefusals` (`@ddd-ts-kit/audit`) records it as a denied decision, except for a caller
  without a credential, so that unauthenticated traffic cannot write to the trail without bound.
  It is part of `--audit on` (`stack.audit`), with no key of its own. A generated project
  with the audit trail wires it (`create-audit.ts`, `http-boundary.ts`, `compose-application.ts`);
  a project initialised before adds `refusals: auditGuardRefusals(trail, { clock, ids })` to the
  call of `httpBoundary` and `onGuardRefusal: refusals` to what it answers, as `init --force` writes.

**`@ddd-ts-kit/openfga`, a new package: relationships on OpenFGA.** `OpenFgaRelationTupleStore`
and `OpenFgaAuthorizer` answer the `RelationTupleStore` and `Authorizer` ports of
`@ddd-ts-kit/auth` on an OpenFGA server (OpenFGA 1.10 or later), with the mapping and the denial
codes of `RelationBasedAuthorizer`. The authorization model is generated from the relationship
schema (`authorizationModelOf`), written when it differs (`ensureAuthorizationModel`) and
compared (`modelDrift`): the schema stays the one source. `@openfga/sdk` 0.9.7 is an optional
peer, imported by the `/sdk` entry (`openFgaClient`). Both adapters pass the contract suites of
the in-process ones, in memory and against `openfga/openfga` v1.22.0 in the integration job. A
`ListObjects` answer as long as the server's cap (`listObjectsLimit`, 1000 by default) is refused
with `ReverseExpansionLimitError`, since the server cuts a longer list without an error.
[Authorization engines](docs/tools/authorization-engines.md) says when to move from the
PostgreSQL tuple store to OpenFGA.

## 0.7.0

**A value object throws its refusals.** `init` writes `"stack.valueObjects": "throwing"`:
`generate value-object` writes a `create` that returns the value object or throws the refusal
built by the static factory of its concept (`throw PersonError.invalidEmail(raw)`), as the rest
of the domain refuses, and a spec that asserts it with `expectRefusal(() => Email.create(raw),
code)`; a caller no longer unwraps anything. `Result`, `ok`, `err` and `unwrap` stay in the
kernel: `--value-objects result`, or a config without the key, keeps the form of 0.5, so an
existing project upgrades without a change. `ddd-ts-kit value-objects` moves a project from one
to the other: it rewrites the factories, removes every `unwrap(..)` of them, turns the assertions
on a `Result` into assertions on the factory, tidies the imports, sets the key, and prints what
is left to a person.

**Closed vocabularies are declared once.** A status, a kind or a role is an object `as const`
and the union type of the same name (`AppointmentStatus.NoShow`), not an `enum`: Node's type
stripping and `erasableSyntaxOnly` refuse an `enum`, measured on Node 24. `generate vocabulary
<context> <Name> --value <value>...` writes one under `domain/vocabularies/`, a new canonical
role, and adds the values a file does not hold yet. `init` writes the roles a credential carries
as the vocabulary `Role` of the platform (`<platformDir>/auth/role.ts`), read by the grants
(`[Role.Admin]: ['*']`, `systemRole: Role.System`) and the attribute policies;
`generate route-group --role <role>` writes `HasRole(Role.<Key>)` and adds the role to it; the
grant `generate job` gives a system actor names the permission through its set
(`billingPermissions['invoice.cancel']`) instead of its id.

**A domain event names itself once.** `generate domain-event` writes `static readonly eventName =
'billing.invoice.issued'` and `readonly name = InvoiceIssued.eventName`; the reactions
`generate event-handler` and `generate integration-event` write read it,
`@DomainEventHandler(InvoiceIssued, { name: InvoiceIssued.eventName })` and
`domainEvents.on(InvoiceIssued.eventName, ..)` in a module file, so a renamed event cannot leave a
handler on the old name. An integration event handler reads the type it handles from the
declaration of its upstream, `static readonly eventType = invoiceIssuedV1.type`, which the event
catalog script resolves. `events/name-format` judges `eventName`, and `declarations/role-declared`
accepts `{ name: <Event>.eventName }` when `<Event>` is the class the decorator is given. An event
written before, `readonly name = '..'`, and a handler that writes the name out are still read and
compared; a reaction generated for such an event writes the name out, so it compiles.

**Two rules against magic values.** `language/declared-vocabulary` (checker and ESLint) reports a
string literal whose value a vocabulary of the project declares, an object `as const` with the
union type of its name or a permission set of `definePermissions`, and names the key to write
instead: a vocabulary of a context in that context, the one of the platform in the platform and
in the route groups, a permission id and a vocabulary of the shared kernel everywhere; tests,
published languages and the relationship schema are not judged. A vocabulary is parsed, so a
documented entry, double quotes and `as const satisfies ..` are read. `clean/no-magic-number`
(ESLint) reports a number in `domain/` and `application/` other than 0, 1, -1, an index, a type or
the initializer of a module constant or a `static readonly`; the `allow` option changes the list.
Both rules hold under `"stack.literals": "named"`, which `init` writes (`--literals free` leaves
them out). A config without the key reads as `free`: an existing project upgrades without a
change, including the grants `generate job` wrote by their permission id, which a job generated
again recognises instead of granting twice. To turn the rules on, set the key and follow the fix
each finding gives ([Configuration](docs/CONFIG.md#stack)). The example declares 8 vocabularies and
replaced 227 raw values and 8 numbers, its OpenAPI contract unchanged.

**Every package carries the MIT notice.** Each published package now holds the `LICENSE` of the
repository next to its `dist/`, and `npm run package:check` refuses a tarball without it, or with
another text. Earlier versions were published without it.

## 0.6.0

**A typed client of the contract, for the callers of the API.** `npx ddd-ts-kit sdk` (or
`init --sdk`) generates one client per document of the OpenAPI contract, a workspace package
under `clients/<document>` with no runtime dependency: each operation answers its outcome typed
by status, a refusal typed by the error codes its contract declares (`problem.code` is
`'UNKNOWN_TIME_ZONE' | 'VALIDATION_FAILED'`, not `string`), credentials are given per security
scheme, and `unwrap` with `isProblem` serve the code that prefers exceptions. A status the
contract does not declare throws `UnexpectedResponseError`, which reads the problem document of
a fault of the server: its `code` (`INTERNAL_ERROR`) and its `requestId`. An operation id that
is a reserved word or a name of the client is renamed (`deleteOperation`, `send2`). The command
records `"sdk"` in the config (`sdk.name`, `sdk.access`, see `docs/CONFIG.md`), tells the agents
in CLAUDE.md never to edit a client, and wires the project: `docs:generate` regenerates the
clients, `docs:check` fails while one differs from the contract, `ci:build` builds them, so the
GitHub and GitLab pipelines check them; publishing stays a manual step. Under npm, while
`package-lock.json` does not list a client, the command says to run `npm install` and
`sdk --check` fails, before `npm ci` refuses the lock in the pipeline. openapi-typescript with
openapi-fetch, hey-api and orval were measured on the example contract first: none reads the
error codes, and the first refuses TypeScript 6 (`docs/tools/client-sdk.md`). A project without
the key is unchanged: only with it does the ESLint preset leave out `clients/*/src/**`, and the
command add `!**/clients/*/src` to Biome.

## 0.5.0

**Migrations are named by a timestamp and what they do.** The generated `drizzle.config.ts`
sets `migrations: { prefix: 'timestamp' }`, and every `db:generate` requires a name:
`npm run db:generate add-invoices` writes `migrations/20261012093000_add-invoices.sql` (Drizzle),
`migrations/20261012093000_add-invoices.js` (Knex, from its ES module stub now set in
`knexfile.js`; the former default stub wrote CommonJS, which an ES module project cannot load),
`prisma/migrations/20261012093000_add_invoices/` (Prisma); TypeORM takes the path
(`npm run db:generate migrations/add-invoices`) and fixes its own form,
`<milliseconds>-add-invoices.ts`. The first Knex migration of a new project is
`00000000000000_initial.js`. Timestamps keep two branches from writing the same file, but
drizzle-kit's journal still conflicts, and its migrator applies only the entries newer than the
last one a database recorded: a migration merged after a later one was deployed is skipped
without an error (measured). The new rule `persistence/migration-history` reports a migration
without its number, two sharing one, a journal that does not match the files, entries out of
the order they were generated in, and two snapshots generated from the same parent; the merge
procedure is in `docs/tools/persistence.md`. Projects initialised before keep their
`0001_initial.js`: an applied migration is never renamed.

**The generated pipelines use free tools only.** CodeQL and dependency review (free on public
GitHub repositories, paid on private ones) and GitLab's SAST, Secret Detection (findings in a
merge request on Ultimate only) and Dependency Scanning (Ultimate) are no longer written by
default: `init --ci-extras codeql,dependency-review,gitlab-sast,gitlab-secret-detection,gitlab-dependency-scanning`
adds the ones a team wants, recorded as `ci.extras` in the config. `npm audit` and gitleaks
still block a vulnerable dependency or a committed secret on every plan. The table of every
tool, its class and its source is in `pipeline/README.md`. To keep a removed job in a project
initialised before: `init --force --ci-extras <names>`.

**The contracts are YAML by default, and the OpenAPI contract can be split.**
`npm run docs:generate` writes `openapi/openapi.yaml` and `docs/integration/asyncapi.yaml`
(`"openapi": { "format": "json" }` keeps JSON), with a deterministic YAML writer of the CLI
(`ddd-ts-kit/dist/contracts.js`) that the scripts of the project import. `openapi.documents`
splits the contract by route groups, contexts and tags into self-contained documents,
`openapi/<name>.yaml`; a route in no document stops the generation; `/docs` offers a selector
between them. `@ddd-ts-kit/http` adds `routesByDocument`, `openApiDocumentsRoutes` and the
`groups` of a controller route. A project initialised before: compare `scripts/openapi.ts`,
`scripts/events.ts` and `src/platform/http/with-documentation.ts` with what `init --force`
writes, run `npx ddd-ts-kit docs` (it writes `src/platform/http/openapi-documents.ts`), then
`npm run docs:generate`, which replaces the JSON contracts.

**Onboarding.** The root README starts with the recommended steps; `init` ends with the next
step of the method, the README and `CLAUDE.md` it writes list the steps, `status` points at
step 1 when there is no plan, and the `start` and `bootstrap` skills say plainly when a step is
skipped. A new guide, `docs/guides/commands.md`, gives the command or skill for each moment of a
project and the reference of every command and flag, generated from the help of the CLI and
held to it by a test.

## 0.4.1

- A project generated on a stack that tests against PGlite (knex, prisma, typeorm, audit) failed
  `npm install` with `ERESOLVE`: `@electric-sql/pglite-socket` 0.2.12 requires exactly
  `@electric-sql/pglite` 0.5.9, and both were written as caret ranges. The pair is now pinned to
  exact, matching versions, and Dependabot and Renovate move it as one group. The workspace root
  declares the pair as well: drizzle-orm and the copy of the example used by the conformance suite
  resolve them from there.

## 0.4.0

**A route is a controller class with one method.** One class per route; its decorator is the
single statement of the route, and the compiler holds `handle` to it:

```ts
@RouteGroup({ prefix: '/appointments', tags: ['scheduling'], guards: [Authenticated], errors: ['FORBIDDEN'] })
export class AppointmentsRoutes {}

@Controller({
  group: AppointmentsRoutes,
  method: 'POST',
  path: '/',
  summary: 'Book appointment',
  body,
  response: { status: 201, body: accepted },
  errors: ['SLOT_TAKEN'],
})
export class BookAppointmentController {
  constructor(
    private readonly commands: CommandBus,
    private readonly mapper: BookAppointmentMapper,
  ) {}

  async handle(request: HttpRequest<{ body: BookAppointmentBody }>): Promise<BookAppointmentAccepted> {
    return { id: await this.commands.execute(this.mapper.map(request)) };
  }
}
```

- `@ddd-ts-kit/http`: `Controller`, `RouteGroup`, `Guard`, `Authenticated`, `Public`, `HasRole`,
  `RequestMapper`, `Serializer`, `HttpRequest`, `controllerRoutes`, `controllerRoute`. A
  controller becomes a `Route`: the adapters, validation, problem documents, the error mapper
  and tracing are unchanged. `defineRoute` stays supported, and both forms run in one project.
- Route groups carry a prefix, tags, guards and error codes, and a child group inherits. A
  guard is a control at the edge; permissions stay on the use cases (`@Requires`). A controller
  with no group and no guard is refused: `guards: [Public]` says a route is open.
- `"stack.routes": "controllers" | "functions"` in the config, `init --routes`. A new project
  writes controllers; a config without the key is read as `functions` and nothing changes for
  it. `generate route` follows the key (`--group`, `--mapper`, `--serializer`), `generate
  controller` always writes a class, `generate route-group` and `generate guard` are new, and
  `ddd-ts-kit controllers [<context>] [--dry-run]` turns the function routes of a context into
  controllers, files moved and imports rewritten.
- `presentation/http/` has one folder per route, `<resource>/<use-case>/`, with the controller,
  its schemas (`*.params.ts`, `*.body.ts`, `*.accepted.ts`, `*.answer.ts`, `*.line.ts`), its
  `*.mapper.ts` and `*.serializer.ts`; groups are `<name>.routes.ts`, guards
  `guards/*.guard.ts`, shared schemas `shared/`.
- Controllers, guards, mappers and serializers are declared classes: `Edge` in
  `@ddd-ts-kit/kernel/declarations`, `DeclaredEdges` in `@ddd-ts-kit/di`, and discovery reads
  `presentation/`. The generated file of a context registers what each one is given, and a
  declared context lists no route.
- Rules: `presentation/controller-shape`, `presentation/controller-delegates`,
  `presentation/guard-at-the-edge`; `authz/declared` and `errors/known-code` read controllers.
- `describe` and the reference tables of `CONTEXT.md` list each route with its group and its
  guards, next to its use case and its permission.

**To do when upgrading.** Nothing for a project that keeps its function routes. A project
initialised before this version that writes its first controller adds one line to
`compose-application.ts`, which `ddd-ts-kit controllers` prints.

**The `detail` of a problem no longer quotes a private fact.** The message of a refusal built
by a factory is answered as `detail` unless it quotes a fact the factory did not expose; then
the client reads a sentence made from the code (`INVALID_EMAIL` gives `Invalid email.`), and the
message stays in logs and error reports. A client that parsed such a `detail` reads the `code`
and the exposed `facts` instead. `RequestContext` gains an optional `rawHeaders`.

## 0.3.0

**A domain error is built by a static factory named in the words of the business.** One error
class per concept of the language, one factory per refusal, instead of one class per error
built with `new`:

```ts
// domain/errors/appointment.error.ts
export class AppointmentError extends ConceptError {
  static slotTaken(calendarId: string, startsAt: Date) {
    return AppointmentError.refusal(
      'SLOT_TAKEN',
      `The slot starting at ${startsAt.toISOString()} on calendar ${calendarId} is already held.`,
      { calendarId, startsAt },
    ).exposing('startsAt');
  }
}

throw AppointmentError.slotTaken(calendar.id, slot.startsAt);
```

- `ConceptError` is a new export of `@ddd-ts-kit/kernel`, a `DomainError`. Its constructor is
  protected and a subclass declares none: a refusal exists only through a factory, which calls
  the protected `refusal(code, message, facts?)`. The codes of a class are a closed vocabulary
  the compiler derives from its factories: `CodeOf<typeof AppointmentError>`,
  `RefusalOf<typeof AppointmentError, 'SLOT_TAKEN'>`, and `AppointmentError.is(error, code?)`
  narrows to a union a `switch` on `error.code` exhausts, each case with its facts.
  `isRefusal(error, code?)` knows a refusal by its code whatever its class.
- The facts of a refusal travel with it, as data: `error.facts`. They are private. A factory
  names the ones a client may read, `.exposing('startsAt')`, and `@ddd-ts-kit/http` writes
  those, and no other, under `facts` in the problem document; the `Problem` schema of the
  OpenAPI document gains that optional member, which is the one change of a regenerated
  contract. `DomainError.toJSON()` answers `{ name, code, message }` and the exposed facts,
  never the stack or the cause. The audit trail, the spans and the error reports are unchanged:
  they key on the code.
- `@ddd-ts-kit/testing`: `expectRefusal(subject, code, facts?)` on an action, a `Result` or a
  caught error; `thenError(code, facts)` in a scenario; `expectProblem(response, { status,
  code, facts })`.
- `ddd-ts-kit generate error <context> <Concept> <refusal>` creates the error class of the
  concept when it is absent and adds a factory when it is there, with its case in the spec;
  run again, it changes nothing. The concept is a term of the glossary. It refuses a name such
  as `create`, a code that says something else than the name, and a code already set in the
  context.
- Five rules, under `"stack.refusals": "factories"` only. ESLint:
  `errors/through-factory` (no `new` of a class of `domain/errors/`),
  `errors/constructor-not-public`, `errors/factory-name` (a business phrase, and a code that
  says the same words: `slotTaken` setting `BOOKING_FAILED` is reported). `ddd-ts-kit check`:
  `errors/code-unique` (one refusal per code in a context) and `errors/known-code` (a route
  declares in `errors` only codes that exist). `language/glossary-term` now holds the name of
  an error class too.
- `CONTEXT.md` and `ddd-ts-kit describe` list the errors of a context: class, refusal, code
  and exposed facts.

**Nothing to do to upgrade.** `class SlotTakenError extends DomainError { readonly code =
'SLOT_TAKEN' }` and `new SlotTakenError(..)` keep working: `DomainError` is unchanged but for
`toJSON`. A config without `stack.refusals` is read as `classes`: `generate domain-error` still
writes one class per error there, and no `errors/*` rule reports. `init` writes
`"stack.refusals": "factories"` in a new project (`--refusals classes` for the other form),
where `generate domain-error` points to `generate error`.

**To move a project:** `npx ddd-ts-kit error-factories --plan` writes
`error-factories.plan.json` with the concept it proposes for each class (the aggregate its name
starts or ends with); give every entry its concept, then `npx ddd-ts-kit error-factories
--apply` writes the classes of the concepts with a factory per error (same parameters, same
message, the plain parameters as facts), merges the specs, rewrites every `new`, `thenError`,
`toThrow`, `expect.any`, `toBeInstanceOf`, `instanceof`, import and type, and sets the key. Then
`npm run format`. Left to a person, and listed by the command: which facts to expose, a
property of an error that became a fact (`error.personId` is `error.facts.personId`), a class
with members of its own.

Also:

- The `jest.config.js` that `init` writes compiled legacy decorators in every stack. It now
  follows the stack: `decoratorVersion: '2022-03'` where nothing needs the legacy ones,
  `legacyDecorator` and `decoratorMetadata` with class-validator or NestJS.
- The example application imports with `import type` every port and kernel type it only uses
  as a type, as the templates do; the generated declarations import the values.

## 0.2.0

**A class states its dependencies once, in its constructor.** In the declared style a
decorator no longer repeats what the constructor takes:

```ts
@CommandHandler(RegisterPersonCommand)
export class RegisterPersonHandler implements CommandHandler<RegisterPersonCommand> {
  constructor(
    private readonly personRepository: PersonRepository,
    private readonly clock: Clock,
  ) {}
}
```

- The constructor signature is the single statement of what a declared class depends on, for
  every declaring decorator: `@CommandHandler`, `@QueryHandler`, `@DomainEventHandler`,
  `@IntegrationEventHandler`, `@Scheduled`, `@Projection`, `@Repository`, `@Gateway`,
  `@Adapter`, `@Policy`. Each parameter is typed by one class, which is its injection token.
- No compiler metadata. `emitDecoratorMetadata` exists only with legacy decorators compiled by
  `tsc` or swc: it is absent with standard decorators and under `tsx` and esbuild, and it is
  `Object` for a port imported with `import type`. `ddd-ts-kit docs`, every `generate` and
  every start of `npm run dev` read the signatures from the sources and write
  `injected(Class, [Tokens])` statements in the generated file of each context:
  `<context>.declarations.ts`, after its exports, or `<context>.dependencies.ts` under
  discovery, which `discoverContext` loads with the role files. `@ddd-ts-kit/di` injects from
  there, in both decorator modes, whoever compiles. `injected` and `injectedDependencies` are
  new exports of `@ddd-ts-kit/kernel/declarations`, `declaredTokens` of `@ddd-ts-kit/di`.
- Three guards against a stale generated list. `declarations/barrel-current` and
  `ddd-ts-kit docs --check` fail when a constructor changed without regeneration, and now name
  the class. The `dev` script loads `ddd-ts-kit/dist/refresh-declarations.js` before the
  application, on every start and reload: a port added to a constructor is injected on the
  reload that follows the save. And `createApplication` refuses, by name, a class that takes
  parameters and has no list, or a list of another length: new `WiringError` codes
  `MISSING_DEPENDENCIES` and `DEPENDENCY_ARITY`. Nothing is injected as `undefined`.
- New rule `declarations/constructor-injection`, in `ddd-ts-kit check` and in the ESLint
  plugin: a constructor parameter of a declared class names exactly one class. An interface, a
  type alias, a union, a primitive, an optional or defaulted parameter, a rest parameter and a
  constructor inherited from a class of a package are refused, each with its fix; a value is
  carried, as before, by an abstract class bound in the platform.
  `ports/no-concrete-dependency` now also holds the types of constructor parameters.
- **A 0.1 project keeps working untouched.** A list written in a decorator,
  `@CommandHandler(Message, [Ports])`, is still read, still checked by the compiler and wins
  over the signature. New config key `stack.dependencies`: `signature`, which `init` writes
  (`init --dependencies listed` for the other), or `listed`, which is what a config without the
  key means and under which lists are never reported. To migrate: set
  `"dependencies": "signature"`, run `npx eslint . --fix` (the rule removes every list that
  repeats its constructor and reports the ones that differ), run `npx ddd-ts-kit docs`, and add
  `--import ddd-ts-kit/dist/refresh-declarations.js` to the `dev` script. Under discovery, add
  `src/contexts/*/*.dependencies.ts` to the entries of knip (inside the pattern of the role
  files, as `init` writes it) and to the orphan exceptions of dependency-cruiser (`ddd-ts-kit depcruise-config --write` does the second).
- In the types, the dependency list of every decorator is optional, and a decorator without a
  list accepts any constructor: the compiler no longer reports, at the decorator, a list that
  was forgotten. The list is derived instead, and the generated `injected(...)` is checked
  against the constructor as a written list was. A declaration read with `declarationOf`
  carries `dependencies: undefined` when its decorator lists nothing, where it carried `[]`.
- The explicit style stays explicit: `.toClass(Adapter, [Ports])` and
  `.handledBy(Handler, [Ports])` list what a class is given. NestJS and manual wiring are not
  concerned.
- A test assembles a context from its generated file, as the composition root does; to build
  one class alone, take it from that file
  (`contextModule('billing', { IssueInvoiceHandler: billing.IssueInvoiceHandler })`).

**Projections are a role of the CLI.** `application/projections/*.projection.ts` joins the
canonical tree (`tree/closed`, `naming/suffix`, `naming/one-concept-per-file`,
`test/spec-required`), the generated barrel exports a projector and registers what its
constructor takes, discovery, knip and dependency-cruiser know the suffix, and
`ddd-ts-kit describe` and the reference of `CONTEXT.md` list each projection with the events it
applies. New generator `ddd-ts-kit generate projection <context> <Name> <event-type>`
(declared style): a projector of an integration event of the context itself or of a declared
upstream, and its spec. A project that declared `application/projections` in
`extraDirectories` removes the entry and its deviation, runs `ddd-ts-kit docs` (its barrels
gain one line per projection) and gives each projection a spec, which `test/spec-required`
now asks for; a composition root or a test that
added projections to a context by name removes them, the barrel now brings them, and a handler
spec gives a fake to the read model a projection of its context writes.

**Imports without the `.js` extension, by default.** A new project imports its own files by
their alias and nothing else:

```ts
import { PersonRepository } from '@/contexts/identity/domain/repositories/person.repository';
```

- `importExtension` in `ddd-ts-kit.config.json` says how an import ends: `none`, which `init`
  now writes, or `js`, the previous spelling (`init --import-extension js`). Everything `init`
  and `generate` write follows it: every template, the declarations barrels, the published
  language indexes, the wiring of the composition root.
- With `none`, the generated `tsconfig.json` resolves as a bundler does (`"module": "ESNext"`,
  `"moduleResolution": "Bundler"`, `"customConditions": ["node"]`); a file that does not exist
  is still a compile error. Node needs the extension at run time, so `ddd-ts-kit build-aliases`,
  the second step of `npm run build`, now writes the full relative path with `.js` whichever
  spelling the sources use, and the output runs under plain `node` as before.
- New rule `imports/extension`, in `ddd-ts-kit check` and in the ESLint plugin, with a fix: an
  import of a file of the project ends as the config says. Under `none` it also refuses an
  import that names a directory: write `.../published-language/index`.
- `imports/alias-declared` holds what derives from the key: the two resolution options of
  `tsconfig.json`, the pattern of the jest mapping, and the build step.

**Nothing breaks.** A config file without `importExtension`, which is every project generated by
0.1.x, is read as `js`: its imports, its `tsconfig.json`, its jest mapping and its build are
judged and rewritten exactly as before, and `init` run again keeps that spelling. To move such a
project: set the key to `none`, write the two compiler options `ddd-ts-kit check` then asks
for, run `eslint --fix` and the formatter ([docs/CONFIG.md](docs/CONFIG.md)).

One behaviour of `build-aliases` is stricter in both spellings: a specifier names one emitted
file, by the path the config's spelling gives. It used to fall back to `<specifier>.js` and to
`<specifier>/index.js`, which no generated project relied on, since the compiler refused both
under `NodeNext`. It now says what to write instead.

Also:

- **`init --force` keeps the config.** It used to write the config anew: the declared contexts,
  the rules, the limits and the deviations were dropped, and the composition root no longer
  assembled anything. It now changes in the config the stack choices its flags name and nothing
  else, and wires the declared contexts again into the files it rewrites.
- `init` run again on a pnpm project no longer adds every agent permission a second time to
  `.claude/settings.json`.
- The checker and the ESLint plugin read an import written without its extension as the same
  source file as with it, whatever dots its name holds (`invoice.aggregate`): the layer and
  context rules judge both spellings alike.

## 0.1.1

**A project is green from its first minute.** In 0.1.0, `npx ddd-ts-kit init`, the install and
`verify`, which is what `init` tells you to run, failed on a project nothing had been generated
in. Fixed in the generator, and held by an end-to-end spec that runs that exact sequence on both
package managers and on every proven stack, with no context, one, several, and a first use case:

- `init` writes the generated contracts as the scripts of the project write them for a project
  without a route or an integration event of its own (`openapi/openapi.json`,
  `docs/integration/asyncapi.json`, `docs/integration/event-catalog.md`): `docs:check` passes at
  once and the first commit holds the contract. A contract that is already there is left alone.
- The dead-code gate passes on an empty project. The helper `ownPolicy`
  (`platform/resilience/own-policy.ts`) is written with the first adapter that uses it
  (`generate adapter`) instead of by `init`, where nothing imported it on tsyringe; knip is told
  what it enters a context by with the first context, and reads the fakes as entries of the test
  runner, so that it has no remark about its own configuration either.
- A project without a context has a spec to run and passes its linter: the proof that the
  platform wires alone is written by `init` (`test/architecture/extractable.spec.ts`), which each
  context then joins, and the composition root imports `contextModule` or `discoverContext` with
  the first context instead of before it.
- The integration run of the pipeline passes while the project has no integration spec yet.
- Under `--assembly discovery`, a context that was just declared and has no role file yet is
  discovered as an empty context (`@ddd-ts-kit/di`): it used to stop the application, the specs
  and the documents with `DISCOVERY_FAILED`.

In a project created with 0.1.0, nothing has to change: these fixes are about what `init` writes.
`generate adapter` now counts as writing a shared file for the first adapter of a project wired on
tsyringe (`--local-only` refuses it once, naming the file).

Also since 0.1.0:

- **pnpm by default.** `init` writes a project for pnpm, pinned in `package.json` and provided by
  corepack, unless `--package-manager npm`: every script, pipeline, hook, the Dockerfile, the
  guidance and the agent permissions are said in the words of the manager chosen.
- **`ddd-ts-kit affected`.** A pull or merge request runs the unit specs, the integration specs
  and the lint of the contexts its change reaches through the context map; the generated
  pipelines call it, and the default branch and the nightly schedule run everything.
- The release is published through npm trusted publishing (OIDC), with provenance and without a
  stored token.

## 0.1.0

First publication to the npm registry: the CLI `ddd-ts-kit` and the 23 packages `@ddd-ts-kit/*`.

**English** · [Français](coding-agents.fr.md)

# The plugin for coding agents: Claude Code, Codex, GitHub Copilot

The [ddd-ts-kit repository](https://github.com/gbourgeat/ddd-ts-kit) is the marketplace of the plugin
for three coding agents:

| Agent | Install | A skill is called |
|---|---|---|
| Claude Code | `/plugin marketplace add gbourgeat/ddd-ts-kit`, then `/plugin install ddd-ts-kit@ddd-ts-kit` | `/ddd-ts-kit:start` |
| Codex | `codex plugin marketplace add gbourgeat/ddd-ts-kit`, then install `ddd-ts-kit` from `/plugins` and trust its hooks in `/hooks` | `$start` |
| Copilot CLI | `copilot plugin marketplace add gbourgeat/ddd-ts-kit`, then `copilot plugin install ddd-ts-kit@ddd-ts-kit` | by its name, `start` |
| Copilot cloud agent, VS Code | declared by the `.github/copilot/settings.json` that `init` writes: the cloud agent installs it, VS Code recommends it | by its name, `start` |

Twenty-six skills, in the order a project meets them:

| Skill | Use |
|---|---|
| `start` | conduct a project from a statement of needs to working contexts (run by the user) |
| `discover-domain` | a light event storming in writing |
| `bounded-contexts` | find the contexts and classify them core, supporting or generic |
| `glossary` | the ubiquitous language of a context and its `CONTEXT.md`, before any code |
| `context-map` | upstream, downstream and relationship pattern for each pair of contexts |
| `bootstrap` | choose the stack and create the project (run by the user) |
| `plan-slices` | the work as vertical slices per context, ordered, with their generator commands |
| `parallel-work` | split the slices between several agents or people without collision |
| `intent` | capture an idea as an intent before any story, in the words of whoever has it, for the product owner to accept in a pull request (run by the user; [story workflow](story-workflow.md#where-a-story-comes-from)) |
| `story` | take one user story from its questions to a green pull request in one session, one story per terminal (run by the user; [story workflow](story-workflow.md)) |
| `fix` | repair one defect in its own worktree, its regression spec written and locked before any code (run by the user; [a fix](story-workflow.md#a-fix-the-regression-spec-first-locked)) |
| `pull-request` | take the pull request of a story to green: sweep its review comments and failing checks under the rules of the story, push, wait, repeat; then report what changed and what was declined (run by the user) |
| `scaffold` | one file of any role, from a template |
| `use-case` | one feature end to end, test first |
| `integration-event` | make two contexts collaborate through a versioned event |
| `wiring` | ports as abstract classes, declarations, the composition root, fakes in tests |
| `persistence` | repositories, unit of work, outbox, read models, migrations, whatever the ORM |
| `access-control` | authentication, permissions per use case, the explicit actor, policies |
| `cross-cutting` | logging, metrics, tracing, error reporting, audit trail, resilience and caching from outside |
| `testing` | fakes instead of mocks, builders, given / when / then, end to end |
| `clean-code` | naming, function order, comments, testability |
| `document` | OpenAPI contract and its typed clients, event catalog, AsyncAPI, generated lists, decision records |
| `extract-service` | keep each context ready to run as its own service, and extract it |
| `deviation` | what to do when asked to go around a rule |
| `quality-gate` | run the checks at the right scope and fix at the root cause |
| `commit-discipline` | one slice per commit, generated files with what generated them |

Six agents: `domain-explorer` (read-only answers about what exists and where),
`context-builder` (builds the slices of one context in its own worktree),
`domain-test-writer` (turns `it.todo` entries into specs) and `architecture-reviewer`
(read-only review of a diff, a branch or a context, under the `REVIEW.md` of the project when it
has one: the passes of the team on top of the agent's method, each finding tagged with its pass),
`acceptance-judge` (judges a change to a
locked acceptance test, independently of the session that made it, and writes its verdict), and
`story-verifier` (read-only verification of a story at its close, in a fresh context: it starts
the application as the end-to-end tests do, exercises the routes of the story and the two nearest
flows, and reports what does not match the design or a decision).

The description of each skill says when to use it in at most 320 characters, and the 26 take
at most 6,500 together; an agent's, at most 400. Claude Code loads the listing of the skills into
every session within 1% of the context window, counted in characters, not tokens: 8,000
characters on a 200k window, shared with every other skill of the session, those of Claude Code
and of other plugins included. Past it, the listing shortens the descriptions of the skills invoked
least, which then stop triggering on their keywords. `bootstrap`, `fix`, `intent`, `pull-request`,
`start` and `story`, run by the user only (`disable-model-invocation`), are not listed; the 20
others take about 5,600 characters with the `ddd-ts-kit:<name>` each entry carries, about 70
percent of the 8,000 for the kit alone. They fit on their own; next to many other skills, the
least invoked of the kit lose their description, and are still run by name. A share of 2,400
characters, which would let them all survive in a crowded session, would cut every description to
a third of what it needs to trigger, so the kit accepts the loss. A test of the plugin
(`node --test plugin/skills/descriptions.test.mjs`) holds the limits.

The body of a skill is read whole once the skill loads, so what one option of `stack` needs is
kept beside it: the body keeps every rule and one line, "under `stack.<key>: <value>`, read
`<file>.md` first", and the file, read on that stack only, opens with when it is read and points
to the page of `docs/` it paraphrases (under `concepts/`, `tools/` or `guides/`). `wiring` keeps
the declared style and reads `explicit.md`, `nest.md` and `earlier-layouts.md`;
`access-control` reads `relationships.md` under `rebac`; `persistence` reads `tenancy.md`,
`event-sourcing.md`, `personal-data.md` and `migrations.md`; `use-case` reads `factories.md`,
`function-routes.md` and `file-upload.md`. A test of the plugin
(`node --test plugin/skills/bodies.test.mjs`) holds these four bodies under a ceiling of words,
as `wc -w` counts them: `wiring` 1,200, `access-control` 1,900, `persistence` 1,200, `use-case`
2,200.

The hook is the part that makes the rest binding. In a project that has a
`ddd-ts-kit.config.json` it reminds the workflow and the context map at session start, says
when the installed packages are not the version the skills describe, refuses
a hand-written file where a generator exists, any edit of a generated contract and the writing
of the baseline of the errors (`check --baseline write` however the kit is launched, a package
script included, or an edit of `ddd-ts-kit-baseline.json`:
the project owner writes it, in a terminal), refuses a git command that skips the hooks of the
project (`--no-verify`, `-n` on a commit, `-c` or `--config-env` of `core.hooksPath` or its setting
in the environment, `LEFTHOOK=0`, `HUSKY=0`, `LEFTHOOK_EXCLUDE`, `git commit-tree`: the hooks are the local gate
of the pipeline; the words of a command are read as the shell gives them, quotes removed) and, to a sub-agent, a `git config` that sets a value or a `git -c` of a key that
runs a command in every checkout (`core.fsmonitor`, `core.pager`, `core.editor`, `core.sshCommand`,
an `alias.*`, a diff, merge or filter driver, `diff.external`, an `include.path`, a credential
helper, a pager, a tool of `mergetool` or `difftool`, a `gpg` program, a `protocol.*`), given by
`-c` or `--config-env`, or a variable of the environment that hands git a program or settings
(`GIT_EXTERNAL_DIFF`, `GIT_PAGER`, `GIT_EDITOR`, `GIT_SSH_COMMAND`, `GIT_CONFIG_*`...), asks the
project owner before a suppression, a skipped test or a change of the rules is written by the
editor tools, checks
every written file and returns the violations with their fix (the first five of a Codex patch, the
others named as not checked; with `"dependenciesBeforeWrite": true`, on trial,
it refuses before the write a new import that breaks a dependency rule), and refuses to finish while
architecture errors remain in a tree with uncommitted changes (a clean tree is left to the
pre-commit hook and the pipeline; a check that does not end in time, or that answers more than the
64 MiB the guard reads, lets the session finish and says so;
a session start past ten seconds of CLI calls skips the ones left and says it was cut short). With `"formatOnWrite": true` in the config (written by `init` for a new project), it first runs the Biome
the project installed on the written file (the bin of its `@biomejs/biome` package, `format --write`, one file,
never another formatter), so that the layout is settled at the write and the lint findings
that follow a wrapped line come back in the same output; a run that fails changes nothing. It reminds, without blocking, when the uncommitted changes exceed
the advised size of a commit, and in a worker's worktree (`.ddd-ts-kit/worker.json`) it
refuses a write outside the worker's context, by the editor tools or by the shell. The editor
tools of a builder are held wherever the file stands, from its first call: a path that forgot its
worktree is refused in the checkout of the conductor, in another worktree and outside every project
but the temporary directory, and told to name the file under its worktree. It reads the
whole command line, every command of it, not only one that starts with `cd <worktree> &&`: a worker
runs every command that way, and one that writes without moving into its worktree is refused with
that instruction: from another checkout a worker only reads (`cat`, `ls`, `grep`, git that reads,
`git add` and `git commit` in its own worktree, the kit asked to list, describe, report or read a
briefing, and its checks that write nothing: `check` without `--baseline`, `lint` without `--fix`,
`rules`, `docs --check` without `--stored-events`, `verify-merge`, `cited`, `affected` without
`--run`), whatever the program. A session opened above the project holds its worker to the project
its command names, and a worker standing in its worktree stays pinned to it when a command starts in
another project. It follows a `cd` only when it is certain (after `&&`, into a directory that
exists, and that no folder of `CDPATH` sends elsewhere), refuses a worker the variables that move
where the shell or git find their places (`TMPDIR`, `CDPATH`, `HOME`, `GIT_DIR`, `GIT_WORK_TREE`,
`PATH`, set for a command or exported), so a write after `cd dir;` or a failed `cd` is refused rather than placed wrong; it reads a
name the shell computes (a variable, a substitution, a brace list), a wrapper (`nice`, `ionice`,
`setsid`, `flock`, `busybox`, `su -c`, `env -S`), a package runner (`npx`, `npm exec`) and the
command it runs; and it knows the writers the file tables miss (`>&`, a `sed` or `awk` script that
writes, `vim`/`ed`, `rsync`, `curl -o`, `wget -O`, `tar -x`, `git stash`/`reset --hard`/`worktree
add`/`checkout -f`, `eslint --fix`, `biome --write`). A worker's only free places outside its scope
are `/dev/null`, the standard devices and the temporary directory (`$TMPDIR`) outside every project (a project cloned there keeps its rules); any other absolute
place is refused. A file is judged where it lands: a link of the scope, or a folder of its path that
is one, is the place it reaches, a link of the temporary directory into a project is that place, and
a file of the scope that has another name elsewhere (a hard link) is refused. A command nested deeper than the reader follows (more than five shells or `eval`s, or more than 32
wrappers and assignments before its program, which then names no program it knows)
is refused rather than let through unread; so is, to a worker, a line that ends inside a quote or
with a here-document that never closes, and a command the reader breaks on. Code it cannot read (inline code such as `node -e`, a
script, a shell fed on its input, `make`, a package script or runner such as `npm test` or `npx`)
runs, but before each command of a worker that runs some (every command but the pure readers:
`cat`, `ls`, `grep`, `git log`, `git status`... named by their name, git without a setting given to
the command nor an option that hands the files to a program such as `grep -O` or `--ext-diff`; the
kit counts as the program, or as the first operand of `node` or of a package runner), the guard notes the state outside the scope (the
`git status` and `HEAD` of the worktree, of the session's checkout when it is another, and the
manifest and bin of the kit's CLI and of Biome in `node_modules`), and compares it at the worker's
next call. A read leaves the note of the worktree standing, for what the command left running in the
background, until a change or a new note. The worker's stop compares it one last time, with what its branch holds outside the scope since the
base its scope file records (`baseCommit`: the commits since then, what the trunk brought in left
out, and the uncommitted files; a scope file without a base leaves the commits uncompared, as the
guard fails open): the worker
goes on once to put a file back, and what stays is said to the conductor in `lastStop.outside` of
`agent.json`, in its report, in `status --workers` and in `worker-scope --resume`. A `git status`
that does not answer in full compares nothing, and the guard says so. A file of the worktree changed outside the scope, deleted or committed included, stops the
worker until it is put back with the command the guard names: its committed content (`git checkout
<commit> -- <path>`, then `git commit` when a commit changed it), the content it had before the
command when it was already changed (kept under `.ddd-ts-kit/guard/held/`), `git mv` back for a
rename, `rm` for a new file. A file left changed in the working tree of the session's checkout (not
one the conductor commits or merges meanwhile) or a change of those packages is said once, for the
conductor, who alone knows whether it made it. What the project's own scripts (`npm run format`,
`lint:fix`, `regenerate`, `docs:generate`, `openapi:generate`, `events:generate`, not run in another
folder by `--prefix`, `-C`, `--dir` or `--filter`), alone on the line, rewrite outside the scope among the files their tools rewrite (code, JSON, `docs/`) is said
with the script that rewrote it, not held: the worker leaves it out of its commits. The scope is pinned at the worker's first
call: a scope file removed or changed stops it until the conductor restores it, and the mode of the
guard is pinned with it, so a config of the worktree that turns the guard off, or grows past what
the guard reads, does not lift a worker, its change being compared as any other. A branch the worker
merges into its own is its work: only what the trunk holds is the trunk's. The kit's own
`merge-trunk` is not noted, and an install of the lockfile leaves the packages out of the note. It
refuses a dependency change and another formatter than `npm run format`. The `architecture-reviewer`, the
`domain-explorer` and the `story-verifier` change no file of a project by the shell, nor its work
tree by git (they read with `git show` and `git diff`). A sub-agent is refused
deleting, moving or resetting a branch checked out in another worktree (another worker's, or the
trunk), short options bundled or long ones cut included. A worker's git changes its own worktree
only: from any other checkout it reads (`status`, `log`, `diff`, `worktree list`, `fetch` into no
ref...), so only the conductor lands a branch or moves its checkout, and no worker removes a
worktree or writes a ref by `update-ref` or `symbolic-ref`. In its worktree, its git keeps to its
own branch, the one its scope file records (else the one checked out there): it pushes that branch
alone (`git push`, `git push -u origin <branch>`, `HEAD:<branch>`), without `--force`, `-f`,
`--force-with-lease`, a `+` refspec, a deletion (`:<ref>`, `--delete`, `-d`) nor `--all`,
`--tags` or `--mirror`; it fetches into no ref (`git fetch origin main:main`), makes no tag, and
checks out or switches to no other branch nor creates one (`-b`, `-c`, `--orphan`, `--detach`). The same shell reading holds the `domain-test-writer` to
the paths of a test (a spec, the root `test/` or the test folders of a context, and a file it names:
a place only the shell knows is refused to it), the code of a story to its build gate, and every
session's hand-writing of a generated file or the baseline, each by the places a command writes
rather than its text, in the project that owns the place, whatever the checkout the session stands
in. What a redirection, `sed -i` or `tee` types in a file is held as the editor tools are: the code
of a context in the main checkout of the trunk, a new file of a generated role. A generated file
put back or deleted (`git checkout`, `git restore`, `git rm`, `rm`) stays free, since it is rebuilt
after; so does what a session other than a worker or the test writer writes where only the shell
knows. A Codex `apply_patch` sent through the shell is read as a patch, each patch of the line,
in a here-document or an argument; one the command does not hold (a file, a pipe) is refused. A
file a patch deletes, or leaves by a move, is held as `rm` holds it (the baseline, the scope of a
worker).
For a `context-builder` (the agent of the plugin, `ddd-ts-kit:context-builder`: an agent of the project
named `context-builder` without that prefix is held to the scope of its worktree, but neither counted nor
recorded), it counts the tool calls inside those same hooks and warns the agent
twice before its turn limit, records its runs in its worktree (`.ddd-ts-kit/agent.json`), and
listens to two rare events of Claude Code, filtered by that agent: `SubagentStart` (a launch or a
resume starts a new count) and `SubagentStop` (when it ends on its own, it is kept going once to
commit a slice that passed `verify-slice`, to rewrite a stale report or to put back what its last
command changed outside its scope). At session start, it
names the workers to resume ([parallel work](parallel-work.md#when-an-agent-stops)). In a project
`init` created (`"worktrees": "required"`), it refuses the code of a context and the generators
that write it in the main checkout of the trunk, and in a worktree of `.worktrees/` without its
own `node_modules`: `npx ddd-ts-kit worktree <name>` opens the place to write it; a project
started before is only told at session start. In the
worktree of a story (`.ddd-ts-kit/story.json`, which the session there and every sub-agent change in
no way, nor `.ddd-ts-kit/worker.json` in the worktree of a worker, a removal of a folder above it
included: `rm -r`, a `find -delete` or `-exec rm` whose `-name` tests can find it, `git clean -x`
or `-X`, `git stash --all`, and `git clean -d` or `git stash --include-untracked` when git does not
ignore it), it refuses any code of a context until each row
has its design review and the acceptance is written and locked, says the phase of the story at
session start with where it meets the other open stories, says once per file when the session
writes a file another open story changes, and refuses once to end the session before its report
([story workflow](story-workflow.md)). In the worktree of a fix (`"kind": "fix"` in that file),
it opens the code once the regression spec is locked, and refuses every edit of a locked spec,
by the editor tools and by the shell, to its sub-agents: a folder that holds the spec counts as the
spec, and so does a write whose place only the shell knows (`xargs sed -i`, `cd dir; sed -i`), while
a `find -exec` is judged by the folders it starts from, and reads through either stay free. The
session itself may write a new version,
which `acceptance` reports and the `acceptance-judge` agent rules on. A command that writes the lock
of an acceptance or a verdict (judged by the places it writes, a glob expanded, not by its text; a
folder that holds them, `test/acceptance` or `test`, counts as them, and so does a place only the
shell knows on a line that names the acceptance) is refused: a command may move or check a path
(`cd`, `pushd`, `popd`, `pwd`, `test`), read the file (`cat`, `grep`, `rg` without `--pre`, `sed`
without `-i`, `awk`, `less`, `jq`), version it (`git add`, `commit` without `-a`, `log`, `show`,
`status`, none of them with `--output`) or run the kit (`ddd-ts-kit`, `npx ddd-ts-kit`); any other
program (a bare `npx` or `pnpm`, `git checkout`/`stash`), or a redirection to a file, is a write,
which only the CLI and that agent make. The judge itself reads git without adding or committing,
and runs the kit only to read (`acceptance` without `--lock`, `list`, `describe`, `explain`,
`status`, `story`, `stories`, `story-check`). No hook
runs on every tool call: an ordinary session starts no more processes than before. It fails open: a broken guard never blocks work, which makes it a guide, not a security boundary: it runs the project's own `ddd-ts-kit` CLI and Biome from `node_modules` (the bin each package names, with Node, never one installed above the top of the repository, and no config nor CLI in a folder another user may write, the shared temp directory above all), and of what code it cannot read writes, it compares only what is noted above: other git-ignored files and the places outside those checkouts are not enumerated, and the state it keeps between two calls lies in the project, within reach of code that aims at the guard; to isolate an agent, see [Sandboxing coding agents](agent-sandbox.md). Set
`"guard": "advise"` in the config to be asked instead of refused, `"off"` to silence it.

Each agent gets what its host runs. The skills work in all three. The six agents are sub-agents
of Claude Code; Codex loads no agent from a plugin, and one session per worktree takes the place
of `context-builder`. The hook runs wherever the host runs the hooks of a plugin: it reads the
patches of Codex and the tool calls of Copilot as well as those of Claude Code. Codex cannot put
a question to the user, so what Claude Code asks the project owner is said to the user there,
and left to the checks of the pipeline.

Without any plugin, a project still guides every agent: `init` writes `AGENTS.md`, the guide
Codex, Copilot and most agents read (`CLAUDE.md` imports it; its `## Verifying your work`
section gives each verification command with the lines it prints when it passes, to run before
reporting done and to paste, a failing check fixed in the code and never in the check, and its
`## Mistakes seen here` section is the team's: a review finding or a `TODO(review)` made twice
becomes a line there, or a rule of the config, the rule of two the `architecture-reviewer`
agent and the `quality-gate` skill apply, after the AI-native SDLC playbook of Anthropic,
[PDF](https://cdn.prod.website-files.com/6889473510b50328dbb70ae6/6aba736348bdf4f08183f463_AI%20Native%20SDLC%20Playbook_designv2%20(1).pdf)),
the rules by layer for Claude Code
in `.claude/rules/` and the same rules for Copilot in `.github/instructions/`, scoped by
`applyTo`, `REVIEW.md`, the review policy every reviewer reads, written once and owned by the
team ([Working as a team](team-workflow.md#review-focus-per-layer)), `.claude/settings.json`,
the permissions of Claude Code (the checks and generators run without asking; `.env` and the
generated contracts are never read or edited; `generate` and `init` with `--force`, `git push`, `npm publish`, the files that hold
the rules and the pipeline, the migrations of the ORM, `Dockerfile`, `docker-compose.yml` and
`docker/` ask first: the list is in the
[README of the CLI](../../packages/cli/README.md#init), and `ddd-ts-kit doctor` says what a
project lacks of it; `init --agent-profile regulated` adds the sandbox block and the two hooks of
a regulated organisation, [Sandboxing coding agents](agent-sandbox.md#the-regulated-profile)), and, with the GitHub
pipeline, `copilot-setup-steps.yml`, which installs the project
before the Copilot cloud agent starts. `npm run verify` and the pipeline hold every agent to
the same rules.

## What holds each skill

A skill is advice: it tells an agent what to run and what to decide, and an agent can ignore it.
The [AI-native SDLC playbook of Anthropic](https://cdn.prod.website-files.com/6889473510b50328dbb70ae6/6aba736348bdf4f08183f463_AI%20Native%20SDLC%20Playbook_designv2%20(1).pdf)
says what a regulated team asks before it accepts a skill at all: a policy that must always hold
needs something deterministic behind it, a hook that blocks the action or a check that catches it
later. This table names that control for each skill of the plugin: the rule ids of `ddd-ts-kit
rules` (held by the checker, the ESLint plugin or dependency-cruiser, see
[who checks what](../ARCHITECTURE.md#who-checks-what)), the gates of the guard, and the checks of
the pipeline. A test of the plugin (`node --test plugin/skills/controls.test.mjs`) fails when a
rule id named here is unknown to the CLI, or when a skill has no row.

| Skill | Deterministic control behind it | Gap |
|---|---|---|
| `start` | `ddd-ts-kit status` reads `docs/architecture/plan.md` and `slices.md` and names the next step; the guard reminds the workflow at session start | the shape of `plan.md` is read, not checked |
| `discover-domain` | none of its own: `docs/architecture/discovery.md` is read by the next steps, not checked | strategic truth is not checkable, as the [methodology](methodology.md) says |
| `bounded-contexts` | `context/no-cycle`, `context/extractable`, `tree/context-doc` (every context has its `CONTEXT.md`), `docs --check` | the classification of a context is read, not judged |
| `glossary` | the generator refuses a name the glossary does not hold; `language/glossary-term`, `language/declared-vocabulary`, `language/no-technical-name` | |
| `context-map` | `context/no-cycle`, `context/declared-relationship`, `context/published-language-only`, `context/published-language-is-a-contract`, the context map regenerated and compared by `docs --check` | |
| `bootstrap` | `init` writes a project green under `npm run verify`; `config/valid`; `doctor --strict` | |
| `plan-slices` | `status`, `story-check` and `worker-scope --rows` read the rows of `slices.md` and refuse an unknown one; `plan-waves` replays the generator commands of the rows and refuses a name whose words the glossary does not define, any command the generator refuses, with its refusal under the row, and a row that builds on what a row it does not wait for generates; `verify-slice` | the order of the rows is advised (`plan-waves`), never refused |
| `parallel-work` | the worker guard (`.ddd-ts-kit/worker.json`: a write outside the context is refused, by the editor tools and by the shell), `verify-merge`, `merge-trunk`, `status --workers` | |
| `intent` | `story-scope --from` refuses an intent whose status is not `accepted`; the `## Origin` block of the story, which `story --gate close` requires | the content of an intent is read by people, not checked |
| `story` | `story --gate build` and `--gate close`, the guard in the worktree of a story (no code before the design review and the lock), `acceptance --lock`, `test/acceptance-black-box`, the `acceptance-judge` agent | the design pass of `story-check` holds names, not behaviour |
| `fix` | `story-scope --kind fix`, `acceptance <code> --gate written` and `--lock` on the regression specs of `## Regression`, the guard in the worktree of a fix (no code before the lock, no edit of a locked spec by a sub-agent), the `acceptance-judge` agent | the locked spec is held unchanged; that it passes is proven by the test runner, not by `acceptance` |
| `pull-request` | the checks of the pull request and the branch protection (a code owner approves); the guard of the worktree of the story while it works | nothing of the kit reads the review threads: the skill does |
| `scaffold` | the guard refuses a hand-written file of a role; `tree/closed`, `tree/documented-paths`, `naming/suffix`, `naming/one-concept-per-file`, `naming/business-name`, `naming/search-not-list`, `test/spec-required`, `test/builder-required`, `lifecycle/status-through-machine`, `process/sends-commands-only`, `scheduling/job-name`, `scheduling/job-registered`, `scheduling/job-triggers-use-case` | |
| `use-case` | the controls of `scaffold`, then `application/handler-shape`, `application/command-query-separation`, `domain/aggregate-encapsulation`, `domain/value-object-class`, `domain/value-object-immutability`, `domain/no-generic-error`, `domain-events/dispatched-on-save`, `domain-events/transactional-before-commit`, `errors/code-listed`, `errors/code-unique`, `errors/through-factory`, `presentation/controller-shape`, `presentation/controller-delegates`, `schema/presentation-only`, `schema/no-duplicate-shape`, the tests of the context run by `verify-slice` | |
| `integration-event` | `events/defined-in-published-language`, `events/name-declared-once`, `events/name-format`, `events/outbox-required`, `events/consumer-idempotent`, `event-sourcing/upcaster-required` (the stored-events lock), the event catalog and the AsyncAPI document compared by `docs --check` | |
| `wiring` | `ports/abstract-class`, `ports/no-token-constant`, `ports/no-concrete-dependency`, `ports/implements-never-extends`, `ports/value-import`, `declarations/role-declared`, `declarations/constructor-injection`, `declarations/barrel-current`, `declarations/port-adapter-wired`, `composition/only-in-module`, the barrel regenerated by `docs` | |
| `persistence` | `layer/domain-purity`, `layer/application-inward`, `files/port-not-connector`, `persistence/migration-history`, `persistence/primary-key-order`, `persistence/no-file-content`, `tenancy/scoped-statement`, the contract suites, the coverage floor of `infrastructure/` (`test/coverage-governed`) | an adapter without its contract suite is reported by `test/spec-required` only when its spec file is missing |
| `access-control` | `authz/declared`, `authz/granted`, `authz/in-application`, `authz/actor-explicit`, `authz/policy-asked`, `authz/scope-narrows`, `authz/resource-modelled`, `authz/system-actor-granted`, `authz/fields-by-schema`, `presentation/guard-at-the-edge` | |
| `cross-cutting` | `aspects/outside-in`, `tracing/platform-only`, `standard/no-parallel-interface`, `purity/no-system-clock`, `purity/no-ambient-randomness`, `purity/no-environment`, `presentation/shared-cache-varies` | |
| `testing` | `test/no-mocks`, `test/spec-required`, `test/builder-required`, `test/helper-placed`, `test/coverage-governed`, `test/acceptance-black-box`, the shape of a test (`test/no-only-no-skip`, `test/title-states-a-rule`, `test/no-logic`, `test/assertion-present`, `test/refusal-by-code`, `test/no-snapshot`), the acceptance lock | a regression spec is locked only inside a fix story |
| `clean-code` | `clean/stepdown`, `clean/function-size`, `clean/file-size`, `clean/blank-lines`, `clean/braces`, `clean/one-export-per-file`, `clean/no-escape-hatch`, `clean/no-commented-out-code`, `clean/no-noise-comment`, `clean/no-flag-argument`, `clean/no-hash-private`, `clean/no-magic-number`, `clean/formatted` (Biome in the commit hook and in the pipeline), `language/no-technical-name` | the formatter runs at the commit and in CI, not at the write |
| `document` | `docs --check` (`npm run docs:check`, the `docs` gate of the pipeline), `declarations/barrel-current`, `tree/context-doc`, `sdk --check` | |
| `extract-service` | `context/extractable`, `context/published-language-only`, `imports/alias-only`, the per-context entry point `generate service` writes and its boot test | |
| `deviation` | `governance/recorded-deviation`, `config/suppression-needs-reason`, `config/rule-off-everywhere`, the guard asks the owner before a suppression, a skipped test or a change of the rules | |
| `quality-gate` | `npm run verify`, the `Stop` hook of the guard (it refuses to finish while architecture errors remain in uncommitted changes), the `gate` job of the pipeline | |
| `commit-discipline` | `check --commit-size` (advice), commitlint in the `commit-msg` hook and the title check of the pipeline | the size is advised, never refused: a choice of the kit, kept |

Two gaps belong to no skill: a secret in a diff is caught by gitleaks in the pipeline only, and
the layout of a file is settled at the commit, not at the write.

## Evals of your own skills

A project that writes skills of its own (a policy of the organisation, a convention of a team)
can hold them to the same test: an `evals/` directory next to them, run by `claude plugin eval`,
one case per promise, with the project's real tasks as prompts and graders that read the result.
The kit generates nothing for it: the playbook's suite is built from the tasks of the project,
which no template knows. The suite of the plugin itself, under `plugin/evals/` of the
repository, is a worked example, and [CONTRIBUTING.md](../../CONTRIBUTING.md#the-eval-suite-of-the-plugin)
says how a case is written, when one is added and what it costs.

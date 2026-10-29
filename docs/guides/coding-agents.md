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

The hook is the part that makes the rest binding. In a project that has a
`ddd-ts-kit.config.json` it reminds the workflow and the context map at session start, says
when the installed packages are not the version the skills describe, refuses
a hand-written file where a generator exists, any edit of a generated contract and the writing
of the baseline of the errors (`check --baseline write`, or an edit of `ddd-ts-kit-baseline.json`:
the project owner writes it, in a terminal), refuses a git command that skips the hooks of the
project (`--no-verify`, `-n` on a commit, `-c core.hooksPath=...`, `LEFTHOOK=0` or `HUSKY=0`: the hooks are the local gate
of the pipeline), asks the
project owner before a suppression, a skipped test or a change of the rules is written, checks
every written file and returns the violations with their fix (with `"dependenciesBeforeWrite": true`, on trial,
it refuses before the write a new import that breaks a dependency rule), and refuses to finish while
architecture errors remain. With `"formatOnWrite": true` in the config (written by `init` for a new project), it first runs the Biome
the project installed on the written file (`node_modules/.bin/biome format --write`, one file,
never another formatter), so that the layout is settled at the write and the lint findings
that follow a wrapped line come back in the same output; a run that fails changes nothing. It reminds, without blocking, when the uncommitted changes exceed
the advised size of a commit, and in a worker's worktree (`.ddd-ts-kit/worker.json`) it
refuses a write outside the worker's context, by the editor tools or by the shell (`sed -i`, a
redirection, `tee`, `cp`, `mv`, `rm`), stops the worker when its inline code (`node -e`, a heredoc)
changed a file outside it, and refuses a dependency change and another formatter than `npm run format`.
For a `context-builder`, it counts the tool calls inside those same hooks and warns the agent
twice before its turn limit, records its runs in its worktree (`.ddd-ts-kit/agent.json`), and
listens to two rare events of Claude Code, filtered by that agent: `SubagentStart` (a launch or a
resume starts a new count) and `SubagentStop` (when it ends on its own, it is kept going once to
commit a slice that passed `verify-slice` or to rewrite a stale report). At session start, it
names the workers to resume ([parallel work](parallel-work.md#when-an-agent-stops)). In a project
`init` created (`"worktrees": "required"`), it refuses the code of a context and the generators
that write it in the main checkout of the trunk, and in a worktree of `.worktrees/` without its
own `node_modules`: `npx ddd-ts-kit worktree <name>` opens the place to write it; a project
started before is only told at session start. In the
worktree of a story (`.ddd-ts-kit/story.json`), it refuses any code of a context until each row
has its design review and the acceptance is written and locked, says the phase of the story at
session start with where it meets the other open stories, says once per file when the session
writes a file another open story changes, and refuses once to end the session before its report
([story workflow](story-workflow.md)). In the worktree of a fix (`"kind": "fix"` in that file),
it opens the code once the regression spec is locked, and refuses every edit of a locked spec,
by the editor tools and by the shell, to its sub-agents; the session itself may write a new version,
which `acceptance` reports and the `acceptance-judge` agent rules on. A command that names the lock
of an acceptance or a verdict may move or check a path (`cd`, `pushd`, `popd`, `pwd`, `test`), read
the file (`cat`, `grep`, `sed` without `-i`, `awk`, `less`, `jq`), version it (`git`) or run the kit;
any other program, or a redirection to a file, is a write, which only the CLI and that agent make. No hook
runs on every tool call: an ordinary session starts no more processes than before. It fails open: a broken guard never blocks work, which makes it a guide, not a security boundary: to isolate an agent, see [Sandboxing coding agents](agent-sandbox.md). Set
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
| `plan-slices` | `status`, `story-check` and `worker-scope --rows` read the rows of `slices.md` and refuse an unknown one; `plan-waves` replays the generator commands of the rows and refuses a name whose words the glossary does not define; `verify-slice` | the order of the rows is advised (`plan-waves`), never refused |
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
| `quality-gate` | `npm run verify`, the `Stop` hook of the guard (it refuses to finish while architecture errors remain), the `gate` job of the pipeline | |
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

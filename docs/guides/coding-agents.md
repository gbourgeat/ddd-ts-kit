**English** · [Français](coding-agents.fr.md)

# The plugin for coding agents: Claude Code, Codex, GitHub Copilot

The [ddd-ts-kit repository](https://github.com/gbourgeat/ddd-ts-kit) is the marketplace of the plugin
for the three agents:

| Agent | Install | A skill is called |
|---|---|---|
| Claude Code | `/plugin marketplace add gbourgeat/ddd-ts-kit`, then `/plugin install ddd-ts-kit@ddd-ts-kit` | `/ddd-ts-kit:start` |
| Codex | `codex plugin marketplace add gbourgeat/ddd-ts-kit`, then install `ddd-ts-kit` from `/plugins` and trust its hooks in `/hooks` | `$start` |
| Copilot CLI | `copilot plugin marketplace add gbourgeat/ddd-ts-kit`, then `copilot plugin install ddd-ts-kit@ddd-ts-kit` | by its name, `start` |
| Copilot cloud agent, VS Code | declared by the `.github/copilot/settings.json` that `init` writes: the cloud agent installs it, VS Code recommends it | by its name, `start` |

Twenty-three skills, in the order a project meets them:

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
| `story` | take one user story from its questions to a green pull request in one session, one story per terminal (run by the user; [story workflow](story-workflow.md)) |
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

Five agents: `domain-explorer` (read-only answers about what exists and where),
`context-builder` (builds the slices of one context in its own worktree),
`domain-test-writer` (turns `it.todo` entries into specs) and `architecture-reviewer`
(read-only review of a diff, a branch or a context), and `acceptance-judge` (judges a change to a
locked acceptance test, independently of the session that made it, and writes its verdict).

The hook is the part that makes the rest binding. In a project that has a
`ddd-ts-kit.config.json` it reminds the workflow and the context map at session start, says
when the installed packages are not the version the skills describe, refuses
a hand-written file where a generator exists and any edit of a generated contract, asks the
project owner before a suppression, a skipped test or a change of the rules is written, checks
every written file and returns the violations with their fix, and refuses to finish while
architecture errors remain. It reminds, without blocking, when the uncommitted changes exceed
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
([story workflow](story-workflow.md)). No hook
runs on every tool call: an ordinary session starts no more processes than before. It fails open: a broken guard never blocks work, which makes it a guide, not a security boundary: to isolate an agent, see [Sandboxing coding agents](agent-sandbox.md). Set
`"guard": "advise"` in the config to be asked instead of refused, `"off"` to silence it.

Each agent gets what its host runs. The skills work in all three. The five agents are sub-agents
of Claude Code; Codex loads no agent from a plugin, and one session per worktree takes the place
of `context-builder`. The hook runs wherever the host runs the hooks of a plugin: it reads the
patches of Codex and the tool calls of Copilot as well as those of Claude Code. Codex cannot put
a question to the user, so what Claude Code asks the project owner is said to the user there,
and left to the checks of the pipeline.

Without any plugin, a project still guides every agent: `init` writes `AGENTS.md`, the guide
Codex, Copilot and most agents read (`CLAUDE.md` imports it), the rules by layer for Claude Code
in `.claude/rules/` and the same rules for Copilot in `.github/instructions/`, scoped by
`applyTo`, and, with the GitHub pipeline, `copilot-setup-steps.yml`, which installs the project
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
| `plan-slices` | `status`, `story-check` and `worker-scope --rows` read the rows of `slices.md` and refuse an unknown one; `verify-slice` | the order of the rows is advised (`plan-waves`), never refused |
| `parallel-work` | the worker guard (`.ddd-ts-kit/worker.json`: a write outside the context is refused, by the editor tools and by the shell), `verify-merge`, `merge-trunk`, `status --workers` | |
| `story` | `story --gate build` and `--gate close`, the guard in the worktree of a story (no code before the design review and the lock), `acceptance --lock`, `test/acceptance-black-box`, the `acceptance-judge` agent | the code is not compared with its design review after the build |
| `scaffold` | the guard refuses a hand-written file of a role; `tree/closed`, `tree/documented-paths`, `naming/suffix`, `naming/one-concept-per-file`, `naming/business-name`, `naming/search-not-list`, `test/spec-required`, `test/builder-required`, `lifecycle/status-through-machine`, `process/sends-commands-only`, `scheduling/job-name`, `scheduling/job-triggers-use-case` | |
| `use-case` | the controls of `scaffold`, then `application/handler-shape`, `application/command-query-separation`, `domain/aggregate-encapsulation`, `domain/value-object-class`, `domain/value-object-immutability`, `domain/no-generic-error`, `domain-events/dispatched-on-save`, `domain-events/transactional-before-commit`, `errors/code-listed`, `errors/code-unique`, `errors/through-factory`, `presentation/controller-shape`, `presentation/controller-delegates`, `schema/presentation-only`, `schema/no-duplicate-shape`, the tests of the context run by `verify-slice` | |
| `integration-event` | `events/defined-in-published-language`, `events/name-declared-once`, `events/name-format`, `events/outbox-required`, `events/consumer-idempotent`, `event-sourcing/upcaster-required` (the stored-events lock), the event catalog and the AsyncAPI document compared by `docs --check` | |
| `wiring` | `ports/abstract-class`, `ports/no-token-constant`, `ports/no-concrete-dependency`, `ports/implements-never-extends`, `ports/value-import`, `declarations/role-declared`, `declarations/constructor-injection`, `declarations/barrel-current`, `declarations/port-adapter-wired`, `composition/only-in-module`, the barrel regenerated by `docs` | |
| `persistence` | `layer/domain-purity`, `layer/application-inward`, `files/port-not-connector`, `persistence/migration-history`, `persistence/primary-key-order`, `persistence/no-file-content`, `tenancy/scoped-statement`, the contract suites, the coverage floor of `infrastructure/` (`test/coverage-governed`) | an adapter without its contract suite is reported by `test/spec-required` only when its spec file is missing |
| `access-control` | `authz/declared`, `authz/granted`, `authz/in-application`, `authz/actor-explicit`, `authz/policy-asked`, `authz/scope-narrows`, `authz/fields-by-schema`, `presentation/guard-at-the-edge` | |
| `cross-cutting` | `aspects/outside-in`, `tracing/platform-only`, `standard/no-parallel-interface`, `purity/no-system-clock`, `purity/no-ambient-randomness`, `purity/no-environment`, `presentation/shared-cache-varies` | |
| `testing` | `test/no-mocks`, `test/spec-required`, `test/builder-required`, `test/helper-placed`, `test/coverage-governed`, `test/acceptance-black-box`, the acceptance lock | the regression spec of a fix is not locked: only the acceptance scenarios of a story are |
| `clean-code` | `clean/stepdown`, `clean/function-size`, `clean/file-size`, `clean/blank-lines`, `clean/braces`, `clean/one-export-per-file`, `clean/no-escape-hatch`, `clean/no-commented-out-code`, `clean/no-noise-comment`, `clean/no-flag-argument`, `clean/no-hash-private`, `clean/no-magic-number`, `clean/formatted` (Biome in the commit hook and in the pipeline), `language/no-technical-name` | the formatter runs at the commit and in CI, not at the write |
| `document` | `docs --check` (`npm run docs:check`, the `docs` gate of the pipeline), `declarations/barrel-current`, `tree/context-doc`, `sdk --check` | |
| `extract-service` | `context/extractable`, `context/published-language-only`, `imports/alias-only`, the per-context entry point `generate service` writes and its boot test | |
| `deviation` | `governance/recorded-deviation`, `config/suppression-needs-reason`, `config/rule-off-everywhere`, the guard asks the owner before a suppression, a skipped test or a change of the rules | |
| `quality-gate` | `npm run verify`, the `Stop` hook of the guard (it refuses to finish while architecture errors remain), the `gate` job of the pipeline | |
| `commit-discipline` | `check --commit-size` (advice), commitlint in the `commit-msg` hook and the title check of the pipeline | the size is advised, never refused: a choice of the kit, kept |

Two gaps belong to no skill: a secret in a diff is caught by gitleaks in the pipeline only, and
the layout of a file is settled at the commit, not at the write.

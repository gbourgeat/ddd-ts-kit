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

Twenty-two skills, in the order a project meets them:

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

Four agents: `domain-explorer` (read-only answers about what exists and where),
`context-builder` (builds the slices of one context in its own worktree),
`domain-test-writer` (turns `it.todo` entries into specs) and `architecture-reviewer`
(read-only review of a diff, a branch or a context).

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
changed a file outside it, and refuses a dependency change and another formatter than `npm run format`. It fails open: a broken guard never blocks work. Set
`"guard": "advise"` in the config to be asked instead of refused, `"off"` to silence it.

Each agent gets what its host runs. The skills work in all three. The four agents are sub-agents
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

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
names the workers to resume ([parallel work](parallel-work.md#when-an-agent-stops)). In the
worktree of a story (`.ddd-ts-kit/story.json`), it refuses any code of a context until each row
has its design review and the acceptance is written and locked, says the phase of the story at
session start with where it meets the other open stories, says once per file when the session
writes a file another open story changes, and refuses once to end the session before its report
([story workflow](story-workflow.md)). No hook
runs on every tool call: an ordinary session starts no more processes than before. It fails open: a broken guard never blocks work. Set
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

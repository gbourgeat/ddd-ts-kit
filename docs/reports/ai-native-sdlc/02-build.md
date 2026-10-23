# Stage 3: build

**Summary.** The build stage of the playbook has six plays: plan mode as the default start,
auto mode once the guardrails hold, `CLAUDE.md` as the knowledge of a new joiner, skills as
institutional knowledge, hooks as build-time guardrails, and parallel sessions with
subagents. This is the stage where the kit is strongest: the design review before the code,
the guard at each write, the worktree per story or per worker, the agents. The proposals are
small and precise: compare the code with its design after the build (P4), give `AGENTS.md` the
two sections the playbook's `CLAUDE.md` has and the kit's lacks (P5), write down which
deterministic control backs each skill (P6) and close the two that have none, the formatter on
write (P7) and secrets before the commit (P8), write the permission profile of a regulated
organisation (P9), and, lower, a fresh-context verifier at the close of a story (P10).

## Plan mode as the default starting point

**The playbook.** The session starts in plan mode with the spec; the plan names the files that
change, the order of work, the risks and the proof; the engineer interrogates it (what could it
break, which step is riskiest, what was not chosen) until someone who never saw the conversation
could implement it; the plan is committed as `plan.md`; the PR review later checks the diff
against it; when the implementation departs from the plan, the plan is updated in the same
commit, *consider a hook to enforce synchronisation*. Measured by the share of changes merged
from the first pass and how often the merged diff still matches the plan.

**The kit.** Phase 3 of a story writes `docs/architecture/reviews/<code>.md`, one section per
row with the aggregate, the invariants, the command and its permission, the events, the errors,
the route, the ports, the contract read from another context, the specs it changes, every
name in backticks; `architecture-reviewer` reads it as a design review; `cited --rows` lists the
names it cites that the trunk replaced; the guard refuses the code of a context until each row
has its section. The interrogation of the plan is the reviewer's blocking findings. Plan mode
itself (the host's) is not needed: the guard closes the code until phase 5.

What is missing is the end of the play: nothing compares the built row with its section, and
the report's *compromises* list is written by the same session that departed from the design.

### P4. The code against its design, at `story-check`

**What.** `story-check <code>` gains a pass: for each row `done`, every class, method and path in
backticks in its section of the design review exists in the tree (the checker already parses
names for `cited`), or the `## Report` lists it under *Compromises* with a reason. A name that
neither exists nor is listed is a blocker with its `file:line` in the review. At the stop of a
row (the `Stop` hook, when the diff of the row touched none of the names of its section), the
guard says once: *the row departed from its design: update the review section or list the
compromise*.

**Why.** It is the playbook's lagging indicator (*how often the merged diff still matches the
committed plan*) turned into a gate, and it keeps the design review true for the next story
that reads it with `cited`.

**Cost.** Medium: the name extraction exists; the pass and the hook message are new; a test of
the CLI on the scheduling example.

## Auto mode

**The playbook.** Once a tuned `CLAUDE.md`, policy skills, blocking hooks and a runnable test
suite exist, the agent applies each change without a per-edit prompt; the engineer reviews
artefacts after longer autonomous sessions; worktrees make it parallel.

**The kit.** This is how a story already runs: phase 1 asks, phases 2 to 8 do not stop, and
`init` writes `.claude/settings.json` with the allow list of the inner loop (`check`,
`generate`, `verify`, the tests, the story commands), a deny list (`.env`, the generated
contracts, the acceptance lock) and an ask list (`git push`, `npm publish`, the files that hold
the rules and the pipeline). `doctor` reports the permissions this version writes and the
project lacks.

### P9. The permission profile of a regulated organisation

**What the playbook adds** in its worked example, deployed as managed settings the engineer
cannot override: deny reads of secrets and arbitrary egress (`WebFetch`, `curl`, `wget`);
pre-approve the safe inner loop so the deny list does not become prompt fatigue;
`disableBypassPermissionsMode` and `allowManagedPermissionRulesOnly`; the sandbox enabled, failing
if unavailable, no unsandboxed retry, a domain allow list, credential files and variables denied;
`allowManagedHooksOnly`, `disableSideloadFlags`, `allowManagedMcpServersOnly`, a strict known
marketplace, a minimum version. It also lists, for the build phase, blocking edits to migrations
and infrastructure without a change ticket.

**Proposal.** Two levels:

1. In `init`, today's lists gain the paths the playbook names and the kit knows: `ask` on
   `Edit(./src/platform/database/migrations/**)` (or the ORM's folder), `Edit(./Dockerfile)`,
   `Edit(./docker-compose.yml)`, `Edit(./docker/**)`; `deny` on `Read(./docker/.env*)` where the
   compose file reads one. `doctor` reports them like the others. Cheap, and it is the playbook's
   *change ticket on a migration* in its weakest, non-blocking form (the stronger form is P18).
2. `init --agent-profile regulated` (and the matching key `agents.profile` in the config) writes
   the sandbox block of `.claude/settings.json` with the registry and the git host of the project
   as allowed domains, `failIfUnavailable`, `allowUnsandboxedCommands: false`, the credential
   denials of `~/.ssh` and the cloud credential files, and prints the managed-settings keys the
   platform team has to set outside the repository (`allowManagedHooksOnly`,
   `strictKnownMarketplaces` with `gbourgeat/ddd-ts-kit` or the organisation's mirror,
   `requiredMinimumVersion`) as a block to paste, since a project file cannot set them. The
   [sandbox guide](../../guides/agent-sandbox.md) gains the worked example with each line's
   control value, as the playbook does, next to its OpenShell section.

**What each host runs.** The permission lists are Claude Code's; `init` already writes the
Copilot settings beside them, and Codex has its own sandbox modes: the guide says which keys
have an equivalent and which do not.

**Compliance value.** The playbook's reading of each line (*what each line buys, in control
terms*) is what an auditor asks for. Writing the profile once in the kit saves every project
the research, and `doctor --strict` holds it.

## The `CLAUDE.md`

**The playbook.** Under a page; commands, conventions, architecture, and *the things Claude gets
wrong*; the rule of two: when the agent makes a mistake twice, the correction goes in the file;
reviewed like code; measured by how often a mistake the file should have caught repeats, and by
the time to a newcomer's first merged pull request. The test play adds a *Verifying your work*
block: each command with its healthy output, *run all three before reporting done and paste the
output; if a test fails, fix the code, not the test*.

**The kit.** `init` writes `AGENTS.md` (imported by `CLAUDE.md`), with the commands, *Read less*,
the rules by layer in `.claude/rules/` and `.github/instructions/`, the generated files, the
import rules, TypeScript, the workflow. It is close to a page and it is reviewed like code. Two
things of the playbook's file are absent.

### P5. Two sections of `AGENTS.md`, and the rule of two

**What.** The template of `AGENTS.md` gains:

```md
## Verifying your work
- `npm run verify` ends with `verify: ok` (types, lint, format, tests and their thresholds, architecture, graph, dead code, docs) <!-- the exact healthy last line, as the project prints it -->
- `npx ddd-ts-kit check --changed-since <ref>` ends with `0 error(s)`
- `npm run test:e2e -- test/acceptance/<story>` prints no `pending`
Run them before reporting a task complete and paste their last lines. A failing check is fixed in the code, never in the check, the threshold or the test.

## Mistakes seen here
<!-- Owned by the team. A review finding or a TODO(review) made twice becomes one line here, or a rule of ddd-ts-kit.config.json when the kit has one. Keep it short: a stale line costs every session. -->
- 
```

and the `architecture-reviewer` agent, the `quality-gate` skill and the close phase of the
story get the rule of two: *a finding that a previous story already reported (same rule id or
same remark on the same layer) is reported with the line to add under `## Mistakes seen here`,
or with the config change when a rule of the kit covers it*. `ddd-ts-kit measures` (P23)
counts the repeats so the team sees when the file is stale.

**Why.** The playbook's measure for `CLAUDE.md` is the repeat rate; the kit has the data (the
markers, the findings in the review files once P21 keeps them) and no place to write the
lesson. The healthy-output lines are what lets a session judge *done* without asking.

**Cost.** Small: a template, three skill paragraphs, the French twin of the guide that quotes
the template.

## Skills as institutional knowledge

**The playbook.** Write a skill for knowledge that must be applied consistently; test that it
triggers; when the policy changes, change the skill and have the owner sign off; *a skill is an
advisory control; a policy that must always hold needs something deterministic behind it, a
hook that blocks the action or a review pass that re-checks it at the PR*. Measured by the time
from a policy change to the merged skill, and by review findings that cite the policy, which
should fall to zero.

**The kit.** Twenty-three skills, and most of their policies are held by a rule id, a gate of the
guard or a check of the pipeline. The table below is what P6 would put in the coding-agents
guide; the two rows without a deterministic control are P7 and P8.

### P6. The control behind each skill, written down

| Skill | Deterministic control behind it | Gap |
|---|---|---|
| `start`, `plan-slices` | `status` reads `plan.md` and `slices.md`; `story-check` reads the rows | the shape of `plan.md` is read, not checked |
| `discover-domain`, `bounded-contexts`, `context-map` | `context/no-cycle`, `context/declared-relationship`, `context/published-language-only`, `docs --check` | strategic truth is not checkable, as the methodology says |
| `glossary` | the generator refuses a name outside the glossary; `language/glossary-term` | |
| `bootstrap` | `init`, `npm run verify` green before the first context; the guard refuses hand-written generated files | |
| `story` | `story --gate build` and `--gate close`, the guard in the worktree of a story, `acceptance --lock`, the judge | the design is not compared with the code after the build (P4) |
| `scaffold`, `use-case` | the guard refuses a hand-written file of a role; `tree/*`, `naming/*`, `test/spec-required` | |
| `integration-event` | `events/*`, the catalog and AsyncAPI drift gate, `event-sourcing/upcaster-required` | |
| `wiring` | `ports/*`, `declarations/*`, `composition/only-in-module`, the barrel regenerated by `docs` | |
| `persistence` | `layer/*`, the contract suites, `test/*`, the coverage floor of `infrastructure/` | a repository adapter without its contract suite is reported by `test/spec-required` only when the spec file is missing |
| `access-control` | `authz/*`, `authz/fields-by-schema` | |
| `cross-cutting` | `aspects/*`, `tracing/*`, `standard/*`, `purity/*` | |
| `testing` | `test/no-mocks`, `test/spec-required`, `test/coverage-governed`, the acceptance lock | the regression spec of a fix is not locked (P11) |
| `clean-code` | `clean/*`, the size ceilings, Biome in the pipeline | the formatter runs at commit and in CI, not at the write (P7) |
| `document` | `docs --check`, `npm run docs:check`, the SDK check | |
| `extract-service` | `context/extractable`, the per-context boot test | |
| `deviation` | `governance/recorded-deviation`, `config/rule-off-everywhere`, the guard asks before a suppression | |
| `quality-gate` | `npm run verify`, the `Stop` hook | |
| `commit-discipline` | `check --commit-size` (advice), commitlint, the title check | the size is advised, never refused: a choice of the kit, to keep |
| `parallel-work` | the worker guard (`worker.json`), `verify-merge`, `merge-trunk` | |
| none | | secrets in a diff are caught by gitleaks in CI only (P8) |

**What.** Put this table in the coding-agents guide, and give each `SKILL.md` a `metadata:
holds:` list of rule ids and gates, which a test of the plugin compares with `ddd-ts-kit rules`
so the table cannot drift (the same mechanism as the rule table of `ARCHITECTURE.md`).

**Why.** The playbook's distinction (advisory skill, deterministic hook) is the argument a
regulated team needs to accept skills at all; the kit has the controls and does not show them.

## Hooks as build-time guardrails

**The playbook.** Hooks block edits to protected paths, run the formatter and linter after file
edits so drift never accumulates, keep credentials out of the diff; fast and scoped to the file;
heavy checks belong at the commit or the PR; an approval prompt during the build belongs with
the deploy gates, not here.

**The kit.** The guard: at each write, the per-file check with the violations and their fix;
refusals of generated files, of hand-written role files, of writes outside a worker's context,
of dependency changes and of another formatter; at stop, one architecture check. Nothing on
the layout, nothing on secrets before CI.

### P7. The formatter on write

**What.** `guard.formatOnWrite` (default `on` for a project `init` creates, `off` for an adopted
one): the `PostToolUse` hook runs `biome format --write <file>` on the written file, then the
per-file check as today. Biome formats a file in milliseconds; the guard's post-write budget is
fifteen seconds. The `clean-code` skill and `AGENTS.md` already say *do not spend tokens on line
breaks*; this makes it true, and the lint's blank-line findings that follow a wrapped statement
appear at once, in the same hook output, instead of at the commit.

**What each host runs.** The hook runs wherever the host runs plugin hooks: all three.

**Cost.** Small, with one caution: the hook must never run a formatter the project did not
install (the guard already refuses Prettier and a bare `npx biome` to a worker; it uses
`node_modules/.bin/biome` or does nothing).

### P8. Secrets before the commit

**What.** The `lefthook.yml` of `init` gains a pre-commit job `secrets` running
`gitleaks protect --staged` when the binary is on the path (`skip` otherwise, with a line
saying so), and the pipeline README says that CI scans the full history anyway. The guard's
`pre-write` does not scan content: a false refusal in a hook that fails open is worse than a
late finding in CI.

**Cost.** Small; the `doctor` command lists the job among the hooks it expects.

## Parallel sessions and subagents

**The playbook.** One engineer runs two or three sessions, each in its worktree, on tasks that
touch different files; repeated jobs become subagents in `.claude/agents/`: a verifier that runs
the app and checks the behaviour against the plan without fixing anything, a simplifier, a
researcher. Measured by concurrent sessions per engineer while review quality holds, and by
changes merged per engineer alongside the rework rate.

**The kit.** This play is where the kit is furthest ahead: `worktree`, `story-scope` (refuses a
story open elsewhere, cuts from the trunk's remote), `worker-scope` with a briefing and a turn
budget, `stories` (where open stories meet, computed with `git merge-tree`), `merge-trunk`,
waves, the guard that confines a worker to its context, five agents (`domain-explorer` is the
researcher, `architecture-reviewer` the reviewer, `domain-test-writer`, `context-builder`,
`acceptance-judge`), the resume of a stopped worker.

### P10. A fresh-context verifier at the close of a story

**What.** A sixth agent, `story-verifier`, read-only, launched at phase 7 after the reviewer:
it starts the application the way the end-to-end tests do, exercises each route the story's
rows added or changed and the two nearest flows, reads the design review and the report, and
reports what it ran, what it saw, and any behaviour that does not match the design or a
`D<n>` decision; it fixes nothing. The playbook's point is that the verdict of a fresh context
is not coloured by the assumptions that produced the code.

**Why it is low in the roadmap.** The acceptance tests already prove each criterion through the
API before and after the code, which is a stronger check than an agent exercising routes. The
verifier adds the *nearest neighbouring flows* and a reading of the compromises, which is worth
having once P4 and P21 exist. Codex and Copilot run no agent of the plugin: the close phase
would say it was skipped.

## Measures of this stage

| Indicator | Playbook | Kit, computed by P23 |
|---|---|---|
| first-pass merges | changes merged from the first implementation pass | stories whose pull request merged without a commit after the first `review` round, from the PR history |
| plan drift | how often the merged diff still matches `plan.md` | rows that passed P4 without a compromise |
| `CLAUDE.md` effectiveness | mistakes repeated that the file should have caught | findings with the same rule id or remark across two stories |
| parallelism | concurrent sessions per engineer, from the OpenTelemetry export | stories open at once per author, from `stories` and git |

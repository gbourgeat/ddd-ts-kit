**English** · [Français](direction-from-neighbouring-tools.fr.md)

# Proposal: where to take the kit next, from what neighbouring tools do

**Summary.** Sixteen tools stand near ddd-ts-kit: methods that organise the work of a coding
agent (GitHub Spec Kit, BMAD-METHOD, Superpowers, Kiro, Agent OS), plugins that hold a DDD
architecture (BULDEE/ai-craftsman-superpowers, Softtor/nestjs-hexagonal), tools that hold the
import boundaries of a TypeScript tree (Nx, Sheriff, eslint-plugin-boundaries,
dependency-cruiser, ArchUnitTS) and runtimes for CQRS and event sourcing (@nestjs/cqrs, Emmett,
KurrentDB, Booster). Their documentation was read on 2026-10-25. This page keeps what one of them
does that the kit does not, and turns it into nine proposals, rated by the value for a user, the
cost to build and to keep, and the relevance to what the kit is for: a TypeScript backend in DDD,
held by tools. It also lists what the comparison suggests and this page does not propose, with
the reason. Nothing here is built.

## Status (2026-10-25)

**Proposed, not built.** The order below is the proposed order of work: the tier first, then the
relevance, then the value per cost.

| # | Proposal | Seen in | Value | Cost | Relevance | Tier |
|---|---|---|---|---|---|---|
| 1 | [Say exactly what the guard does, and the true counts](#1-say-exactly-what-the-guard-does-and-the-true-counts) | ai-craftsman-superpowers, nestjs-hexagonal | high | low | high | now |
| 2 | [A guide to compose the kit with a general method and with Nx](#2-a-guide-to-compose-the-kit-with-a-general-method-and-with-nx) | Spec Kit, BMAD, Superpowers, Nx | high | low | high | now |
| 3 | [Property tests proposed from invariants and criteria](#3-property-tests-proposed-from-invariants-and-criteria) | Kiro | medium | low to medium | high | now |
| 4 | [The stack of an existing project read from its manifest](#4-the-stack-of-an-existing-project-read-from-its-manifest) | Agent OS | medium | low | medium | now |
| 5 | [A baseline of the findings of the checker](#5-a-baseline-of-the-findings-of-the-checker) | dependency-cruiser, ESLint | high | medium | high | next |
| 6 | [The dependency rules refused before the write, on trial](#6-the-dependency-rules-refused-before-the-write-on-trial) | ai-craftsman-superpowers, Kiro | medium | medium | high | next |
| 7 | [More hosts, chosen by what they run](#7-more-hosts-chosen-by-what-they-run) | Spec Kit, Superpowers | medium to high | medium, then recurring | medium | next |
| 8 | [A read-only MCP server over the facts of a project](#8-a-read-only-mcp-server-over-the-facts-of-a-project) | Nx, KurrentDB | medium | medium | medium | next |
| 9 | [A KurrentDB event store, on demand](#9-a-kurrentdb-event-store-on-demand) | Emmett, KurrentDB | low for most, high for a few | high | low | later |

## How to read the ratings

| Rating | High | Medium | Low |
|---|---|---|---|
| **Value** | most users gain from it, or it removes a reason not to adopt the kit | a part of the users gains from it, or it saves time without changing what is possible | a few users gain from it |
| **Cost** | weeks, a new package or a new protocol to keep, or a cost every release pays | days, one command or one hook changed, with its tests | hours to two days, documentation or a small change of the CLI |
| **Relevance** | it serves what the kit is for: rules held by tools on a TypeScript DDD backend | it widens who can use the kit without changing what it holds | it serves another purpose, or one user in many |

The cost counts the build, the tests the kit's rules ask for (contract suites, end-to-end runs,
the French page) and what each release pays afterwards. A proposal the comparison suggests but
whose relevance is low and whose cost is high is not proposed: it is listed under
[What this page does not propose](#what-this-page-does-not-propose).

## What the comparison showed

The kit borrows from each family, on a narrower scope, and the comparison found three places
where a neighbour goes further:

- **Reach.** Spec Kit lists 41 agent integrations, Superpowers 16 environments; the kit has three
  hosts (Claude Code, Codex, GitHub Copilot). Without the plugin, any agent that reads
  `AGENTS.md` still gets the rules and the commands, but neither the skills nor the guard.
- **The moment of the refusal.** ai-craftsman-superpowers refuses a layer violation in a hook that
  runs before the write; Kiro's Pre Tool Use hooks can block a tool, once someone writes them.
  The guard of the kit refuses four precise cases before the write (a hand-written file of a
  generated role, the code of a story before its gate, a write of a worker outside its context, a
  locked spec), and checks every written TypeScript file and `CONTEXT.md` just after, with the
  rules that judge one file, then refuses once to stop while an error remains.
- **Integration with agents and with the tooling around them.** Nx ships an MCP server
  (`nx_workspace`, `nx_project_details`, `nx_docs`, the generators); KurrentDB has one to explore
  streams and projections. Kiro derives property-based tests from the requirements. The kit has
  neither an MCP server nor a property derived from a criterion: its properties are written by
  hand, with `fast-check` added at the first one.

The comparison also showed where the kit goes further, which bounds the proposals: 122 rules
with an id, 42 kinds of generated building blocks, 25 runtime packages, governed tests (contract
suites, mutation floors per layer), the personal data of the generated code. None of the
proposals trades any of it for reach.

## 1. Say exactly what the guard does, and the true counts

**Seen in.** ai-craftsman-superpowers states its claim as "A prompt asks. This enforces." and
refuses before the write; nestjs-hexagonal checks after the write and blocks a sub-agent at its
stop, twice at most. A reader who compares the kit with them reads the README of the kit.

**The kit today.** The README of the repository says that "the hook of the plugin refuses a write
that breaks a rule", which is what ai-craftsman-superpowers does and not what the guard does (see
[What the comparison showed](#what-the-comparison-showed)). It also gives counts behind the code:
36 kinds of building blocks (the generator has 42), twenty-two skills and five agents (the
plugin has 26 skills and 6 agents; the index of the documentation says twenty-five), and "the nine steps" where `/ddd-ts-kit:start` conducts
seven (the methodology has nine; the gate and the documents come back with each slice).

**The proposal.** One documentation pull request: the sentence on the guard rewritten as what it
does (refuses four cases before the write, checks the written file just after and names the
broken rule to the agent, refuses once to stop while an error remains, holds every rule before
the merge and in the pipeline); the counts corrected; and a test of the documentation that reads
the counts from the source (the kinds of `generate --help`, the skills and agents of `plugin/`)
and fails when a README states another number, the way a test already fails when section 3 of
the architecture reference names a rule the checker does not know.

**Value: high.** A claim a reader can check and find wrong costs more trust than the feature
earns. **Cost: low.** Hours, and a test of a few dozen lines. **Relevance: high.**

## 2. A guide to compose the kit with a general method and with Nx

**Seen in.** Spec Kit (constitution, specification, plan, tasks), BMAD-METHOD (product, architect,
UX and test roles from the brief to the stories) and Superpowers (TDD and planning skills, a
SessionStart hook that loads the method) organise the work of an agent for any language; Nx holds
a monorepo, its project graph, its cache and the boundaries between its projects.

**The kit today.** Its story workflow starts from a statement of needs and ends at a pull
request, for a backend. Nothing in the documentation says how a team that already uses one of
these tools adds the kit: which artefact of theirs becomes the input of which step of the kit,
where both would act on the same moment (two TDD skills, two planning steps, two hooks at the
start of a session) and which one should hold it.

**The proposal.** A guide, `docs/guides/with-other-tools.md`, one section per tool, each written
from one real session on a small project:

- Spec Kit and BMAD: their specification or their stories as the statement of needs of
  `discover-domain` and of a story; their product and UX documents left to them, the
  architecture of the backend held by the kit.
- Superpowers: what both say about tests (a failing test first, a mock only for a slow or
  external dependency), so that the two sets of skills do not contradict each other, and which
  one conducts a session.
- Nx: a kit project as one Nx project, or one per bounded context, and how the module boundary
  rule of Nx and the checker of the kit share the work instead of reporting the same import
  twice.

**Value: high.** The audiences of Superpowers (304.6 k stars) and Spec Kit (142.7 k stars) are
far larger than the kit's; a team that would have to choose between its method and the kit
chooses its method. **Cost: low.** A guide and four trial sessions, with its French page.
**Relevance: high.** The kit holds the backend, the method frames the product: the guide says
so instead of competing.

## 3. Property tests proposed from invariants and criteria

**Seen in.** Kiro derives property-based tests from the requirements of a specification
([correctness](https://kiro.dev/docs/specs/correctness/)).

**The kit today.** The `testing` skill states a law a value object holds for every value as a
property with `fast-check`, written by hand, and `fast-check` joins the development dependencies
with the first property. The acceptance criteria of a story are written and locked as
scenarios, by example.

**The proposal.** Two steps, the second only if the first earns it:

1. `generate property <context> <ValueObject>`: a spec with the arbitraries the factory of the
   value object accepts and refuses, one `it.todo` per law to state, and `fast-check` added to the
   development dependencies when it is missing.
2. In the design review of a story, a criterion that states a law over all values ("never
   negative", "the total equals the sum of the lines") is marked, and the story proposes a
   property beside its scenarios.

**What would prove it.** On the example, the mutation score of the domain with and without the
properties of its value objects, and the survivors they kill.

**Value: medium.** A property finds the edge cases examples miss; the mutation run already
measures what the tests let through, so the gain is measurable. **Cost: low to medium.** One
generator kind with its template, its spec and its end-to-end run; a paragraph in two skills.
**Relevance: high.**

## 4. The stack of an existing project read from its manifest

**Seen in.** Agent OS discovers the conventions of an existing codebase and writes them down for
the agent.

**The kit today.** `init` on an existing project skips the files that exist, and takes the stack
from its flags or its defaults (Express, zod, Drizzle, Vitest, RBAC). A project that runs on
Fastify, Prisma and Jest has to say so in five flags, and a missing one writes the default.

**The proposal.** `init --dry-run` on a directory that has a `package.json` reads its
dependencies, proposes the flags that match (`--http fastify --orm prisma --tests jest ...`) and
names each value it could not infer; the `bootstrap` skill puts the proposal to the owner. Nothing
is written without the flags being given.

**Value: medium.** It avoids a wrong default on an existing project, the first impression of the
kit there. **Cost: low.** A table from package names to stack values, and its spec. **Relevance:
medium.** It helps adoption; it does not change what is held.

## 5. A baseline of the findings of the checker

**Seen in.** dependency-cruiser records the known violations of a codebase and reports only new
ones (`--baseline`, `--ignore-known`,
[CLI reference](https://github.com/sverweij/dependency-cruiser/blob/main/doc/cli.md)); ESLint
does the same with its bulk suppressions.

**The kit today.** The ESLint preset of a project can record the findings a legacy already has in
`eslint-suppressions.json`, which then only shrinks
([Static analysis and pipeline](../tools/static-analysis-and-pipeline.md)). The checker has no
equivalent: `check --changed-since <ref>` limits a run to the files a change touched, and every
finding of a touched file counts, old or new. A team that moves an existing backend into the
canonical tree one context at a time either fixes every finding of a file it touches or records a
deviation per rule.

**The proposal.** `check --baseline write` records the findings of the checker as rule, file and
a fingerprint of the reported code that survives the lines moving; `check --baseline <file>`
reports only the findings that are not in it, and fails when the file holds a finding that is
gone, so that it only shrinks. The guard and the pipeline read the same file. Its limit, said in
the docs: a baseline makes old findings quiet, it does not make a tree outside the canonical one
checkable.

**Value: high.** Adoption on code that exists is the most common case, and today it is the
hardest. **Cost: medium.** A stable fingerprint is the hard part; then the guard, the pipeline,
`doctor` and the docs. **Relevance: high.**

## 6. The dependency rules refused before the write, on trial

**Seen in.** ai-craftsman-superpowers refuses a layer violation in a hook that runs before the
write; Kiro's Pre Tool Use hooks can block a tool.

**The kit today.** The rules that judge one file run just after the write, and the agent reads
the broken rule at once. The file is on disk in between, which matters when a session ends
before the fix, and the agent writes twice.

**The proposal.** On trial, behind a value of the `guard` setting: in `pre-write`, for the
dependency rules alone (the layers a file may import, the published language between contexts),
the guard applies the write to the current text (the whole content of a `Write`, the replacements
of an `Edit`, the patch of Codex) and refuses with the message the checker gives. The other rules
stay after the write: they judge code an agent may still be writing.

**What would prove it.** A month of sessions on the example: the writes refused, the refusals that
were wrong (a move of files whose imports are fixed by the next write is the known case), the
time the hook adds to each write against its 5 s budget.

**Value: medium.** The check after the write already names the rule at once; the gain is no bad
file on disk and one write instead of two. **Cost: medium.** Three formats of write, the budget of
the hook, the refusals of a refactoring in progress. **Relevance: high.**

## 7. More hosts, chosen by what they run

**Seen in.** Spec Kit lists 41 agent integrations, Superpowers 16 environments.

**The kit today.** Claude Code, Codex and GitHub Copilot, each with the skills and the guard; the
six agents are sub-agents of Claude Code. Every other agent that reads `AGENTS.md` gets the rules
and the commands, without the guard.

**The proposal.** A host is added when it runs the two things the kit is made of: skills, and
hooks that can refuse a tool call and read a file write. Two candidates whose documentation
describes hooks that can deny a tool call, to be verified in a real session before anything is
promised: Cursor ([hooks](https://cursor.com/docs/agent/hooks)) and Gemini CLI
([hooks reference](https://geminicli.com/docs/hooks/reference/)). For each, a page in
[The plugin for coding agents](../guides/coding-agents.md) states what runs there and what does
not, the way the page states it for Codex today.

**Value: medium to high.** Each host brings its users. **Cost: medium, then recurring.** The guard
reads the format of each host, and each host changes its format on its own calendar; the guard
test suite grows by one host each time. **Relevance: medium.** It widens who uses the kit without
changing what it holds.

## 8. A read-only MCP server over the facts of a project

**Seen in.** Nx ships an MCP server (`nx_workspace`, `nx_project_details`, `nx_docs`, the
generators, [reference](https://nx.dev/docs/reference/nx-mcp)); KurrentDB has one to explore its
streams and projections.

**The kit today.** The facts are commands an agent runs in a shell: `describe <context>`,
`list --json`, `rules`, `explain <rule>`, `status`, `check-file <path>`.

**The proposal.** `ddd-ts-kit mcp`, a stdio server with these commands as read-only tools and
`generate --dry-run` as the only one that names files, written without a dependency like the rest
of the CLI. Nothing that writes: writing stays with the generators, under the guard.

**Value: medium.** For a host with a shell, little changes; the gain is structured answers,
hosts whose shell is closed or asks each time, and the hosts of proposal 7. **Cost: medium.** The
protocol by hand, a schema per tool kept with the commands, its tests. **Relevance: medium.** It
should come after proposal 7, which says which hosts need it.

## 9. A KurrentDB event store, on demand

**Seen in.** Emmett runs on PostgreSQL, EventStoreDB, MongoDB and SQLite; KurrentDB is a database
built for event streams.

**The kit today.** The event store sits in the database of the project's ORM, on PostgreSQL, so
that the events, the outbox and the processed events share one transaction.
[Event sourcing](../concepts/event-sourcing.md) already weighs KurrentDB as a later adapter, and
says why not now: no shared transaction with the outbox, positions that are offsets rather than
the gapless numbers the contract states, a client and a server too heavy for the suites of this
repository.

**The proposal.** Nothing before a user asks with a project that needs it. Then, the outbox read
from a subscription of the store, and a contract suite that states positions as ordered rather
than gapless.

**Value: low for most, high for a few.** **Cost: high.** **Relevance: low.** A team for which event
sourcing is the core of the system is better served by Emmett or KurrentDB directly, as the
comparison says.

## What this page does not propose

| Suggested by | What | Why not |
|---|---|---|
| Spec Kit, Superpowers, ai-craftsman-superpowers | other languages than TypeScript | the value of the kit is its depth on one stack: generators, runtime packages, contract suites, the checker; a second language would halve each |
| BMAD-METHOD | product and UX roles | a general method does it better; proposal 2 composes with it |
| Nx | orchestrating a monorepo, a task cache | the [build velocity study](build-and-test-velocity.md) measured this repository and kept no orchestrator; a project that needs one keeps Nx, proposal 2 |
| nestjs-hexagonal | refusing a stop twice instead of once | the second refusal of the same errors loops more than it fixes; the pipeline holds what is left |
| Spec Kit | a catalogue of extensions open to third parties | [Which contexts deserve a preset](context-presets.md) sets the criteria of a preset first; a catalogue needs a governance the kit does not have yet |

## Limits of this page

The comparison read the documentation and the repository of each tool on 2026-10-25, not their
code in a session; a tool may do more than its documentation says. The star counts were read from
the GitHub API the same day. The ratings are a judgement, argued in each section, not a
measure: each proposal says what would prove it once built.

## Sources

Read on 2026-10-25.

- GitHub Spec Kit: <https://github.com/github/spec-kit>, <https://github.github.io/spec-kit/integrations/index.html>
- BMAD-METHOD: <https://github.com/bmad-code-org/BMAD-METHOD>
- Superpowers: <https://github.com/obra/superpowers>, its hooks <https://github.com/obra/superpowers/blob/main/hooks/hooks.json>
- Kiro: <https://kiro.dev/docs/specs/>, <https://kiro.dev/docs/hooks/types/>, <https://kiro.dev/docs/specs/correctness/>
- Agent OS: <https://github.com/buildermethods/agent-os>
- ai-craftsman-superpowers: <https://github.com/BULDEE/ai-craftsman-superpowers>
- nestjs-hexagonal: <https://github.com/Softtor/nestjs-hexagonal>
- Nx: <https://nx.dev/docs/features/enforce-module-boundaries>, <https://nx.dev/docs/reference/nx-mcp>
- dependency-cruiser: <https://github.com/sverweij/dependency-cruiser/blob/main/doc/cli.md>
- Cursor hooks: <https://cursor.com/docs/agent/hooks>
- Gemini CLI hooks: <https://geminicli.com/docs/hooks/reference/>
- Emmett: <https://github.com/event-driven-io/emmett>
- KurrentDB: <https://github.com/kurrent-io/KurrentDB-Client-NodeJS>

## See also

- [The plugin for coding agents](../guides/coding-agents.md): what the guard does, host by host
- [Static analysis and pipeline](../tools/static-analysis-and-pipeline.md): the checker, ESLint,
  dependency-cruiser, and adopting the kit in an existing codebase
- [Testing strategy](../concepts/testing-strategy.md): properties, contract suites, mutation

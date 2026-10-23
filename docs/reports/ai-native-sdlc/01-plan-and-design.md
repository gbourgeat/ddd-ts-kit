# Stages 1 and 2: the intent and the spec

**Summary.** The playbook opens the loop with two markdown artefacts: `intent.md`, written by
whoever has the idea, in their words, accepted by the product owner by merge; then `spec.md`,
produced in one session from the accepted intent under the organisation's policy skills, with
flagged concerns, and signed off by the same owner before engineering plans against it. The
kit's story workflow already produces something stricter than `spec.md` (questions answered,
acceptance criteria, rows, a design review per row, acceptance tests locked) but nothing
before it: the story starts in a terminal, with an engineer and an owner who answers. Three
proposals: an intent home and template the story reads (P1), an `## Origin` block in the story
file that records where the story came from and under which versions it was built (P2), and a
named slot for the organisation's policy skills in the design phase, with a headless mode kept
for later (P3).

## What the playbook says

| Play | Artefact | Who | Gate | Measured by |
|---|---|---|---|---|
| Capture as `intent.md` | `intent/<name>.md`: problem, proposed outcome, affected users and systems, constraints, open questions; author and status in the header | the originator, brainstorming with Claude (claude.ai or Cowork, a connector commits for them); the product owner corrects and accepts | the merge, or the closed review, of the intent | time from the first conversation to the committed intent; the survival rate of intents into design; intent edits after the first spec commit |
| Requirements and design | `spec.md` next to the intent: what was decided, with areas of concern flagged where policies contradict | Claude, from the intent, with the organisation's brand, security, compliance and UX skills loaded; the product owner reviews and routes each concern to its policy owner | the owner's sign-off; anything classed higher risk also goes to a technical lead | time between the intent commit and the spec commit; spec commits dated after the first plan commit (rework) |

Two sidebars matter here. *Legacy systems and the source of truth*: for each artefact, name one
system as the source of truth (the repository, or Jira and the requirements tool), everything
else holding a copy or a link; linkage both ways is the minimum bar. *The pair*: the intent
and the spec are committed side by side, so the record holds what was asked and what was
decided.

## What the kit has

| Playbook artefact | Nearest thing in the kit | Where |
|---|---|---|
| `intent.md` | the statement of a story, in plain words, a file or a tracker key, given as the argument of `/ddd-ts-kit:story` | `## Statement` of `docs/architecture/stories/<code>.md` |
| the product owner's acceptance of an intent | none; the owner is present at phase 1 and answers | |
| `spec.md` | phases 1 to 4 of the story: `## Questions` with the owner's answers, `## Acceptance criteria`, the rows `<code>.NN` of `slices.md`, the design review `docs/architecture/reviews/<code>.md` read by `architecture-reviewer`, the acceptance tests locked | the story skill, `story --gate build` |
| flagged concerns | the questions of phase 1 (asked once, with a recommended option), the `D<n> (provisional)` decisions, the one reason to stop (a boundary) | the story file |
| the policy skills of the organisation | the skills of the plugin (access control, cross-cutting, persistence, testing) are the kit's policies; a project's own skills under `.claude/skills/` load as any skill | nothing names them in the story file |
| the record of what was decided | `## Decisions` and `## Report` of the story file; `docs/adr/` for what constrains the future | |
| the source of truth sidebar | the story accepts a tracker key; nothing is written back; `docs/architecture/plan.md` records project-level decisions | |

The kit is ahead of the playbook on the spec: its acceptance criteria become tests that fail
before the code and cannot be rewritten by the agent that builds, which `spec.md` never
promises. It is behind on the entry: nobody but an engineer with a terminal, the plugin and the
owner at hand can start the loop, and nothing records an idea the owner has not yet accepted.

## P1. An intent home and template, read by the story

**What.** A template `intent-template.md` in the story skill, written to
`docs/architecture/intents/<slug>.md` by a new skill `intent` (run from claude.ai or Cowork with
a GitHub or GitLab connector, from Claude Code, or by hand), with the playbook's sections kept
and two added for this kit:

```md
# Intent: <title>
Author: <name> (<role>). Status: draft | accepted | closed.

## Problem
## Proposed outcome
## Affected users and systems
<contexts the author can name; the skill maps them on `npx ddd-ts-kit list` when it runs in the project>
## Constraints
## Open questions
## Acceptance, as the author would observe it
<one line per observable outcome; the story turns them into criteria>
```

The product owner accepts by changing `Status: accepted` in a pull request, which is the merge
gate of the playbook; `story-scope <code> --from docs/architecture/intents/<slug>.md` seeds the
`## Statement` of the story with the intent, pre-answers the phase 1 questions the `Constraints`
already settle (the skill lists them as answered *by the intent*), turns the `Acceptance` lines
into the first draft of the criteria, and refuses an intent whose status is not `accepted`.

**What each host runs.** The template and the status rule are files: every host reads them.
The `intent` skill asks questions where the host can (Claude Code, Cowork) and lists them as
open questions where it cannot (Codex).

**What it is not.** Not a backlog, not a replacement of the tracker. The sidebar of the playbook
applies: a project that keeps Jira as the source of truth writes the key in the intent and the
intent's path in the ticket, and the story's `## Origin` (P2) carries both.

**Cost.** One skill, one template, one flag of `story-scope`, one check in `story` that the
origin's status is `accepted`. Documentation: the story workflow guide gains a phase `-1`.

## P2. `## Origin` in the story file: where it came from, under which versions

**What.** A block the story skill fills at phase 1 and the report repeats:

```md
## Origin
- From: `docs/architecture/intents/claims-status.md` (accepted 2026-10-20 by J. Ortiz) | ticket `PROJ-412` | incident `INC-2026-10-18-checkout`
- Built with: ddd-ts-kit 0.85.0, plugin 0.85.0, on `origin/main` at `46b29acc`
- Policies in force: the skills loaded at phase 3 (`ddd-ts-kit:access-control`, `.claude/skills/pii-handling`)
```

The playbook asks for exactly this as governance evidence: *the spec, the prompt that produced
it, and the skill versions in force are all logged*. The guard already knows the versions at
session start (it compares the installed packages with the ones the skills describe); the
story skill writes them once. The pull request body, which is the report, carries the block,
so the record on the trunk links back to the intent or the ticket: the *linkage* minimum of
the sidebar, in both directions when the project writes the pull request URL in the ticket.

**Compliance value.** An auditor reading the story file sees who asked (the intent's author),
who answered (the questions), what the agent decided alone (`D<n>`), under which rules (the
versions), and who approved (the merge). The missing link, the identity of the agent in the
commits, is P21.

**Cost.** A template change, ten lines in the story skill, one line in `story --gate close`
(the block exists). No new command.

## P3. A named slot for the organisation's policy skills, and a headless mode kept for later

**What the playbook asks.** The design session runs *with the organisation's skills available*,
so brand, security, compliance and UX constraints are applied while the spec is written, and
contradictions are flagged rather than discovered in review.

**What the kit does.** The plugin's skills are the kit's own policies, and they already load
during phases 2 and 3 (`plan-slices`, the design review, `testing`). A project's own skills
load too, but the story skill never says which ones it applied, and the design review template
has no place for a policy's verdict.

**Proposal, now.** Phase 3 of the story skill gains one instruction: *list, in `## Origin`, the
policy skills loaded for this story, and in each row's section of the design review, a line
`Policies: <skill>: <what it imposed here>` when a policy changed the design.* The
`architecture-reviewer` reads that line as part of its design review. This is documentation of
what already happens, and it makes the record the playbook asks for.

**Proposal, later: the headless spec.** The playbook's end state fires the design pass on the
merge of the intent, as a non-interactive job that commits the spec as a pull request. For the
kit that means `story --headless`: phases 1 to 4 without an owner, every question that
changes an artefact written under `## Open questions` with the recommended option taken
provisionally and marked, the acceptance written and locked, the build gate closed, and a pull
request whose body is the list of questions. The owner answers in the review; the build phase
starts from the merged answers. Costly (the skill's phase 1 is interactive by design, and a
headless job needs the pipeline plumbing of P15) and lower in value than the rest of this
report while the story is run by an engineer anyway: wave 3 of the roadmap.

## What to leave as it is

- The story's single batch of questions. The playbook's owner also answers once per stage; the
  kit's batch is the same discipline with a shorter path.
- The acceptance before the code. No play of the playbook asks for less; `spec.md` is prose
  and the kit's spec is a failing test.
- `docs/architecture/plan.md` for the project level. The playbook has no project-level
  artefact; the plan is where an intent that is really a new context goes back to step 2.

## Measures of these two stages

The playbook's indicators, in the kit's terms (computed by P23 in [06-measures.md](06-measures.md)):

| Indicator | Playbook | Kit |
|---|---|---|
| time to a committed intent | from the first conversation to the commit of `intent.md` | from the creation of the intent file to its `accepted` commit |
| survival rate | intents accepted into design, against closed | intents with a story, against `closed` |
| design time | from the intent commit to the spec commit | from the story file's first commit to the lock of its acceptance |
| requirements rework | spec commits dated after the first plan commit | edits of `## Acceptance criteria` after the first slice commit of the story, and the `amend` verdicts of the judge |

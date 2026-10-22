# Report: the AI-native SDLC playbook, read against ddd-ts-kit

**Summary.** Anthropic's *AI-Native SDLC Playbook* (Louis Claxton, Applied AI, 54 pages) describes
a software lifecycle rebuilt around coding agents: six stages (plan, design, build, test, deploy,
maintain), each ending with a committed artefact the next stage reads, with humans above the
loop at named gates and governance enforced as the agent acts. This report reads each of its
fifteen plays against what ddd-ts-kit 0.85.0 already does, names the gap, and proposes what the
kit could add, ordered by what it brings to the four goals of the product: large resilient APIs,
a high level of regulatory compliance, readable and maintainable code, and a developer
experience that stays fluid and coherent as the project grows. The short answer: the kit already
holds the middle of the loop (build, test, part of review) more strictly than the playbook asks,
because its artefact chain is checked by tools and not only read by agents; what it lacks is
mostly at the two ends (how an intent enters, how production feeds back) and in the evidence
layer (the review policy as a file, the evals of the plugin, the measures).

## Sources

| Source | Version read |
|---|---|
| *The AI-Native SDLC Playbook*, Anthropic, PDF of 2026-09-23, read on 2026-10-22 | `https://cdn.prod.website-files.com/6889473510b50328dbb70ae6/6aba736348bdf4f08183f463_AI%20Native%20SDLC%20Playbook_designv2%20(1).pdf` |
| ddd-ts-kit | 0.85.0, commit `46b29acc` on `main`, 2026-10-22 |
| Claude Code | `claude plugin eval` present on the machine of this report (its help was read); the settings keys quoted from the playbook were not re-verified against the settings reference |

Quotations of the playbook are paraphrased: the original uses dashes the repository forbids.

## How to read this report

| File | Holds |
|---|---|
| this page | the verdict, the map of the fifteen plays against the kit, the goals each proposal serves, the tensions |
| [01-plan-and-design.md](01-plan-and-design.md) | stages 1 and 2: the intent, the spec, and how they map on the story workflow |
| [02-build.md](02-build.md) | stage 3: plan mode, auto mode, `CLAUDE.md`, skills, hooks, parallel sessions |
| [03-test.md](03-test.md) | stage 4: the feedback loop, the fix that cannot weaken its test, the evals of the plugin |
| [04-deploy.md](04-deploy.md) | stage 5: the review policy as a file, approval gates, code owners, the pipeline |
| [05-maintain.md](05-maintain.md) | stage 6: control bands on the kit's metrics, the incident that becomes a story, the audit trail of the lifecycle |
| [06-measures.md](06-measures.md) | the indicators of every play, and `ddd-ts-kit measures`, which would compute them from what the kit already commits |
| [07-roadmap.md](07-roadmap.md) | the proposals ordered in three waves, with their effort, their dependencies and what is left out |

Proposals are numbered `P1` to `P23` in the order they appear in the stage files; the roadmap
reorders them.

## The verdict in ten lines

1. The playbook's central idea, *every stage commits an artefact the next stage reads, and the
   chain of commits is the audit trail*, is the story workflow of the kit: statement, questions
   and answers, acceptance criteria, rows, a design review per row, acceptance tests locked
   before any code, one commit per row, a report that becomes the pull request. The kit goes
   further than the playbook on one point: the guard and `ddd-ts-kit acceptance` hold the order
   mechanically, where the playbook relies on habit and on plan mode.
2. Skills versus hooks: the playbook says a skill is advisory and a policy that must hold needs a
   deterministic control behind it. Nearly every skill of the plugin already has one (a rule id, a
   gate of the guard, a check of the pipeline). This report lists the few that do not.
3. What enters the loop is the first gap: the playbook starts with an `intent.md` written by a
   non-engineer in their own words, accepted by a product owner by merge. The kit starts at the
   story, with an owner who answers questions in a terminal.
4. What comes back from production is the second gap: the playbook closes the loop with a
   deterministic detection script, response tiers and an intent written by the agent. The kit
   emits the metrics and the audit trail that such a script would read, and stops there.
5. The review policy is the third: the playbook puts it in a `REVIEW.md` at the root, with named
   passes, a definition of *Important*, a cap on nits and an exclusion of generated paths. The
   kit's reviewer agent carries an equivalent method in its own prompt, which no human, no CI
   review and no other host reads.
6. The plugin is agent configuration, and the playbook says such configuration deserves the
   regression tests code gets: an eval suite run on every change and nightly. The plugin has unit
   tests of its guard and none of its skills. `claude plugin eval` exists for exactly this.
7. The bug fix the playbook describes (a failing test first, committed, and a hook that stops the
   agent editing test files during the fix) is the acceptance lock of the kit, restricted to
   stories. Generalising it to a regression spec is cheap and serves resilience directly.
8. Permissions: the playbook's worked example for a regulated enterprise (deny secrets and
   egress, pre-approve the inner loop, sandbox, managed hooks, approved marketplace, minimum
   version) is one profile away from what `init` already writes.
9. Measures: every play of the playbook names a leading and a lagging indicator, almost all
   readable from git and the pull request history. The kit commits everything those indicators
   need and computes none of them.
10. Non-goals: chat-channel responders, deployment tools exposed through MCP and the headless
    intent-to-spec job are platform work, not kit work; the report says what the kit should
    document for them and leaves the rest out.

## The map: fifteen plays against the kit

| Stage | Play of the playbook | What it asks | What the kit has today | Gap | Proposal |
|---|---|---|---|---|---|
| 1 Plan | Capture as `intent.md` | an idea written in the originator's words, with its template, in a version-controlled home the product owner watches; accepted by merge | the statement of a story, as the owner gives it in the terminal; `docs/architecture/plan.md` for a whole project | no artefact before the story, no entry for a non-engineer, no acceptance step of an intent | P1, P2 |
| 2 Design | Requirements and design | one session turns the intent into a spec constrained by the organisation's policy skills, with flagged concerns; later triggered by the merge of the intent | phases 1 to 4 of the story: questions, acceptance criteria, rows, a design review per row read by the reviewer agent | the spec exists and is stricter; the policy skills of the organisation have no named slot in it; nothing runs it headless | P3, P18 |
| 3 Build | Plan mode as the default start | a plan naming files, order and proof, committed as `plan.md`, interrogated before any code, updated when the implementation departs | the design review of each row, `cited` for names the trunk replaced, the guard that refuses code before it | the code is not compared with its design after the build | P4 |
| 3 Build | Auto mode | once the guardrails hold, auto-accept for routine work in a worktree | the story runs phases 2 to 8 without stopping; `init` writes the allow, deny and ask lists | a profile for a regulated organisation is not written; migrations and infrastructure are not in the ask list | P9 |
| 3 Build | `CLAUDE.md` | under a page; commands with a healthy output; the things the agent gets wrong; the rule of two (a mistake made twice goes in the file) | `AGENTS.md` written by `init`, imported by `CLAUDE.md`, with rules per layer in `.claude/rules/` and `.github/instructions/` | no section for the mistakes of the team, no healthy output next to a command, no rule of two | P5 |
| 3 Build | Skills as institutional knowledge | one skill per policy with a named owner; test that it triggers; a deterministic control behind any policy that must hold | twenty-three skills, each backed by rules, the guard or a check, except a few | the backing is not written anywhere a reader can see; two gaps (format, secrets) | P6, P7, P8 |
| 3 Build | Hooks as build-time guardrails | block protected paths, run the formatter after edits, keep credentials out of the diff, fast and scoped to the file | the guard refuses generated files, hand-written files, writes outside a worker's context, and checks each written file | the formatter does not run on write; secrets are caught in CI only | P7, P8 |
| 3 Build | Parallel sessions and subagents | a worktree per task, two or three sessions, subagents for repeated jobs (verifier, simplifier, researcher) | `worktree`, `story-scope`, `worker-scope`, `stories`, `merge-trunk`, five agents, waves | a fresh-context behaviour verifier at the close of a story | P10 |
| 4 Test | Give Claude a feedback loop | one command that exits non-zero; verification is part of done; the failing test first for a bug, committed, with a hook that blocks test edits during the fix | `npm run verify`, `verify-slice`, the guard at each write and at stop, the acceptance lock of a story | the lock covers acceptance scenarios of stories only, not the regression spec of a fix | P11, P13 |
| 4 Test | Continuous evals in CI | 20 to 50 real tasks as evals, run on any change of `CLAUDE.md`, skills or hooks and nightly; gate the configuration change on the pass rate; one eval per incident | unit tests of the guard; the skills, agents and templates are tested by use | no eval of the plugin, no gate on a skill change | P12 |
| 5 Deploy | AI in the PR review loop | `REVIEW.md` with passes (bugs, security, compliance against spec and plan), what *Important* means, nits capped, generated paths skipped; findings feed `CLAUDE.md`; the agent addresses comments and babysits its PR; a human approves | the `architecture-reviewer` agent and its method; `TODO(review)` markers tied to rows; `story-check`; branch protection documented | no review policy file; no PR review in CI; no comment-sweeping loop; no generated code owners | P14, P15, P16, P17 |
| 5 Deploy | Hooks as approval gates | gates that allow, ask or block; team hooks in the repo, non-negotiable ones in managed settings; a block explains itself | the `ask` list of `init`; the guard that asks before a suppression or a rule change | no production gate, no change reference on a migration, no managed profile | P9, P18 |
| 5 Deploy | CI/CD integration | `claude -p` for read-only judgment steps (triage a failed build), write steps behind gates, sandboxed jobs, deployment through MCP, tiers per environment, rollback rehearsed | a pipeline whose logic is npm scripts, a gate job, an image built and not pushed | the kit stops at the image; nothing says what a deployment of such a project looks like | P15, P19 |
| 6 Maintain | Closing the loop | deterministic detection on a metric, tiers in a versioned config (log, diagnose, propose), the agent writes an intent, triage, an eval per incident | `use_case_*` and `dependency_call_*` metrics, outbox and job gauges, the hash-chained audit trail, alert guidance | nothing between the metric and the next story | P20, P21 |
| 6 Maintain | Claude on call | a first responder in the incident channel, the post-mortem written to a lessons file | nothing, by design | a paragraph on how a channel request becomes an intent or a fix | P22 |
| all | How to measure it | a leading and a lagging indicator per play, from git and PR history | the artefacts those indicators need, committed | no command computes them | P23 |

## What each proposal brings to the four goals

| Goal of the product | Proposals that serve it most | Why |
|---|---|---|
| Large resilient APIs | P11 (a fix proven by a test the agent cannot rewrite), P20 (detection on the metrics the kit already emits), P19 (rollback rehearsed before the agent needs it), P4 (the code matches its design) | the playbook's point is that resilience is held by loops, not by reviews |
| Regulatory compliance | P2 and P21 (the versions in force and the findings in the record), P14 (one review policy applied to every change), P17 (separation of duties by code owners), P9 and P18 (gates the agent cannot pass), P12 (the agent's configuration regression-tested), P23 (evidence from the artefacts) | the playbook's audit trail is *who asked, what the agent produced, who approved*; the kit records the first two and should make the third mechanical |
| Readable and maintainable code | P5 (the mistakes of the team in one page), P7 (layout settled at each write), P14 (nits capped, the review spent on design), P4 | the playbook moves human attention from lines to intent and risk; the kit's checks already take the lines |
| A fluid and coherent developer experience | P7 (no tokens on line breaks), P9 (fewer prompts in auto mode), P16 (the pull request babysat to green), P1 (an entry for whoever has the idea), P12 (skills that keep working after a change), P23 (the team sees what the loop costs) | the playbook's DX claim is that the engineer steers several loops instead of watching one |

## Tensions with the playbook, and how the report settles them

- **Three hosts, one playbook.** The playbook is written for Claude Code. The kit runs on Claude
  Code, Codex and GitHub Copilot. Each proposal says what each host runs: a file read by the
  skills (`REVIEW.md`, `AGENTS.md`, the intent template) is host-neutral; the evals test the
  skills through Claude Code but the skills are shared; `claude-code-action` is GitHub only, and
  a GitLab job calls `claude -p` instead.
- **The owner answers once.** The playbook's design stage flags concerns for the product owner to
  resolve with each policy owner; the kit's story asks every question in one batch and then
  decides provisionally. The two compose: an accepted intent pre-answers part of the batch, and a
  headless mode would turn the remaining questions into flagged concerns (P3). The report keeps
  the terminal path as the default.
- **The agent that wrote the code never approves it.** The playbook and the kit agree. This report
  proposes no automatic merge on findings; the pull request review bot (P15) reports, and branch
  protection still asks a code owner (P17).
- **Attribution.** The playbook logs which agent produced what. Some teams refuse attribution
  lines in commits. P21 makes the agent trailer an option that is off by default.
- **Paid tooling.** The pipeline of the kit is free by default and paid on request (`--ci-extras`).
  A PR review bot and a build triage step consume API tokens: they follow the same rule (P15).

## See also

- [Story workflow](../../guides/story-workflow.md), [Methodology](../../guides/methodology.md),
  [The plugin for coding agents](../../guides/coding-agents.md), [Team workflow](../../guides/team-workflow.md),
  [Sandboxing coding agents](../../guides/agent-sandbox.md), [Pipeline](../../../pipeline/README.md)

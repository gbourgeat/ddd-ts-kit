# Stage 6: maintain

**Summary.** The last stage closes the loop: a deterministic script watches one metric with a
rolling baseline and rules that catch drift as well as spikes; response tiers in a versioned
config say what the agent may do at each band (log, diagnose read-only, propose through a pull
request or a pre-approved runbook); the agent writes what it finds as an intent in the
stage 1 format; a service owner triages; the fix adds an eval; detection stays entirely
deterministic, with no model involved. A second play puts the agent in the incident channel
as a first responder, writing the post-mortem to a lessons file. The kit emits what the
detection script would read (the use-case and dependency metrics with their outcome and error
code, the outbox and job gauges, the hash-chained audit trail) and has no path from a breach
to the next story. Three proposals: a closing-the-loop guide with a bands example on the kit's
own metrics and an incident record that `story-scope` accepts as an origin (P20), the audit
trail of the lifecycle itself completed (P21), and a paragraph for the channel play (P22).

## Closing the loop

**The playbook.** Pick a metric with a stable baseline (CI failure rate, post-deploy 5xx rate,
PR cycle time); a version-controlled, unit-tested detection script (mean and deviation over a
rolling window, Western Electric rules); `bands.yaml` with tiers: at one sigma log, at two
invoke Claude read-only to diagnose with named tools, at three let it propose, only through
the review gate or a pre-approved runbook; the trigger is a scheduled workflow, a webhook or a
cron, the run is stateless; the diagnosis is written as `intent.md` with the anomaly, its
evidence, a proposed outcome, the affected systems and the open questions; triage (fix now,
schedule, dismiss; dismissals tune the bands); the fix ships with an eval. Measured by the time
from breach to an intent in the queue, the share of findings that become merged fixes, and
repeat incidents of the same class.

**The kit.** The metrics the observability page documents are exactly the ones such a script
reads: `use_case_total{message, kind, outcome, error_code}` and `use_case_duration_ms` from the
bus middleware, `dependency_call_*{class, method, kind, context, outcome}` from the `timed`
aspect, the depth and the age of the oldest pending outbox record, the state of a circuit, the
absence of a successful run of a job for two intervals. The page already says which alerts
matter (symptoms and absences). The audit trail gives the diagnosis its evidence: who did what,
with which outcome, in order, tamper-evident. Nothing of the kit turns a breach into a story.

### P20. The closing-the-loop guide, a bands example, and the incident as an origin

**What.** Three pieces, documentation first:

1. `docs/guides/closing-the-loop.md`: the playbook's pattern applied to a ddd-ts-kit project.
   The detection script stays the team's (deterministic, tested, outside the kit); the guide
   gives the queries on the kit's metrics for the three breaches worth starting with, and a
   `bands.yaml` on them:

   ```yaml
   metric: use_case_failure_ratio          # use_case_total{outcome="failure"} / use_case_total, per message, 5 min
   baseline: rolling_30d
   rules: western_electric
   tiers:
     1sigma: { action: log }
     2sigma: { action: diagnose, tools: "Read,Grep,Bash(npx ddd-ts-kit describe *),Bash(gh run view *)" }
     3sigma: { action: propose, routes: [intent, runbook:rollback-deploy] }
   ```

   with two more: `outbox_oldest_pending_age_seconds` (a relay that stalled) and the absence of
   `job_run_total{job, outcome="success"}` for two intervals. The diagnose tier reads the audit
   trail of the window (the search route the platform exposes under its own permission,
   called with a read-only token the run receives for that purpose) and the traces by
   correlation id; the propose tier writes the intent (P1's template, with
   `## Evidence` holding the metric, the window, the audit entries and the deploy in the
   window) and opens the pull request that adds it to `docs/architecture/intents/`, or calls
   the rollback of P19. The guide says what a stateless run needs (the repository read-only,
   the metrics store, the CLI, no production credential) and points at the sandbox guide.
2. An incident record, `docs/architecture/incidents/<id>.md`, written by whoever handles the
   incident (a person, the channel agent of P22, or the propose tier), with the playbook's
   post-mortem in the kit's words: what was observed, the evidence, the cause by business name
   when known, what was done (rollback, runbook, nothing), what is next. It is the *lessons
   file future investigations read*; `story-scope <code> --from docs/architecture/incidents/<id>.md`
   and `fix <code>` (P11) accept it as an origin, so the `## Origin` of the fix story (P2) links
   the incident, and the locked regression spec is the incident's eval in the kit's sense.
3. The repeat-incident measure (P23): fix stories whose origin names an incident of the same
   class (the same `message` or the same `error_code`), which should fall as the locked specs
   accumulate.

**What the kit does not do.** It ships no detection script, no scheduler and no runbook: those
depend on the metrics store and the platform. The guide makes the shape precise enough that a
team writes them in a day, and the kit's part (the metrics, the audit search, the intent and
incident templates, the fix skill) is what the agent reads and writes.

**Why.** For a resilient API the loop is the point: the playbook's measure is *repeat incidents
of the same class*, and the kit's answer is a regression spec the agent could not weaken,
tied to the incident that caused it. For compliance, the incident record and the fix story
give an auditor the chain from the alert to the merged change.

**Cost.** Medium: a guide and its French twin, two templates, one flag shared with P1.

## The audit trail of the lifecycle itself

**The playbook.** *The chain of commits is also the audit trail: who asked for what, what the
agent produced, and who approved it.* Each stage logs its evidence: the intent's author and
revision history, the spec with the prompt and the skill versions in force, the plan and who
accepted it, the test output pasted, the review findings, fixes, ratings and approvals in the
pull request history, the hook decisions with a timestamp, the invocations and triage
decisions of the loop. Each non-interactive run acts under the agent's own identity, so the
log separates what the agent did from what the engineer who triggered it did.

**The kit.** The story file holds who asked, the questions and the owner's answers, the
provisional decisions, the amendments with their verdicts, the report; the design review and
the acceptance lock hold the plan and the proof; `Slice:` trailers tie commits to rows; ADRs
hold what constrains the future, with the deviations they justify; the runtime audit trail
holds what the application did. Three things are missing or weak.

### P21. The versions in force, the findings kept, the agent named (optionally)

**What.**

1. **The versions in force**: the `## Origin` block of P2 (kit, plugin, trunk commit, policy
   skills loaded).
2. **The findings kept**: at the close of a story, the review of the branch is appended to
   `docs/architecture/reviews/<code>.md` under `## Findings`, each with its pass (P14), its
   `file:line` and its outcome (fixed in `<commit>`, written as `TODO(review)`, dismissed by
   `ADR-<n>`). Today the findings live in the session's transcript and in the pull request,
   which the playbook accepts as the record; keeping them in the repository makes the rule of
   two (P5) and the repeat measure (P23) computable without the platform's API, and it survives
   a migration between GitHub and GitLab.
3. **The agent named, when the team wants it**: `commit.agentTrailer` in the config, `off` by
   default. When `on`, the story skill, the `context-builder` and the fix skill add
   `Agent: <host> <plugin>@<version> <agent name>` to each commit they make, and the report
   lists the commits made by an agent against those made by hand. Off by default because many
   teams refuse attribution lines in commits and because the playbook's own separation is by
   identity of the run, which a trailer only approximates; on, it is the playbook's *what the
   agent produced* in the one place an auditor reads.

**Cost.** Small: a template, three skill paragraphs, a config key read by the commit step.

## Claude on call

**The playbook.** Claude as a member of the incident channel under its own identity (Claude
Tag, in Slack), guided by anyone in the channel, verifying through MCP that the metric is back
in its band, writing the post-mortem to a lessons file; a small bounded fix arrives as a pull
request through the review gate, anything larger becomes an intent.

**The kit.** Nothing, and nothing should be built: the channel, the identity and the MCP
access are the platform's.

### P22. One paragraph in the closing-the-loop guide

**What.** How a request from a channel enters the kit's loop: a bounded fix is `fix <code>`
with the channel thread as its origin; a larger one is an intent (P1) with the thread's
summary; the post-mortem is the incident record of P20; the agent in the channel verifies the
metric with the same queries as the diagnose tier. No skill, no template beyond P20's.

## Measures of this stage

| Indicator | Playbook | Kit, computed by P23 |
|---|---|---|
| breach to intent | from the breach timestamp in the detection log to an intent in the queue | from the incident record's date to its intent or fix story's first commit |
| findings that ship | share of findings that become merged fixes | intents and incidents with a merged story, against `closed` |
| repeat incidents | of the same class, falling as evals accumulate | fix stories whose origin names the same `message` or `error_code` as an earlier one |

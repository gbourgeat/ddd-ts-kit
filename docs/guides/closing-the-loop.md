**English** · [Français](closing-the-loop.fr.md)

# Closing the loop: from a metric out of its band to the next story

**Summary.** A system in production feeds the next change: a deterministic script watches a
metric against its baseline, a versioned configuration says what an agent may do at each band
(log, diagnose read-only, propose), the diagnosis is written as an intent or an incident record,
a person triages, and the fix ships with a regression test the incident cannot pass again. This
page applies that pattern to a ddd-ts-kit project: the metrics the kit already emits and the
queries worth starting with, a `bands.yaml` on them, what a stateless run needs, the incident
record `story-scope --from` accepts as the origin of a fix story, and what arrives from a chat
channel. The pattern is the last stage of the
[AI-native SDLC playbook of Anthropic](https://cdn.prod.website-files.com/6889473510b50328dbb70ae6/6aba736348bdf4f08183f463_AI%20Native%20SDLC%20Playbook_designv2%20(1).pdf);
the kit's part is what the agent reads and writes, and the detection stays the team's.

## The shape of the loop

| Step | Who or what | Artefact |
|---|---|---|
| detect | a script of the team: deterministic, unit-tested, versioned, no model involved | the breach: the metric, the band, the window |
| decide the tier | `bands.yaml`, versioned with the script | log, diagnose, or propose |
| diagnose | an agent, read-only, with named tools, in a stateless run | the evidence: the audit entries, the traces, the deploy in the window |
| propose | the same agent, through a pull request or a pre-approved runbook | `docs/architecture/intents/<slug>.md`, or the runbook's result |
| triage | the owner of the service: fix now, schedule, dismiss | the intent accepted, scheduled or closed; a dismissal tunes the band |
| fix | `/ddd-ts-kit:fix <code> docs/architecture/incidents/<id>.md` | a locked regression spec, the permanent test of the incident |

Detection is never an agent: a script with a rolling baseline (mean and deviation over a
window, the Western Electric rules for drift as well as spikes) answers the same way every
time and is tested like code. What the kit gives the script is the metrics; what it gives the
agent is the audit trail, the traces, the CLI that describes the system, and two templates.

## Three breaches worth starting with

The names below are the ones the kit records through its `Metrics` port
([observability](../concepts/observability.md)); what your store shows depends on its exporter,
so read the names there once before writing the queries.

| Breach | What the kit emits | Query (Prometheus) | Starting band |
|---|---|---|---|
| a use case fails more than it did | `use_case_total{message, kind, outcome, error_code}` from `metricsMiddleware` of `@ddd-ts-kit/aspects`, one series per command or query class | `sum by (message) (rate(use_case_total{outcome="failure"}[5m])) / sum by (message) (rate(use_case_total[5m]))` | the ratio per message against its 30-day baseline; a business refusal is a failure with its `error_code`, so a message that refuses by design (a slot already taken) reads the ratio without the codes the business expects |
| the outbox relay stalled | no gauge in this version: the relay only claims pending records; the script reads the `outbox` table | `SELECT extract(epoch FROM now() - min(created_at)) FROM outbox WHERE status = 'pending'` (the age of the oldest pending record, in seconds; `outbox.<schema>` where the project put it) | above the relay's interval times three, sustained over two polls |
| a job stopped running | `scheduled_job_runs_total{job, context, status, error_code}` from `@ddd-ts-kit/scheduling`, `status="succeeded"` for a run that ran | `increase(scheduled_job_runs_total{job="notifications.send-reminders", status="succeeded"}[2h]) == 0 or absent(scheduled_job_runs_total{job="notifications.send-reminders", status="succeeded"})` (two intervals of an hourly job) | no success for two intervals, which catches every way a job stops, where an alert on failures does not |

`dependency_call_total{class, method, kind, context, outcome}` (the `timed` aspect) and
`circuit_breaker_state` come next: a dependency that fails or a circuit that opens explains a
use-case breach more often than the use case does.

## `bands.yaml`, three tiers

```yaml
# Versioned with the detection script; a dismissal at triage tunes a band here, in a pull request.
baseline: rolling_30d
rules: western_electric
metrics:
  use_case_failure_ratio:        # per message, 5 minutes, from use_case_total
    tiers:
      1sigma: { action: log }
      2sigma:
        action: diagnose
        tools: "Read,Grep,Bash(npx ddd-ts-kit describe *),Bash(npx ddd-ts-kit list *),Bash(gh run view *)"
      3sigma: { action: propose, routes: [intent, runbook:rollback-deploy] }
  outbox_oldest_pending_age_seconds:   # from the outbox table
    tiers:
      1sigma: { action: log }
      2sigma: { action: diagnose, tools: "Read,Grep,Bash(npx ddd-ts-kit describe *)" }
      3sigma: { action: propose, routes: [runbook:restart-relay, intent] }
  scheduled_job_success_absent:        # per job, two intervals, from scheduled_job_runs_total
    tiers:
      1sigma: { action: log }
      2sigma: { action: diagnose, tools: "Read,Grep,Bash(npx ddd-ts-kit describe *)" }
      3sigma: { action: propose, routes: [intent] }
```

- **log** writes the breach where the team reads it, nothing else.
- **diagnose** runs the agent read-only, with the tools named and no other: the repository at
  the commit deployed, `npx ddd-ts-kit describe <context>` for what the context holds,
  the audit trail of the window through the search route the platform exposes under its own
  permission ([audit trail](../concepts/audit-trail.md), called with a read-only token the run
  receives for that purpose), the traces by correlation id, the last deploy in the window.
  Its output is a diagnosis, not a change.
- **propose** lets the agent act through one of two gates: the review gate, an intent written
  from the template of the story skill (`plugin/skills/story/intent-template.md`, with
  `## Evidence` holding the metric, the window, the audit entries and the deploy in the
  window), opened as a pull request to `docs/architecture/intents/`, which the owner accepts
  or closes as any intent ([story workflow](story-workflow.md#where-a-story-comes-from)); or a
  runbook the team approved before, by its name, rehearsed, with a rollback the agent can
  trigger and cannot invent.

## What a stateless run needs

Each run starts from nothing and leaves nothing but its artefact: the repository, read-only, at
the commit deployed; the metrics store, with a token that reads and never writes; the CLI of
the project (`npm ci`, then `npx ddd-ts-kit describe`, `list`, `check` as needed); the audit
search and the traces, read-only; the permission to open a pull request on the branch of the
intent, and nothing else. No production credential, no write access to a database, no
deployment tool unless a runbook names it. The run is isolated like any agent session: see
[sandboxing coding agents](agent-sandbox.md). The trigger is a schedule, a webhook of the
alerting tool or a cron; two runs on the same breach write the same diagnosis, which is the
point.

## The incident record

Whoever handles the incident (a person, the responder of the channel, the propose tier) writes
`docs/architecture/incidents/<id>.md` from `plugin/skills/story/incident-template.md`: what
was observed (the symptom, the metric, the band, the window), the evidence (the query and its
value, the deploy in the window, the audit entries, the traces, the log lines), the cause by
business name when known (the use case, the aggregate, the invariant, the dependency; `unknown`
otherwise, with what was ruled out), what was done (a rollback, a runbook, a manual correction,
nothing, and when the metric came back), and what is next. It is the lessons file the next
investigation reads first, and the origin of the fix:

```text
npx ddd-ts-kit story-scope FIX-412 --kind fix --from docs/architecture/incidents/INC-2026-10-18-checkout.md
```

`story-scope` accepts an incident record as it is (an intent must be `accepted` first), writes
the origin to `.ddd-ts-kit/story.json`, and `## Origin` of the fix story links the incident. The
fix is `/ddd-ts-kit:fix`: its regression spec is written first, fails on the incident, is locked
and held by the guard, and is the incident's permanent test; the story of the fix lists it under
`## Regression`, and `npx ddd-ts-kit story <code>` reads a fix behind that section instead of
`test/acceptance/`. A second incident of the same class (the same `message` or the same
`error_code` as an earlier record, named under `What is next`) is what the loop is meant to
make rare.

## What arrives from a chat channel

An agent in the incident channel, under its own identity, is the platform's: the kit ships none.
What it says enters the kit's loop the same way as a breach: a bounded correction becomes a
fix story, `/ddd-ts-kit:fix <code>`, with the thread as its origin (the incident record quotes
the thread's summary and link, and the record is the `--from`); a larger change becomes an
intent, written from the template with the thread's summary as its problem and the author of
the request as its author; the post-mortem is the incident record above, written to
`docs/architecture/incidents/`. The agent in the channel verifies that the metric is back in
its band with the same queries as the diagnose tier, and nothing it writes in the channel
replaces the record in the repository.

## What the kit does not do

- No detection script and no scheduler: deterministic, tested, specific to the metrics store
  and the platform; this page gives the queries and the shape, and a team writes them in a day.
- No runbook: a rollback depends on the target platform; the kit stops at the image.
- No channel responder: the identity, the channel and the tools are the platform's.
- No gauge for the age of the oldest pending outbox record in this version: the script reads
  the table.
- No merge decided by a finding: the propose tier opens a pull request or runs a runbook
  approved before; a person accepts the intent and a code owner approves the fix.

## See also

- [Observability](../concepts/observability.md), [Audit trail](../concepts/audit-trail.md)
- [Story workflow](story-workflow.md), [Sandboxing coding agents](agent-sandbox.md)
- [Which command, when](commands.md)

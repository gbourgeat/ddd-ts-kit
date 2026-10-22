# Incident: <title>

Id: INC-<yyyy-mm-dd>-<slug>. Opened: <date>, by <name or the responder>. Status: open | closed.

<!-- Written by whoever handles the incident: a person, the responder of the channel, or the
propose tier of the detection loop. The post-mortem the next investigation reads first, and the
origin of the fix story: `/ddd-ts-kit:fix <code> docs/architecture/incidents/<id>.md`, whose
locked regression spec is the permanent test of this incident. Saved as
docs/architecture/incidents/<id>.md. -->

## What was observed

<the symptom, as a client or an operator saw it; the metric and the band it left, with the
window: `use_case_total{message="BookAppointment", outcome="failure"}` at 18% over 5 minutes
from 2026-10-18T09:40Z, baseline 2%>

## Evidence

- metric: <the query, its value, the window>
- deploy in the window: <the version, the commit, the time; or none>
- audit trail: <the entries of the window read by the search route, actor, action, outcome, correlation id>
- traces: <the correlation ids followed, what they show>
- logs: <the lines that name the error code>

## Cause

<by business name when known: the use case, the aggregate, the invariant or the dependency
(`BookAppointment` refused `SLOT_ALREADY_TAKEN` for every slot after the calendar migration
of 09:35); `unknown` otherwise, with what was ruled out>

## What was done

<rollback to <version>, the runbook <name>, a manual correction, or nothing, and when; the
metric back in its band at <time>>

## What is next

- fix: `/ddd-ts-kit:fix <code> docs/architecture/incidents/<id>.md` (a bounded correction with its regression spec), or an intent `docs/architecture/intents/<slug>.md` (a larger change), or dismissed: <why, and the band tuned>
- same class as: <an earlier incident with the same `message` or `error_code`, or none>

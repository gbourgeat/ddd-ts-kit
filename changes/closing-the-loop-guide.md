**A guide closes the loop from a metric out of its band to the next story, and an incident
record becomes the origin of a fix.** `docs/guides/closing-the-loop.md` applies the last stage
of the AI-native SDLC playbook to a ddd-ts-kit project: the detection stays the team's
(deterministic, tested, outside the kit); the page gives the queries on the metrics the kit emits
for three breaches (the failure ratio of a use case per message from `use_case_total`, the age
of the oldest pending outbox record read from the `outbox` table, the absence of a successful run
of a job for two intervals from `scheduled_job_runs_total`), a `bands.yaml` on them with three
tiers (log; diagnose read-only with named tools; propose through an intent pull request or a
pre-approved runbook), what a stateless run needs, how a request from a chat channel enters the
loop, and what the kit does not do. A new template of the story skill, `incident-template.md`,
is written to `docs/architecture/incidents/<id>.md` (what was observed, the evidence, the cause
by business name, what was done, what is next); `story-scope <code> --kind fix --from` accepts
it as it is, and the locked regression spec of the fix story is the permanent test of the
incident.

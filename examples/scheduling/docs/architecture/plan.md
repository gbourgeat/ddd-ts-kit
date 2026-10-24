**English** · [Français](plan.fr.md)

# Architecture plan

Next: done

The `Next:` line above is read by tools at the start of every session: keep it on one line,
`Next: <step number> <skill> - <first thing to do>`, and `Next: done` at the end.

## Needs

Stated by the product owner on 2026-10-10: see [needs.md](needs.md), word for word. In one line:
an appointment scheduling platform for practices (availability, booking without double holds,
the life of an appointment, a waitlist, delegation to assistants, each practice kept to itself,
notifications and reminders, occupancy figures, support on behalf of users, accountability).

## Steps

| # | Step | Artefact | Status |
|---|---|---|---|
| 1 | Discover the domain | `docs/architecture/discovery.md` | done |
| 2 | Find the bounded contexts | `docs/architecture/contexts.md` | done |
| 3 | Write the glossaries | `docs/architecture/glossary.md`, then each `CONTEXT.md` | done |
| 4 | Draw the context map | `docs/architecture/context-map.md`, then `docs/context-map.md` | done |
| 5 | Choose the stack and bootstrap | `ddd-ts-kit.config.json`, the project | done |
| 6 | Plan the slices | `docs/architecture/slices.md` | done |
| 7 | Build | code, one commit per slice | done, with what `docs/tooling-report.md` lists as not built |

Status is `todo`, `in progress`, `done` or `skipped` (with the reason under Decisions).

The glossary and the draft map of steps 3 and 4 were consumed by the bootstrap, as the method
says; frozen copies are in `before-bootstrap/` so that the path can be replayed.

## Decisions

One line each: `<date> <what was decided>: <why> (<who decided>)`. A decision that constrains
the code later becomes a record in `docs/adr/` once the project exists.

- 2026-10-10 four contexts, `scheduling` (core), `identity`, `notification`, `analytics` (supporting): one language and one owner each, argued in `contexts.md` (product owner).
- 2026-10-10 the audit trail is a capability of the platform, not a context: no language, no decision of its own (product owner, on the conductor's proposal).
- 2026-10-10 the practice is the unit kept to itself; no organization level: not in the needs (product owner; hot spot kept in `discovery.md`).
- 2026-10-10 availability, appointments and the waitlist stay in one context: a free slot must be true at the same instant as what holds the calendar (product owner).
- 2026-10-10 relationships: `scheduling` from `identity` customer-supplier, `notification` from `scheduling` and `identity` published-language, `analytics` from `scheduling` conformist; no cycle (product owner).
- 2026-10-10 `scheduling` reads `identity` twice, once each way: a projection of practitioners (decides and labels lists) and a gateway for the patient's display name on a detail view (rare, fresh, personal data stays owned) (conductor, approved).
- 2026-10-10 delegations do not travel as copied data: `identity` writes the relationship on the practitioner's desk, `scheduling` relates calendars to desks, the authorization model joins them (conductor, approved).
- 2026-10-10 stack, owner's choices: Express; class-validator; tsyringe in the declared style with the barrel; Knex on PostgreSQL; outbox; Redis protocol server (Dragonfly) as cache, lock, rate limiter and event broker (Redis Streams): one server to keep alive instead of two; Keycloak; relationships combined with roles (ADR 0001); audit trail on; Sentry protocol (GlitchTip locally); pino; both pipelines (product owner).
- 2026-10-10 bootstrap command, verbatim: `npx ddd-ts-kit init --http express --validation class-validator --di tsyringe --style declared --assembly barrel --orm knex --database postgres --events outbox --broker redis --cache redis --authn keycloak --authz rebac --audit on --errors sentry --logger pino --docs-ui swagger --ci both --json` (in this repository the CLI is `node ../../packages/cli/dist/bin.js`, run from `examples/scheduling`).
- 2026-10-10 overlap of appointments is decided twice: by the domain for the business answer, by a PostgreSQL exclusion constraint for concurrency; the Redis lock is not used for it (best effort, see the README of `@ddd-ts-kit/redis`) (conductor, approved).
- 2026-10-10 an offer of the waitlist is a requested appointment with a short deadline: the hold, its expiry and the overlap guarantee are the ones of appointments (conductor).
- 2026-10-10 parallel build: the platform worker and three context workers at a time, sharing one tree (no git here), each inside its folder; `scheduling` split between two workers on different aggregates (conductor; outcome in `docs/tooling-report.md`).
- 2026-10-10 scheduled work runs in a worker process (`src/apps/worker/main.ts`), not in the API (product owner).
- 2026-10-10, after delivery: `analytics` keeps one row per fact (the outcome of each appointment) and computes the occupancy at read time, in the database; the stored occupancy, its nightly verification and its job are removed: a counter kept by events has to be defended against order and repaired, a figure computed from the facts cannot drift (product owner; `slices.md`, notes of M1.35 and M1.37).

- 2026-10-24 an erasure reaches every copy of a person, not the sealed words alone: `identity` forgets the person, `notification` its contact, `scheduling` the notes, the cancellation reasons and the documents of their appointments and the name its directory copied; the appointments stay as facts with an opaque id; what was published before is out of reach and the README says so (product owner, on the proposal `privacy-by-design` of the kit).

## Open questions

One line each, with who can answer. A question blocks only the step that needs its answer.

- Does an organization group several practices? Product owner. Blocks nothing built here.
- May a patient reschedule inside the 24 hours? Taken as no. Product owner.
- Does a no-show count against the patient's limit? Product owner.

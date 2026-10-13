# Tooling report

How the kit behaved while this example was built, on 2026-10-10, by one conductor and seven
workers following the plugin's skills. Written for the owner of the kit: nothing here is rounded
in the kit's favour. Raw data: `docs/tooling/generator-log.jsonl` (one line per generator run),
`node scripts/measure-tooling.mjs` (generated against hand-written lines).

## Headline numbers

| | |
|---|---|
| Wall clock, from the statement of needs to a green gate and a recorded real run | about 1 h 25 min (06:33 to 07:58) |
| Generator runs that succeeded | 213 (one `init`, 212 `generate`), 77 s of generator time in all |
| Generator runs refused | 27, almost all by the glossary gate |
| Files in the example | 831 |
| Files a generator wrote and nobody touched | 133 (16 %) |
| Files a generator wrote and a worker then filled or changed | 584 (70 %) |
| Files written by hand | 106 (13 %), plus 8 derived documents |
| Lines kept from generators / lines written by hand | 19 577 / 21 937 (2 917 generated lines were removed or replaced) |
| `TODO(domain)` markers written by generators | 656, all filled |
| `it.todo` entries written by generators | 317, all replaced by tests |
| `TODO(platform)` markers | 9 written, 4 left (listed under "Not built") |
| Tests | 1 288 unit and adapter tests in 226 files, 57 end-to-end tests in 10 files; the 267 adapter tests also pass on PostgreSQL 18 |
| Built | 32 commands and queries, 25 routes, 2 policies, 4 scheduled jobs, 5 projections, 14 integration events, 5 integration event handlers, 2 gateways |
| Sub-agents | 7 (platform, identity, two for scheduling, notification, analytics, end-to-end), about 2.0 million tokens between them |
| Generated files that needed a hand fix for a defect or a gap of the kit | about 40 (listed below) |
| Defects found in the kit's packages | 2 confirmed, with reproductions |

How to read the line counts: "generated lines kept" includes what `init` writes (configuration,
both pipelines, the Keycloak realm: 6 500 lines of project files) and the skeletons of generated
specs; "by hand" includes about 12 000 lines of tests and 3 000 lines of documents (this report, the commit plan, the transcript). In the four layers and the published
language of the contexts the split is 4 600 generated lines kept against 5 300 by hand: the
generators wrote the shape of every file and close to half of the text. Files that a generator
wrote and a worker deleted (the readers of `query --list`, friction 3) are counted nowhere.

## Wall clock per phase

| Phase | Clock | Who | Notes |
|---|---|---|---|
| Reading the architecture reference, the skills, four package READMEs | 06:33 to 06:35 | conductor | about 4 000 lines read before anything was written |
| Needs, discovery, contexts, glossary, context map | 06:35 to 06:38 | conductor | five artefacts |
| `init`, `npm install`, four contexts with their 86 glossary terms | 06:38 to 06:41 | conductor | the bare project needed five hand fixes to be green inside this workspace (frictions 7, 13) |
| Skeleton and contracts: 8 aggregates and repositories, 14 integration events, 2 gateways, 2 policies, 4 commands with their jobs | 06:41 to 06:46 | conductor | 50 generator runs, payloads written by hand |
| Slices, plan, briefings | 06:46 to 06:49 | conductor | |
| Platform: persistent tuples, schema, combined authorizer, read-only impersonation | 06:46 to 06:55 | 1 worker | 157 k tokens |
| Contexts, in parallel | 06:49 to 07:23 | 5 workers | analytics 12 min (215 k tokens), notification 17 min (288 k), identity 19 min (284 k), scheduling calendars 26 min (352 k), scheduling appointments 32 min (455 k) |
| Integration on the trunk: bindings, projections, statuses, decision record | 07:18 to 07:26 | conductor | |
| Cross-context journeys, and the workaround of the read-model defect | 07:26 to 07:39 | 2 workers | 244 k and 20 k tokens |
| Real run: compose stack, Keycloak tokens, demo script, three passes | 07:27 to 07:46 | conductor | |
| Documents, measurements, commit plan | 07:46 to 07:58 | conductor | |

## Generator runs, per kind

| Kind | Runs | Output compiled and passed the analyzers untouched |
|---|---|---|
| `init` | 1 | no: one unused import fails the lint until the first context exists; `knip` flags `resilience/own-policy.ts` until an adapter uses it |
| `context` | 4 | yes |
| `aggregate`, `repository` | 8, 8 | yes; the generated fake of every repository had to be changed later (friction 6) |
| `integration-event` | 14 | yes, until the payload is written: the publisher then stops compiling until it is mapped (expected, but a contract cannot be committed green alone) |
| `gateway` | 2 | yes, until the contract gets its first method: the `{}` placeholder bound in both platform modules stops compiling (friction 5) |
| `policy` | 2 | yes |
| `command` | 26 | yes |
| `query` | 6 | plain queries yes; all four `--list` runs had their reader port, in-memory reader and fake deleted (friction 3) |
| `route` | 24 | yes; path parameters got no DTO in two cases, empty body DTOs were generated in three |
| `job` | 4 | yes |
| `value-object`, `domain-error`, `domain-event`, `domain-service` | 20, 46, 8, 2 | yes |
| `event-handler` | 12 | yes |
| `integration-handler` | 5 | yes |
| `port` | 8 | yes |
| `adapter` | 3 | compiled; two of three were emptied of their generated transport (friction 10) |
| `e2e` | 7 | compiled; all seven were rewritten: the generated baseline assumes a role named `admin` and the tuple `context:<name>#operator` (friction 4) |
| `worker` | 1 | yes |
| `adr` | 2 | yes; `--deviation` writes the `deviations` entry but not the configuration entry it justifies |

## Hand fixes of generated code

| Files | What | Why |
|---|---|---|
| `package.json`, `scripts/tsc.mjs` | the scripts call the compiler through a resolver | the generated scripts name `node_modules/@typescript/native/bin/tsc`; in a workspace the package is hoisted, and it exports no path to its executable |
| `package.json`, `scripts/kit.mjs` | the scripts call the CLI with `node` | defect 2 below |
| `.dependency-cruiser.workspace.mjs`, `package.json` | a wrapper configuration with `preserveSymlinks` | linked packages resolve to `../../packages/*`, so every rule about allowed packages misfires (8 violations on an empty project) |
| `knip.json` | two entries | consequences of the two lines above |
| `docker-compose.yml`, `.env.example` | project name, loopback bindings, unusual ports, local image tags | the generated file binds PostgreSQL, the cache and Keycloak on every interface at their default ports, and names the project after the directory |
| 12 files of `src/platform/auth`, both platform modules, `compose-application.ts`, `test/e2e/support/start-application.ts` | the tuple store is created from the persistence and bound under its port | the generated store is an in-memory module singleton behind a `TODO(platform)`; making it persistent means rewiring every file that imported it (friction 4) |
| `platform.module.ts`, `platform-test.module.ts` | the two read contracts bound to implementations | friction 5 |
| `compose-application.ts` | five projections named in the generated `contextModule(...)` lines | friction 2 |
| `database/schema.ts` | `createAnalyticsTables` added | no repository generator ran in a context that only has read models, so nothing registered its tables |
| `audit/list-audit-entries.route.ts` | `impersonatedBy` added to the view | the generated view of an audit entry omits who impersonates, which the trail records |
| `observability/create-logger.ts` | an optional destination | no way to read log lines in a test |
| 6 repository fakes | `snapshots` replaced by a clone through `rehydrate` | friction 6 |
| 7 end-to-end specs, 3 generated spec files | rewritten, or split to respect `clean-stepdown` and the 100-line ceiling | friction 4; a generated `describe` grows past the ceiling once its `it.todo` entries are filled |
| 2 adapters | generated transport, retry and timeout removed | friction 10 |

## Written by hand where a generator would be plausible

- Five projections, their five `KnexReadModelStore` adapters, tables, fakes and specs (friction 2).
- The list queries around `Criteria`, `scoped` and `criteriaQuerySchema` (friction 3).
- The implementations of the two read contracts on the upstream side (friction 5).
- The table of error statuses (`src/platform/http/error-statuses.ts`): `domain-error` takes a
  `--code` and nothing says which status it answers; everything is 422 until someone notices.
- The relationship schema, the permission mapping and the resource of every `@Requires`.
- Path parameter DTOs of two routes; nested DTOs.

## Frictions, ranked by what they cost

1. **A read model written by the Knex adapter fails on its second write with a real clock**
   (defect 1 below). Every handler spec passed; the first request through the composed
   application answered `422 CONCURRENCY_CONFLICT`. Cost: the only red state of the build that
   needed diagnosis, two agents, a workaround in the shared kernel used by five projections.
   Proposal: read the column as the `Date` the driver gives; add a millisecond case to
   `readModelStoreContract`; give the clocks of generated specs milliseconds.
2. **The CLI does not know projections.** The kernel and three READMEs present `@Projection`
   in `application/projections/` as the way to keep a read model; `check` refuses the directory
   (`tree/closed`), `docs` leaves the classes out of the barrel, so a projection is silently not
   subscribed, and there is no generator. Cost: a deviation with its decision record for a
   documented feature, three configuration entries by hand, five registrations by hand in
   generated lines, and four workers each discovering it. The README of `@ddd-ts-kit/di` admits
   it in one sentence; the architecture reference does not list the directory. Proposal:
   `generate projection <context> <Name> --on <event>...` (class, port, store adapter, table,
   fake, spec), the directory in the canonical tree, the role in the barrel.
3. **`generate query --list` writes another list than the one the READMEs teach.** It gives a
   reader port taking `(scope, page)`, an in-memory reader named `*.repository.ts` and a fake;
   the kernel, http and knex READMEs teach `Criteria`, `ReadModelStore`, `scoped` and
   `criteriaQuerySchema`. All four runs ended with the generated port, reader and fake deleted
   (15 files) and the query, handler and route rewritten. Proposal: `--list --criteria` that
   writes the criteria definition, the read-model port and the route with `criteriaQuerySchema`,
   or make it the default.
4. **The `rebac` bootstrap is a placeholder, and the generators keep writing for it.** The
   store is in memory and a singleton; every `@Requires` names `context:<name>`; the generated
   end-to-end baseline relates `context:<name>#operator` and expects 403 from a stranger, which
   is false as soon as the model is real; integration event handlers need a system grant written
   by hand; `Access.authorize(actor, permission, aggregate)` needs a `resourceOf` that no skill
   mentions and that handler specs on roles cannot detect. Cost: one worker for the platform
   (157 k tokens), 12 files rewired, 7 end-to-end specs rewritten. Proposal: ship a Knex
   `RelationTupleStore` in `@ddd-ts-kit/knex` (the contract suite exists) and have `init` bind it
   through the persistence; `--resource <type>:<field>` on `command` and `query`; a rule that
   lets a system actor operate its own context; `resourceOf` in the access-control skill.
5. **The upstream side of a gateway is nobody's.** `generate gateway` binds the contract to
   `{}` in both platform modules: it stops compiling at the first method of the contract, and a
   declared implementation in the upstream context is then "bound twice". Two workers found two
   different ways out (an undeclared class bound by the platform; `replaces: true`). Proposal:
   generate the implementation in the upstream's `infrastructure/` with a declaration, and bind
   an inert, typed stand-in only in the test module.
6. **The generated repository fake loses value objects.** `snapshots()` goes through
   `structuredClone`, which turns the value objects the aggregate `TODO` asks for into plain
   objects. Six fakes fixed the same way by four workers. Proposal: generate the fake with
   `{ clone: rehydrate }` from the start.
7. **A generated project does not survive a workspace.** Three fixes before the first green
   gate: the compiler path, the CLI binary (defect 2), dependency-cruiser following links.
   Proposal: scripts that resolve their tools (`ddd-ts-kit tsc`), `preserveSymlinks` in the
   generated configuration, an executable bit set by the build of the CLI.
8. **A refusal loses its reason twice.** `ForbiddenError.reason` (the policy's name) is not in
   the HTTP problem, and the denied decision of a policy asked inside a handler is written in
   the unit of work that the refusal rolls back: the trail keeps `command failed FORBIDDEN`
   only. The "403 with the policy's code" asked of this example could not be delivered.
   Proposal: an optional `reason` member in the problem; record decisions outside the unit of
   work, as the command middleware does for failures.
9. **The glossary gate costs a run per word.** 27 refused runs: `List`, `Read`, `Get`, the
   action word of a permission, the word `Practice` in scheduling. The message is clear, but it
   names one missing word at a time, lists the `--term` of the refused run as existing, and
   `LastManager` was refused by `language/no-technical-name` although `Manager` is a glossary
   term of that context. Proposal: report every missing word at once; let the glossary overrule
   the technical-name list; treat `List`, `Get`, `Read` as verbs of queries without a term.
10. **`generate adapter` knows one adapter: a remote client.** A port whose adapter writes
    relation tuples, or logs a mail, gets a transport with retry and timeout to delete, and the
    name `remote-...` stays. The `event-handler` marker says "execute a command" where the
    documented way to keep relationships in step is to call a port. Proposal: `--kind local`.
11. **One consumer per event and context.** `integration-handler` names its handler after the
    event and takes no name: a second reaction of the same context to the same event cannot be
    generated. Reminders are therefore planned by a reaction to "notification sent", and a
    notification that is dead-lettered takes its reminder with it. Proposal: `--name`.
12. **Generators and `docs` rewrite other contexts.** A `generate port` in `identity`
    rewrote the barrel and `CONTEXT.md` of `analytics` and `scheduling`; with workers sharing a
    tree this turned a neighbour's specs red twice for a few seconds. With worktrees it would
    have been a merge conflict in generated files. `--local-only` exists, but the help says
    these kinds write nothing shared.
13. Smaller ones, each a few minutes: `tree/context-doc` read the word "generic" in the
    sentence under `## Classification` as a second classification; a policy generated before
    its command gives the permission the policy's name as description; class-validator payloads
    cannot describe a field (`class-validator-jsonschema` is not allowed in a published
    language, the skill asks for descriptions); the ESLint preset declares no Node globals for
    `.mjs` scripts (`fetch`, `URL`, `Buffer`); `vitest.config.ts` runs adapter specs in parallel
    on a shared `DATABASE_URL`, where they truncate each other (the end-to-end configuration
    guards against it); `generate e2e` names its file after the use case without the context;
    `generate route` says "create it with `generate command`" for a missing query; a log line of
    the bus middleware carries the key `message` twice; the failure lines of the event bus carry
    no correlation id; the bootstrap skill deletes the glossary and the draft map, so the path
    cannot be replayed (kept here in `docs/architecture/before-bootstrap/`).

## Contradictions between a skill, a README and the tool

| Says | Against |
|---|---|
| README of `@ddd-ts-kit/auth`: "domain events are dispatched after the commit", so a tuple written by an event handler is a second step | architecture reference and the kernel: events leave with the save, inside the unit of work. The tool does the second; the example relies on it and proves it |
| README of the kernel: a row `interface` exported next to a read port | `ports/abstract-class` refuses it (its message says to use a `type`) |
| README of `@ddd-ts-kit/di`: `contextModule` takes a projection | the generated barrel never lists one |
| README of `@ddd-ts-kit/knex`, read models | `keyColumn` is required when the key is not `id`; not shown |
| integration-event skill: describe each field of the payload | impossible with class-validator inside the allowed packages |
| bootstrap skill: "the empty project is green" | true only after the first `generate context` |
| parallel-work skill: four workers at most | five context workers and one platform worker ran at once here on a shared tree without trouble; the limit that mattered was the number of hands in one context (two) |

## Rule violations met, and whether the message said what to do

| Rule | Met by | Message |
|---|---|---|
| `clean-stepdown`, function size, the 100-line ceiling of a `describe` | every worker, in specs | clear, with the fix; the generated spec skeleton invites the violation |
| `language/glossary-term` | 27 runs | clear, one word at a time |
| `language/no-technical-name` | `LastManager`; importing the kernel's own `ReadModelStore` in a handler ("Model") | clear, but wrong in both cases |
| `tree/closed` | the projections | clear, with the fix (an extra directory) |
| `declarations/role-declared` | an in-memory reader left next to its Knex twin | clear |
| `ports/abstract-class` | a row interface in a port file | clear |
| `clean-no-escape-hatch` | a type guard written with an assertion | clear, with three alternatives |
| wiring: "bound twice" | the gateway contracts | names the port and the modules |

## What was pleasant

- One `init` command, then a compiling, linted, tested skeleton with both pipelines, a realm,
  a compose file and agent rules: the stack questions were answered before any code.
- The `next` list of every generator: workers opened those lines and little else.
- The contract suites: fakes and adapters held to the same behaviour without writing it.
- PGlite: adapter specs and the exclusion constraint (`btree_gist`) ran in process on the
  first try; the same specs then passed on PostgreSQL 18 with real concurrent transactions.
- `composeApplication` on a real database in a spec, `expectSpanTree`, and one trace from the
  HTTP request to three consumers without a line of tracing in a context.
- The messages of the linter and of the wiring errors say what to do instead.
- The real run passed its first six steps at the first attempt, against real Keycloak tokens.

## Parallel work: what happened

| Worker | Scope | Generator runs | Result |
|---|---|---|---|
| platform | `src/platform/auth`, buses, test support | 1 | done in 9 min |
| identity | the context | 47 | slices 11 to 17, 286 tests, 36 end-to-end tests |
| scheduling-calendar | Calendar, Waitlist, practitioners, day view | 50 | slices 18 to 21, 28, 29 |
| scheduling-appointment | Appointment, Scheduler, lists, export | 34 | slices 21 to 27, 30; recalled once for the read-model defect |
| notification | the context | 22 | slices 31 to 34, 184 tests |
| analytics | the context | 7 | slices 35 to 37, 94 tests |
| end-to-end | `test/e2e/journey-*`, integration fixes | 0 | 17 tests, three integration faults fixed |

There is no git in this build, so the workers shared one tree instead of a worktree each, and
every generator run was serialised behind a lock (`scripts/kit.mjs`). Collisions: none lost
work. Near-collisions: the port `SchedulingRelationships`, created by one half of scheduling
and completed by the other, as briefed; two transient red states of a neighbour's specs
(friction 12, and one broken import for a few seconds). Contracts first paid: no worker waited
for another and no payload changed after the workers started. What did not pay: asking each
context for its own end-to-end specs before the composition existed (four of five workers could
not write them), and briefing the projections without a generator (each worker read the same
three README sections and wrote the same adapter).

Estimated reading per slice, from the workers' reports: the generated files of the slice (5 to
12 files, around their `TODO` lines), one or two README sections for anything beyond a plain
command, and once per worker the rules, the slices and four skills. The slices that cost
reading were the ones without a generator: projections (kernel, knex and di READMEs), criteria
lists (kernel, http, knex), the rebuild (kernel source).

## Defects found in the kit's packages

1. **`@ddd-ts-kit/knex`, read models: the stamp is read back without its milliseconds.**
   `packages/knex/src/read-model/knex-stamped-rows.ts:33` builds
   `new Date(String(record['last_event_at']))`; the driver answers a `Date`, and
   `String(date)` has a precision of one second. `replace()` then filters on
   `last_event_at = <truncated instant>` and matches no row. Reproduction: with a
   `KnexReadModelStore` on PostgreSQL or PGlite, `upsertIfNewer(key, { eventId: 'a', occurredAt:
   new Date('2026-01-01T00:00:00.123Z') }, ...)`, then a second `upsertIfNewer` on the same key
   with a later stamp: five attempts, then `ConcurrencyError`. Any stamp whose milliseconds are
   zero hides it, which is what fixed clocks give. Worked around in
   `src/shared-kernel/storable-stamp.ts` (instant floored to the second, order carried by a
   version), with a regression spec per adapter.
2. **`ddd-ts-kit` (the CLI): `dist/bin.js` is not executable after the build.** In this
   repository, `npm ci && npm run build`, then any script of a workspace that calls the
   `ddd-ts-kit` binary answers `sh: 1: ddd-ts-kit: Permission denied`: the compiler writes the
   file without the executable bit. A published package is not affected (the package manager
   sets the bit at install). Worked around by calling the CLI with `node` (`scripts/kit.mjs`).

Suspected, not confirmed as defects: the generated view of audit entries omits
`impersonatedBy` (template); the bus middleware logs `message` twice in one JSON line.

## Not built, or built smaller than asked

- The policy's reason code in the HTTP answer of a refused cancellation: the answer is `403
  FORBIDDEN` naming the permission (friction 8). The policy's decision is covered by its own
  spec and by the journey spec; it is not in the audit trail.
- A metrics adapter (`TODO(platform)` in `src/platform/observability/create-metrics.ts`), the
  declaration of audited fields (`src/platform/audit/create-audit.ts`), and the two remote
  gateway adapters for the day a context is extracted: the four `TODO(platform)` left.
- The mail port has its development adapter (it writes to the log) and a fake that fails on
  demand; no SMTP catcher.
- Occupancy is held minutes and counts per calendar and day, not a rate against opening hours;
  the nightly verification walks UTC days.
- Leaving a waitlist, listing members and delegations, an organization above practices.
- `@Cached` and `@CircuitBreaker` are not used: the decorators shown are `@Retry` and
  `@Timeout` on the mailer; the binding-level form is the platform's policy around every
  `external` and `gateway` binding.
- No entry point runs `ProjectionRebuild` in production: it is exercised by a spec.
- The fresh-clone sequence `npm ci && npm run build && npm run example:verify` was checked piece
  by piece (`npm ci --dry-run` against the lockfile, the build, the gate), not from a second
  clone.

## Open business questions the workers left

Taken as written in the code, to confirm with the product owner: a requested appointment has
24 hours to be confirmed; an offer from the waitlist ignores the patient's limit; a waiter
leaves the waitlist once offered a slot; a failing offer fails the cancellation that freed the
slot; opening a practice also announces its first manager as a member; time zones without an
area (`UTC`) are refused; a booking made less than 24 hours ahead is reminded at the next run of
the job; a contact never changes after the first registration; held appointments count held,
completed and no-show together.

## After delivery: analytics computed at read time

2026-10-10, after the build above was delivered. Everything above this section is the report of
the build and is left as it was written; where it speaks of five projections, four scheduled
jobs, the occupancy register or the nightly verification, it describes the state before this
change.

**The decision (product owner).** In `analytics`, keep one row per fact and compute at read
time, instead of maintaining figures that events increment or recount.

**What changed.**

- Removed: the projection `analytics.occupancy`, the port `OccupancyRegister` with its Knex
  adapter and its fake, the table `analytics.occupancy`, the command `VerifyOccupancy` with its
  handler, the job `analytics.verify-occupancy`, the permission `analytics:occupancy.verify`,
  the grant of the job's system actor, the line of the job in `src/platform/job-settings.ts`
  (and with it the key `JOB_ANALYTICS_VERIFY_OCCUPANCY_ENABLED`, which no file of the example
  set), their five specs, and the value object `Day` with its error `InvalidDayError`, which
  only the verification used.
- Added: the port `OccupancyReader` (`generate port`), its Knex adapter
  `knex-occupancy-reader.repository.ts` (by hand: one grouped statement over the outcomes), its
  fake (the domain service over the outcomes of a register) and one contract suite both pass,
  `test/integration/occupancy-reader.contract.spec.ts`, 17 cases for each.
- Kept: the projection `analytics.outcomes`, idempotent and safe against order by the stamp of
  its rows, its contract and its rebuild spec; the domain service `OccupancyMeasureService`,
  now the definition the statement is held to; the query `ListOccupancy`, its route and its
  response, unchanged for a client (`openapi/openapi.json` is byte for byte the same).
- Schema: the creation of the tables was changed, with no migration added, since no database of
  this example is deployed: `analytics.occupancy` is no longer created, `outcomes.calendar_id`
  is declared `COLLATE "C"` (the lines are ordered by calendar and by a key made of the calendar
  and the day), and `outcomes` gains the index `(practice_id, day, calendar_id)`. A database
  created before this change has to be created again.
- One behaviour differs: a calendar and day that an appointment left (rescheduled to another
  day) and that holds no other appointment has no line any more, where the stored model kept a
  line of zeros. A day whose appointments were all cancelled still has its line.

**Counts, context `analytics`.**

| | Before | After |
|---|---|---|
| Files | 47 | 36 |
| Lines | 2 039 | 1 732 |
| Source files and lines (outside `test/`) | 26, 789 | 20, 579 |
| Test files and lines | 20, 1 158 | 15, 1 028 |
| `CONTEXT.md` | 92 | 125 (the new section "How occupancy is measured") |
| Read models, tables | 2, 2 | 1, 1 |
| Scheduled jobs, commands, permissions | 1, 1, 2 | 0, 0, 1 |
| Consumers of each appointment event | 2 | 1 |

Outside the context: three lines less in `src/platform/` (`compose-application.ts`,
`auth/relate-system-actors.ts`, `job-settings.ts`), four less in
`test/e2e/journey-observability.e2e.spec.ts` (the trace of a booking lost a consumer). The gate
counts 1 282 unit and adapter tests (1 288 before) and the same 57 end to end. The 210 source
lines the context lost, net, were the part that defended a copy: recounting on every event, choosing between
the fact and a later outcome already stored, a stale write left to the night, the night job.

**The gate and the real runs.** `npm run verify` is green. The contract of `OccupancyReader`
passes on PGlite and on PostgreSQL 18 (it reads `DATABASE_URL`; on an empty table the planner already serves the
grouped statement from the new index). `scripts/demo.mjs` was played again for real on an empty
database; `docs/demo-transcript.md` keeps the first run and adds the two steps that changed.
Two things met on the way, neither caused by this change:

- `npm run test:postgres` runs most contract suites on PGlite even with `DATABASE_URL` set:
  only the specs that pass the variable to `openTestDatabase` reach the server (two of
  `scheduling`, and now the contract of `OccupancyReader`). The headline "adapter tests also on
  PostgreSQL 18" above is true of those. Proposal for the example: `openTestDatabase()` reads
  `DATABASE_URL` itself.
- On PostgreSQL 18, `scheduling/test/integration/concurrent-booking.spec.ts`, "refuses a booking
  that starts in the buffer of one made at the same instant, and takes one that does not touch
  them", fails about one run in two (409 where 201 is expected): when the booking in the buffer
  wins the race, the third one falls in its buffer. A defect of the spec, left as found.

**What this says for the kit.**

1. **There is no supported way to write an aggregate read.** The README of the kernel says it
   in one line ("No aggregation") and stops there, `ReadModelStore.list` answers rows, and
   `generate query --list` (friction 3) writes neither. The pieces are nevertheless almost
   enough: `planCriteria` validates the read and joins the scope, `predicateToKnex` renders the
   filters, `criteriaToKnex` the keyset, the order and the window, `evaluateCriteria` gives the
   fake for free once the lines are computed in memory. What had to be found by reading the
   source of `@ddd-ts-kit/knex`: the filters and the scope must go inside the grouped
   sub-query and the keyset, the order and the window outside, which is done by calling
   `criteriaToKnex(outer, { ...plan, filter: undefined }, columns)`; the total of an offset
   page is a count of groups, written by hand. Proposal: (a) a section "Aggregate reads" in the
   READMEs of the kernel and of each adapter with this recipe; (b) in the adapters,
   `windowToKnex(builder, plan, columns)` (keyset, order, window, no filter) next to
   `predicateToKnex`, so that nobody edits a plan; (c) in `defineCriteria`, a field declared
   `computed: true`: never filterable, never the target of a scope mapping, refused when the
   definition loads instead of when a statement is built (today the adapter refuses it late,
   because the field has no column among the grouped ones); (d) `generate query <context>
   <Name> --list --grouped-by <fields>` writing the port, the adapter skeleton, the fake over
   `evaluateCriteria` and the shared contract spec.
2. **A definition and its SQL can be held equal by the contract suite, and nothing says so.**
   The pattern used here (a domain service that measures, a fake that calls it, an adapter that
   translates it, one suite with hand-computed figures for both) is what makes "computed in the
   database" safe to maintain. `@ddd-ts-kit/testing/contracts` has `criteriaContract` and
   `readModelStoreContract`; proposal: document this third use in the testing README, with the
   cases an aggregate must cover (a group that empties, rounding per row or per group, a row
   marked deleted by a rebuild, the total past the last page).
3. **No generator writes a persistence adapter for a port of the application.** `generate
   adapter` only writes into `infrastructure/external`; the Knex reader was written by hand
   after the one of `notification`. Proposal: `generate adapter <context> <Port> --kind
   persistence`, declared with `@Repository(Port, [KnexContext])`, with its contract spec over
   the fake and the adapter.
4. **Nothing removes what a generator wrote, and nothing notices what is left.** Removing a
   command and its job meant deleting files and editing four generated regions by hand
   (`ddd-ts-kit:permissions`, `ddd-ts-kit:system-grants`, `ddd-ts-kit:jobs`, the projections
   named in `compose-application.ts`); `docs` then repaired the barrel and the `CONTEXT.md`.
   Checked on purpose: with the grant of the removed job's system actor and its line of job
   settings put back, `ddd-ts-kit check`, the compiler and an end-to-end spec all stay green.
   Proposal: `check` compares the names in those regions with the declared jobs and
   permissions (a rule `config/no-orphan-registration`), and a `ddd-ts-kit remove <kind>
   <context> <Name>` that undoes what `generate` listed in `created` and `updated`.
5. **Collation is easy to get wrong in a computed key.** The lines are ordered by a key built
   from two text columns; both must be `COLLATE "C"` or PostgreSQL cannot decide the collation
   of the key. The README of `@ddd-ts-kit/knex` covers sorted columns, not expressions.
   Proposal: one sentence there.

The two generator runs of this change (`generate port analytics OccupancyReader`, `docs`) are
in the log kept by `scripts/kit.mjs`; `docs/tooling/generator-log.jsonl` is the copy made at
the end of the build and was not refreshed.

## After delivery: domain events dispatched at the end of the unit of work

2026-10-10. The kit changed when a domain event reaches its handlers: no longer after each
save, but once the command handler has returned, inside the transaction and before its commit,
with an `after-commit` phase for what no transaction covers. The guarantee: an effect of a
domain event exists only if the state change that recorded it is committed. What it took here,
and what the tools said.

What changed in the example:

1. **No handler was rewritten.** The twenty-six domain event handlers are declared, in the
   default phase, and their dependencies are the command bus, the outbox publisher, a
   repository, or a port of relationships. Unit and integration specs passed untouched (1282
   tests): they call the handlers directly or through the test application, and none relied
   on a handler running between two saves.
2. **Two adapters moved, and that is the decision.** `RemoteIdentityRelationships` and
   `RemoteSchedulingRelationships` were what `generate adapter` writes: under
   `infrastructure/external/`, kind `external`, behind seven handlers that run before the
   commit. The new rule `domain-events/transactional-before-commit` refuses that shape, and it
   is right to: a remote write before the commit survives a rollback. Read closely, the store
   is not remote: `RelationTupleStore` is bound to `KnexRelationTupleStore`, a table of the same
   database written in the transaction of the command (ADR-0001). The honest fix was to say so:
   the adapters are now `TupleIdentityRelationships` and `TupleSchedulingRelationships`, in
   `infrastructure/persistence/`, declared with `@Repository`, without the empty resilience
   policy they carried. The handlers stay before the commit, so a relationship commits or rolls
   back with its fact, which neither the `after-commit` phase (at most once: a right never
   withdrawn after a crash) nor an integration event consumed by the same context (a right that
   lags behind its fact) would give. The reasoning, and what to do the day the tuples move to
   a remote service, is in the `CONTEXT.md` of `identity`. A new integration spec,
   `relationships-commit-with-the-fact.spec.ts`, proves it on PostgreSQL.
3. **Seven span trees changed, as designed.** The handlers left the span of the save: under the
   command come the saves, then `unit-of-work before-commit` with the events and their
   handlers. `identity-remove-member` shows two such spans, the second for the delegation the
   first handler ended. The spans of the relationships are named `repository
   ...Relationships.*` instead of `external ...`.
4. **One order changed in `journey-observability`.** The consumer of `notification` opens the
   unit of work (the mark of the event and the state change commit together) and sends
   `SendNotificationCommand`, which joins it. The fact `notification.notification.sent` is
   therefore dispatched at the end of the consumer's unit of work, after the command returned:
   `unit-of-work before-commit` is a sibling of the command span under `process ...`, and the
   log line of `PlanReminderCommand` now follows the one of `SendNotificationCommand`. Both
   still commit or roll back together.

What the tools did well: the rule and the checker agree with the code once the adapter says
what it is, `docs` repaired both barrels and both `CONTEXT.md` after the move, and
`expectSpanTree` printed the expected and the found tree side by side, which made each of the
eight expectations a reading exercise.

Frictions:

1. **`generate adapter` names every adapter `Remote...` and files it under
   `infrastructure/external/`**, so an adapter that writes in the transaction starts its life
   declared as an outside system. It is friction 3 of the previous section seen from the other
   side: with `generate adapter <context> <Port> --kind persistence` the two adapters would
   have been declared right from the start, and the new rule would have had nothing to say.
2. **Nothing moves a generated file.** The two moves were `mv`, two class renames, two spec
   renames and a `docs` run; `ddd-ts-kit check` then confirmed the tree.
3. **`SendNotificationHandler` calls `Mailer.deliver` inside the transaction of its command.**
   The new rule judges domain event handlers only, so it says nothing, and the handler guards
   against a second mail with `findByCause`. A mail can still leave for a notification whose
   commit failed. It is the same question one level up (an effect outside the database before
   the commit) and no rule holds it for command handlers. Left as it is, on purpose: out of
   the scope of this change.
4. **`docs/demo-transcript.md` is a recording** made before this change: its span names
   (`external SchedulingRelationships.recordAppointment`, no `unit-of-work before-commit`) are
   those of that run, and were left as recorded.

The generator run of this change (`docs`) is in the log kept by `scripts/kit.mjs`;
`docs/tooling/generator-log.jsonl` was not refreshed.

## 2026-10-10: every import by its alias (Node subpath imports)

The example imported relatively everywhere (`../../../domain/...`) although its config named an
alias, `@/`, that only `tsconfig.json` and the vitest configs knew: an alias import would have
type-checked and then failed under `node dist/src/main.js`. The alias is now `#src/`, a Node
subpath import declared once under `imports` in `package.json`, with `#test/` and `#scripts/`
next to it, and the rule `imports/alias-only` refuses a relative import.

What was done, in order:

1. By hand, the declarations `init` writes for a new project: `importAlias` `#src/` in the
   config, the `imports` of `package.json`, `--conditions=ddd-ts-kit-source` in the `dev`
   script, `paths` removed from `tsconfig.json`, `ssr.resolve.conditions` in place of
   `resolve.alias` in the two vitest configs. `ddd-ts-kit check` named each one that was
   missing (`imports/alias-declared`), with the text to write.
2. `node scripts/kit.mjs depcruise-config --write`: the generated graph configuration resolves
   under the source condition.
3. `npx eslint . --fix`: 2097 imports rewritten in 557 files (2019 under `src/`, 73 under
   `test/`, 5 under `scripts/`), the four barrels included. The checker counted the same 2097
   before the fix and none after. Then `npm run format`: 25 files re-wrapped, since an alias
   path is longer. A second `eslint . --fix` changed no file.
4. `migrations/0001_initial.js` names the compiled schema by `#src/platform/database/schema.js`
   instead of `../dist/src/...`: under the plain `node` of the knex CLI the alias answers
   `dist/`.

Checked after it: `npm run typecheck`, `npm run build`, 1285 unit and adapter specs, 57
end-to-end specs, dependency-cruiser (759 modules, no violation), knip, `docs:check`. Plain
`node` links the 463 compiled modules on Node 22.23 and Node 24.21 with no alias left
unresolved; `node dist/src/main.js`, the worker and `tsx` on `src/main.ts` each run up to the
connection to PostgreSQL, which no server answered on this machine: the full start with the
compose services was not replayed.

What the tools did well: the fix needed no decision, file by file, and the formatter absorbed
every long line; no file passed 350 lines and no function 30, since imports count in neither.
`docs` had nothing to rewrite after the fix: the barrels ESLint fixed were already what the
generator writes.

Frictions:

1. **Three tools load the compiled copy in silence when the condition is missing**: tsx, vitest
   and jest resolve an alias to `dist/` as `node` does, so a stale build would be tested instead
   of the sources. That is what `imports/alias-declared` checks in the scripts and in the runner
   configs, and why the condition is in each of them.
2. **Renaming the alias is not a command.** The config, the `imports` entry and the prefix in
   the sources are three edits; the checker names the first two.
3. **`docs/demo-transcript.md` and `docs/tooling/` are recordings** made before this change and
   were left as recorded.

## 2026-10-10: coverage as a governed setting, and every rule proven on this application

### What changed here

- `vitest.config.ts` writes no threshold any more: it spreads `governedCoverage(mode)` of
  `@ddd-ts-kit/testing/coverage`, which reads the `coverage` key of `ddd-ts-kit.config.json`.
  This application sets no rate, so the reference applies: domain 90/85/90/90, application
  85/80/85/85, presentation 80/70/80/80, infrastructure 70/60/70/70 (statements, branches,
  functions, lines), to each context on its own.
- `npm run verify` now runs `npm run test:coverage` (every spec once, the four layers measured)
  where it ran `npm run test`: the thresholds are enforced by the gate a developer runs, not
  only by the pipeline.
- `plugins: [decoratorCoverage()]` in `vitest.config.ts`: this application compiles with
  `emitDecoratorMetadata`, and the transform guards every type a decorated class names with
  `typeof Port === "undefined" ? Object : Port`, a branch no test takes.

### What the measure found

Before this change the pipeline script `ci:test:unit` of this application failed: the branch
rate of `application/` was 74.1 % for a floor of 80 %, and `verify` did not say so because it
measured nothing. Two causes:

1. **The compiler, not the code.** Most of the uncovered branches of `application/` were the
   metadata guards above, one per port of every declared handler. With `decoratorCoverage()`
   the branch rate of the four `application/` layers is between 98.68 % and 100 %.
2. **Three real gaps**, each closed by a spec, none by a lower threshold:
   - `analyticsRoutes`, `identityRoutes` and `notificationRoutes` were called by the end-to-end
     specs only, which are not measured: each context has a `<context>.routes.spec.ts` that
     holds its list of routes (no two routes answer the same method and path, nor share an
     operation id). `generate context` now writes that spec.
   - `grant-delegation.route.ts`: no spec sent a delegation without an end. Added: "hands the
     use case a delegation without an end when the client gives none".

### Rates on 2026-10-10 (statements, branches, functions, lines, in %)

| Context | Layer | Statements | Branches | Functions | Lines |
|---|---|---|---|---|---|
| analytics | domain | 100.00 | 100.00 | 100.00 | 100.00 |
| analytics | application | 100.00 | 100.00 | 100.00 | 100.00 |
| analytics | presentation | 100.00 | 100.00 | 100.00 | 100.00 |
| analytics | infrastructure | 98.33 | 85.71 | 100.00 | 98.28 |
| identity | domain | 100.00 | 100.00 | 100.00 | 100.00 |
| identity | application | 100.00 | 100.00 | 100.00 | 100.00 |
| identity | presentation | 100.00 | 100.00 | 100.00 | 100.00 |
| identity | infrastructure | 100.00 | 89.58 | 100.00 | 100.00 |
| notification | domain | 100.00 | 100.00 | 100.00 | 100.00 |
| notification | application | 100.00 | 100.00 | 100.00 | 100.00 |
| notification | presentation | 100.00 | 100.00 | 100.00 | 100.00 |
| notification | infrastructure | 98.32 | 83.33 | 100.00 | 98.31 |
| scheduling | domain | 99.37 | 96.95 | 99.08 | 99.34 |
| scheduling | application | 99.76 | 98.68 | 100.00 | 99.76 |
| scheduling | presentation | 100.00 | 94.44 | 100.00 | 100.00 |
| scheduling | infrastructure | 100.00 | 92.06 | 100.00 | 100.00 |

These rates say that the code ran under a spec. What the specs assert is another matter, held
by their names and by the end-to-end journeys.

### Every rule of the kit, broken once in a copy of this application

`npm run example:conformance`, at the root of the kit, copies this application to a temporary
directory, installs the kit in the copy as a registry would, and for each of the 67 rule ids
of the catalogue writes one minimal violation and reads what the tool that owns the rule
says: `ddd-ts-kit check`, ESLint with the preset, Biome. A rule held by both the checker and
ESLint has to be reported by both, on the file that breaks it, with nothing else beside it
than the companions the case declares. The untouched copy has nothing to report to the
checker, ESLint, Biome, dependency-cruiser, knip and the type checker. No rule is declared not
applicable to this application. The suite fails when a rule of the catalogue has no case, so a
rule added to the kit is applied here or the pipeline says so. It runs in about 40 seconds,
after the gate of this application, in `npm run example:verify`.

### Deviations of this application, reviewed

Three entries, one decision: `application/projections` is an extra directory of `scheduling`,
`notification` and `analytics` (ADR 0002). Still needed: the kernel has a `@Projection` role
and the canonical tree of the checker does not know its directory. The removal condition of
the record is unchanged. No rule is lowered, no package is added to an allow-list, no source
carries a suppression or a coverage ignore comment.

### Limits

- The generator lock of `scripts/kit.mjs` moved from the temporary directory of the system to
  the state directory of the script: nothing is left behind there.
- The end-to-end specs are not measured: a route reached only end to end counts as uncovered.

## 2026-10-10: the alias becomes `@/`, declared under tsconfig `paths` and rewritten at build

The section "every import by its alias (Node subpath imports)" above is kept as it was written:
it describes the mechanism of that day, a `#`-prefixed subpath import declared in
`package.json` and resolved by Node under a resolution condition. The owner of the kit rejected
that spelling for `@/`, without a `src` segment. Node cannot resolve `@/` by itself, so the
mechanism changed: the alias is declared under `paths` in `tsconfig.json`, and the build ends
with `ddd-ts-kit build-aliases`, which rewrites each alias of `dist/` into a relative path.

What was done here, in order:

1. The prefix of every alias import, replaced in place: 2101 specifiers in 561 files (2023
   under `src/`, 73 under `test/`, 5 under `scripts/`); 2055 name the source root by `@/` and
   46 name the tests by `$test/`. `npx eslint . --fix` then changed no file: the autofix of
   `imports/alias-only` rewrites a relative import, and none was left. `npm run format`
   re-wrapped 7 files, since the prefix is three characters shorter.
2. By hand, the declarations `init` writes for a new project: `importAlias` `@/` in the config,
   `paths` in `tsconfig.json`, the `imports` field removed from `package.json`, the resolution
   condition removed from the `dev` script and from the two vitest configs, which now set
   `resolve: { tsconfigPaths: true }`, and `build` chaining
   `node scripts/kit.mjs build-aliases` after the compiler.
3. `node scripts/kit.mjs depcruise-config --write`: the generated graph configuration no longer
   names a condition and reads `tsconfig.json`.
4. `migrations/0001_initial.js` names the compiled schema by `../dist/src/...` again: the knex
   CLI runs it under plain `node`, and nothing rewrites a JavaScript file at the project root.
5. `npm run docs:generate` had nothing to rewrite: the barrels were already what the generator
   writes under the new alias.

`$test/` and `$scripts/`, not `@test/` and `@scripts/`: a name such as `@test/x` is also the
name a package may bear, and dependency-cruiser was measured to resolve an installed package of
that name before the file of the project. `$` cannot appear in a package name
([docs/tools/import-aliases.md](../../../docs/tools/import-aliases.md)).

Checked after it: `npm run verify` (types, lint, format, 1290 unit and adapter specs with the
coverage thresholds, 57 end-to-end specs, the checker with 0 finding in 724 files,
dependency-cruiser on 763 modules, knip, `docs:check`), then the 67 rule ids of the conformance
suite. The build rewrites 800 specifiers in 247 of the 467 emitted files; plain `node` links
every compiled module and starts `dist/src/main.js` and the worker up to their configuration
on Node 24.21 (`alias-example.spec.ts`, which CI also runs on Node 22). The full start with the
compose services was not replayed.

Frictions:

1. **A build is now two steps.** `tsc` alone leaves the aliases in `dist/`, which then stops
   under `node` at its first import. `imports/alias-declared` reports a script that compiles
   without the rewrite, and the rewrite refuses an output it cannot finish.
2. **An alias completed at run time cannot be rewritten.** `scripts/events.ts` of this example
   already built its path from `import.meta.url`; the template of the kit did not, and the
   rewrite refused it on the first generated project.
3. **`scripts/demo.mjs` keeps three relative imports**: it is a JavaScript file Node runs as
   written, outside the TypeScript sources the rule reads.
4. **`docs/demo-transcript.md` and `docs/tooling/` are recordings** made before this change and
   were left as recorded.

## 2026-10-12: imports without the `.js` extension

The owner of the kit prefers an import that names its file and nothing else:
`@/contexts/identity/domain/repositories/person.repository`, not `.../person.repository.js`.
The kit now has a setting for it, `importExtension` (`none` or `js`), `none` for a new project,
and a config without the key is read as `js`. This application was moved with the tools a team
would use, in the order the checker gives:

1. `"importExtension": "none"` added to `ddd-ts-kit.config.json`, by hand. `ddd-ts-kit check`
   then reported 2106 findings and each one said what to do: 2101 `imports/extension` (one per
   import, in 561 files), 4 `declarations/barrel-current` (the barrels no longer matched what
   the generator writes) and 1 `imports/alias-declared` on `tsconfig.json`.
2. `tsconfig.json`, by hand, as that last finding dictates: `"module": "ESNext"`,
   `"moduleResolution": "Bundler"`, `"customConditions": ["node"]`.
3. `npx eslint . --fix`, 45 seconds: the autofix of `imports/extension` rewrote the 2101
   imports (2023 under `src/`, 73 under `test/`, 5 under `scripts/`), the four barrels included,
   since a barrel is a file of `export * from` lines.
4. `npm run format` at the root of the repository: 4 files changed in the whole tree, where a statement fits on
   one line again now that its specifier is three characters shorter.
5. `npm run build` at the root, then `npm run docs:generate` here: `ddd-ts-kit docs` answered
   "Nothing to do" (the fix had already written the barrels as the generator does), and the
   OpenAPI and AsyncAPI documents came out identical.
6. `CLAUDE.md` and the "Imports" section of the README, by hand, as `init` now writes them.

Nothing else changed: no file under `migrations/` (JavaScript that Node runs as written keeps
its `.js`), no script, no test configuration (`vitest` reads `paths`, which complete the
extension), not `scripts/events.ts`, whose one `index.js` is a path of the compiled output
built from `import.meta.url`.

Checked after it: `npm run verify` (types under the bundler resolution, lint, format, 1290 unit
and adapter specs with the coverage thresholds, 57 end-to-end specs, the checker with 0 finding
in 724 files, dependency-cruiser on 763 modules and 3429 dependencies, knip, `docs:check`),
then every rule id of the kit broken once in a copy of this application (75 specs, the new
`imports/extension` among them, written in the spelling the config of the example does not
ask for). The build still rewrites 800 specifiers in 247 of the 467 emitted files, and now
completes each with `.js`; plain `node` links every compiled module and starts
`dist/src/main.js` and the worker up to their configuration on Node 24.21
(`alias-example.spec.ts`, which CI also runs on Node 22). Zero import of a file of the project
ends with `.js`, `.ts` or `.mjs` under `src/`, `test/` and `scripts/`, of 2101.

Frictions:

1. **The compiler no longer refuses the old spelling.** Under the bundler resolution
   `.../person.repository.js` still type-checks. Only `imports/extension` (checker, ESLint) and
   then the build refuse it, so a project that turns the rule off loses the single spelling.
2. **The compiler no longer models Node for packages.** A default import of a CommonJS package
   that Node hands over as `{ default }` type-checks under `Bundler` and fails at run time; this
   application has none, and its specs and the linking of every compiled module would show it.
   The `node` condition is given back to the compiler (`customConditions`), so the entry it
   reads in a package is the one Node loads.
3. **An import can name a directory for the compiler, not for the build.** `.../published-language`
   would resolve to its `index.ts`; the build refuses it and the checker reports it. This
   application always wrote `.../published-language/index`, so nothing had to change.
4. **The postgres run and the full start with the compose services were not replayed** for this
   change: `test:postgres` and `infra:up` need the services, and nothing they exercise reads
   an import specifier.

## 2026-10-12: dependencies stated by the constructor, and projections as a role

The owner's decision: a handler is written without repeating its dependencies in its
decorator. Before, each of the 89 classes of this application that take something said it
twice, `@CommandHandler(RegisterPersonCommand, [PersonRepository, Clock])` and then the
constructor. Now the constructor says it once, and the kit reads it.

Measured first, on the compilers and runners this application meets, with a decorated class
whose constructor takes two ports: `design:paramtypes`, the metadata `emitDecoratorMetadata`
writes, is there under `tsc` 6 and 7, under Vitest 5 and under swc only with legacy
decorators; it is absent under `tsx` (the `dev` script) in both decorator modes and with
standard decorators everywhere; and it is `Object` for a port imported with `import type`.
This application is on legacy decorators (class-validator), so metadata would have worked in
its build and its tests and failed under `npm run dev`. The kit reads the signatures from the
sources instead and writes them in the generated barrel of each context.

What was done here, in this order, each step by a tool of the kit:

1. `"dependencies": "signature"` under `stack` in `ddd-ts-kit.config.json`.
2. `npx eslint . --fix`: the new rule `declarations/constructor-injection` reported 89 lists,
   all 89 equal to their constructor, none that differed, and removed them. 89 files changed,
   one line each; nothing else in them: the fixer left the imports as they were, so the ports
   stay imported as values here, which the generated code of a new project writes as
   `import type`. Both spellings run: the barrel is what imports the value.
3. `node scripts/kit.mjs docs`: the four barrels now hold 122 `export *` (118 before, plus the
   four projections) and 89 `injected(Class, [Tokens])` statements with their imports, laid
   out as Biome lays them out, so `format:check` has nothing to say of a generated file.
4. The `dev` script, by hand, as `init` now writes it:
   `--import ddd-ts-kit/dist/refresh-declarations.js`.
5. The three `extraDirectories` entries and their three deviations, removed: the checker knows
   `application/projections/`. ADR 0002 is marked superseded and kept.
6. `src/platform/compose-application.ts` no longer names the four projections: the barrels
   bring them.

What it changed in the tests:

- Nine handler specs of `scheduling` now give a fake to `Agenda`. The barrel brings the
  agenda projection, which applies the domain events a handler announces with its save: with
  the projection left out, as before, those specs ran a context that was not the one the
  application runs.
- Two specs that built a projection alone take it from the generated file of its context
  (`contextModule('analytics', { OutcomesProjection: analyticsDeclarations.OutcomesProjection })`):
  a class imported from its own file has no dependency list. Two others that added a
  projection by name to the declarations no longer do.
- New `test/architecture/every-class-resolves.spec.ts`: the composition root as `main.ts`
  builds it, on PostgreSQL in process, then every declared class of the four contexts built
  one by one. A list that is missing, of another length or naming something nobody binds
  fails there, by name.

Checked after it: `npm run verify` (types, lint, format, 1298 unit and adapter specs with the
coverage thresholds, 57 end-to-end specs, the checker with 0 finding in 724 files,
dependency-cruiser on 763 modules and 3481 dependencies, knip, `docs:check`), then every rule
id of the kit broken once in a copy of this application (76 specs, the new
`declarations/constructor-injection` among them: a constructor parameter typed `number`).

Frictions:

1. **A constructor edited by hand leaves the barrel stale until something regenerates it.**
   `check` and `docs --check` say so and name the class, `dev` regenerates on every reload,
   and the application refuses to start with a list of another length; but a list of the same
   length and other tokens (two ports swapped for two others) is only caught by the gate and
   by the type check of the barrel, not at startup.
2. **Every injection of the conformance suite that changes a constructor now also reports
   `declarations/barrel-current`.** Eight injections declare it as a companion. It is the
   honest reading: the generated file is part of what a constructor change touches.
3. **Bringing projections into the barrel changed what a handler spec assembles.** It is the
   right context, and it cost a fake in nine specs. A team that migrates meets the same.
4. **A reload that rewrote the barrel can be followed by a second one**, for the barrel
   itself, which the watcher also watches. It finds nothing to rewrite. Not measured here:
   the `dev` proof is on a generated project (`dev-reload.spec.ts` of the CLI), not on this
   application, whose start needs its services.
5. **The full start with the compose services and the postgres run were not replayed** for
   this change: `infra:up` and `test:postgres` need the services.

## 2026-10-12: errors built by a factory of their concept

The owner's decision: the code that refuses reads as a sentence, and the errors of one concept
live together. `throw new SlotTakenError(calendar.id, slot.startsAt)` became
`throw AppointmentError.slotTaken(calendar.id, slot.startsAt)`.

| | Before | After |
|---|---|---|
| error classes (`domain/errors/*.error.ts`) | 44 files, 400 lines | 8 files, 293 lines |
| their specs (`test/unit/*.error.spec.ts`) | 44 files, 541 lines | 8 files, 458 lines |
| refusals | 44 classes, one code each | 44 factories on 8 classes, the same 44 codes |
| places that build one | 164 `new ...Error(..)` | 164 factory calls |
| facts a test can read as data | the parameters kept as properties, on 16 classes | every parameter, on every refusal |
| facts a client can read as data | none (the message only) | 11 refusals expose one, by name |

The concepts come from the glossaries, one per aggregate: `PracticeError` (8 refusals),
`DelegationError` (4), `PersonError` (3) in identity; `AppointmentError` (13), `CalendarError`
(10), `WaitlistError` (3) in scheduling; `NotificationError` (2), `ReminderError` (1) in
notification. A refusal goes to the concept the caller asked for: the calendar and the
scheduler detect that a slot is held, and refuse with `AppointmentError.slotTaken`. The
refusals of a value object go to the concept it describes: `PersonError.invalidEmail`,
`CalendarError.invalidRange`. No value object has an error class of its own, and none could
be named `RangeError`.

How it was done, in this order:

1. `ddd-ts-kit error-factories --plan` proposed a concept for 15 of the 44 classes, the ones
   named after an aggregate (`AppointmentNotFoundError`, `UnknownCalendarError`). The 29 others
   were given theirs by hand in the plan file: this is the decision of the model.
2. `ddd-ts-kit error-factories --apply` wrote 101 files and removed 88: the 8 error classes,
   each factory with the parameters and the message of the constructor it replaces and its
   plain parameters as facts; the 8 specs, the cases of each old spec under the name of its
   factory; and every usage, among them the assertions on a class, turned into assertions on a
   code (`toThrow(OutsideAvailabilityError)` is
   `toThrow(expect.objectContaining({ code: 'OUTSIDE_AVAILABILITY' }))`). It set
   `"stack.refusals": "factories"`. Then `npm run format`.
3. By hand: the facts a client may read (`startsAt` of a slot, `notice`, `horizon`, `grid`,
   `limit`, the `status` of an ended appointment, `held`, the `day` and the `endsAt` that were
   sent), never an identifier of a person; the 8 specs rewritten as one table per class that
   asserts the code, the message, the facts and the exposed facts of each factory; one spec
   that read `error.given`, now `expectRefusal(result, 'INVALID_NOTIFICATION_KIND', { given })`.

What the tools said:

- The first run of the codemod sent `UnknownTimeZoneError` of scheduling to `PracticeError`,
  the concept of the class of the same name in identity: a move was applied by class name
  across the project. The type check caught it in one file. The codemod now applies a move to
  the files of its own context, and elsewhere to the files that import the class from there;
  a test holds it.
- An assertion written over three lines, `toThrow(\n  OutsideAvailabilityError,\n)`, was first
  left to the last pass, which turned it into `toThrow(AppointmentError)`: a weaker assertion,
  green. The patterns now accept a trailing comma, and a class left as a value is reported.
- The HTTP contract did not move: `openapi/openapi.json`, regenerated, differs from the
  previous one by five added lines, the optional `facts` member of the `Problem` schema. Every
  path, status and `x-error-codes` list is the same, and the end-to-end specs were not edited.
- `CONTEXT.md` of the three contexts gained an `Errors` table: class, refusal, code, exposed
  facts.

Left as it is, on purpose:

- Ten factories still take a sentence: `CalendarError.invalidRange(rule)`,
  `AppointmentError.invalidSlot(reason)`. The message is written by the caller, as it was
  before. Each is a candidate for one factory per rule, which would change nothing for a
  client (same code) and is a change of the model, not of the form.
- `UNKNOWN_TIME_ZONE` is set in identity and in scheduling. A code is unique in its context;
  both are answered 422 by the one error mapper.
- `LAST_MANAGER` kept its code and its factory is `PracticeError.lastManager()`: the class was
  `PracticeLeftUnmanagedError`, whose name said something else than its code.

Same day, the ports and kernel types this application only uses as types are imported with
`import type` (114 import statements in 78 files), as the templates write them. The generated
declarations did not change: the signature reader follows a type import to the class it names,
and the generated file imports the value.

## 2026-10-12: routes as controller classes, behind route groups and guards

The 24 routes of the four contexts and the audit route of the platform became controller
classes, with `ddd-ts-kit controllers` then by hand for what the command leaves to a person.

| | Before | After |
|---|---|---|
| Form of a route | `defineRoute` function, listed in `<context>.routes.ts` | class carrying `@Controller`, one method, no list |
| Files under `presentation/http/` and the audit route | 90, flat (61 in `scheduling`) | 98: one folder per route, 9 group files, 1 mapper, 2 serializers |
| Lines of those files | 1967 | 1910 |
| Hand-maintained lists of routes | 4, and their 4 specs | 0 |
| Route groups | none | 9: `people`, `practices`, `practice-opening` (identity), `appointments`, `calendars`, `practices` (scheduling), `notifications`, `practices` (analytics), `audit` (platform) |
| Lines of the route or controller specs | 1937 | 2088 |
| `openapi/openapi.json` | | byte for byte the same |
| End-to-end specs | 57 pass | 57 pass, unedited, span trees included |

What the command did: the 24 controllers, the 8 groups of the contexts (each behind
`Authenticated`, with `FORBIDDEN` said once), the 61 schema files moved under their route or
under `shared/`, every import rewritten, the 24 specs moved, the 4 lists, their specs and
their lines in the composition root removed. What was done by hand: the line that mounts the
declared controllers and the audit controller in `compose-application.ts`, two integration
specs that named the list of routes, one spec whose call spanned several lines, the audit
controller (outside the contexts), and the config key, which the command leaves while a
function route remains.

Two groups ask for a role at the edge, `HasRole('platform-admin')`: `PracticeOpeningRoutes`,
which refines `PracticesRoutes` of identity, and `AuditRoutes`. The permissions
`identity:practice.open` and `audit:trail.read` are unchanged on their use cases. A caller
without the role is now refused before the bus: the status and the code are the same, and the
audit trail no longer records a denied decision for it, since no decision was asked.
`BookAppointmentController` has a request mapper, `GetCalendarDayController` a serializer, and
the two searches of the agenda share `AgendaEntrySerializer`, which removed a duplicated
function. Six controllers still keep a small helper below their class (`grant-delegation`,
`search-occupancy`, `reschedule-appointment`, `search-notifications`, `join-waitlist`,
`get-appointment`): each is a mapper or a serializer to extract.

No route of the application is public, so `Public` is not shown here: the kit holds it in its
own specs. `PersonError.invalidEmail` quotes the address it refuses in its message: the client
now reads `Invalid email.` as `detail`, and the spec of the controller holds that the address
does not leave.

## 2026-10-13: one aggregate kept as its events

The kit gained event sourcing, chosen per aggregate. The example shows it on one aggregate
whose history is the business, the attendance record of a patient in a practice: the no-shows
and the cancellations of the patient, each noted once, in order. Every other aggregate keeps
its state in tables, in the same context and the same transaction.

| | |
|---|---|
| Event-sourced aggregate | `AttendanceRecord` (scheduling), three events: `created`, `no-show-noted`, `cancellation-noted` |
| How it is fed | the before-commit handlers of `scheduling.appointment.marked-no-show` (new) and of `scheduling.appointment.cancelled` (a cancellation by the patient) send `NoteNoShow` and `NoteCancellation`, as the system actor `scheduling.note-attendance`: the stream is appended in the unit of work of the appointment |
| Store | PostgreSQL through knex, in the `scheduling` schema (`createEventStoreTables` in `createSchedulingTables`), bound by the platform; in memory for the handler specs |
| Snapshots | every 20 events, proven equal to a full replay (`expectSnapshotEquivalence`) |
| Personal data | the words of a patient who cancels are sealed with the key of the patient; an erased patient reads `[erased]` after a rebuild |
| Projection | `scheduling.attendance-history`, fed by the store (`{ feed: 'event-store' }`): a catch-up subscription in the API process, at the pace of the outbox relay; its rebuild from position zero is proven on PostgreSQL |
| HTTP contract | additive only: `GET /practices/{practiceId}/patients/{patientId}/attendance` (`searchAttendanceHistory`), and the permissions `scheduling:attendance.note`, `scheduling:attendance.read` (the second asked of a practice, as `work`) |
| Generator runs | 11, logged in `docs/tooling/generator-log.jsonl`; 2 refused |
| Stored shapes recorded | `node scripts/kit.mjs docs --stored-events`: `stored-events.lock.json` |

What the generators did: `generate aggregate --event-sourced` wrote the aggregate, its birth
event, the codec of its stored events, a builder that replays a history and a given-events
spec; `generate domain-event` added each later event to the union, to `appliers()` with an
empty apply method, and to the codec; the commands, the event handler, the query and the
controller came from their kinds as usual.

Frictions, for the owner of the kit:

1. `scripts/kit.mjs` failed on a fresh checkout: `main()` ran before the constant it reads when
   the cache directory does not exist yet. Fixed by declaring the constant first.
2. The birth event is `<Name>Created`: the glossary held "Create" for calendars only, and its
   meaning was widened to the attendance record.
3. `generate projection` takes an integration event only: the projection of the store, of
   domain events, was written by hand.
4. `generate repository` has no event-sourced form: the port, the adapter over
   `EventSourcedRepository` and the fake were written by hand, about 70 lines.
5. `generate query` without `--search` still wrote a reader port, its in-memory adapter and its
   fake; the query reads the store of the projection, and the three files were removed.
6. Three existing specs grant the `system` role the permissions of the commands the context
   sends itself: each needed `attendance.note`, since cancelling or marking an appointment now
   notes the attendance in the same unit of work.
7. The integration specs, run in parallel on twenty cores beside other workloads, timed out
   while starting PGlite (a hook limit of 10 s); they pass serially and with four workers.

### 2026-10-13, after review: the gates of the stored shapes, an erasure

A review of the lot found the lock of the stored shapes held by memory alone, and no way to run
the erasure the documentation prescribes. What changed in the example:

| | |
|---|---|
| Stored shapes | `npm run docs:check` (`ddd-ts-kit docs --check`) now fails while a version declared in a codec is not recorded in `stored-events.lock.json`; the fingerprint of a shape includes the types of the codec it reaches |
| Data subject | the cancellation event carries the patient it seals the reason for (`cancelled.patientId`), instead of reading it from the identifier of the record; the practice part of that identifier is escaped, so two pairs never share one |
| Erasure | `npm run erase:patient -- <patientId>`: the key is destroyed, then every projection fed by the store is rebuilt |
| Catch-up | a tick that comes while a round runs is skipped; a checkpoint moved first by another replica is a skipped round, not an error |

Frictions, for the owner of the kit:

1. The shape of `scheduling.attendance-record.cancellation-noted` changed in version 1, which
   was recorded but never stored outside the tests and is not merged: its line was removed from
   the lock and recorded again, the path `docs/concepts/event-sourcing.md` describes. Once
   merged, the same change is a version 2 with its upcaster.
2. `docs --check` reported the unrecorded version at once, with the command to run: the gate
   did what the review asked of it.
3. The catch-up and the rebuild of a projection fed by the store are still written by hand in
   the platform (`store-fed-projections.ts`): `generate projection` has no event-store form.

## 2026-10-13: documents of appointments, kept in the file storage

A practice attaches a document to an appointment (a referral, a prescription, a report), a
patient or the practice fetches it through a link of five minutes, and the practice removes
it. The content never reaches the database: the appointment keeps the reference of the stored
file (key, size, media type, checksum), its name and when it was attached.

| | |
|---|---|
| Config | `"storage": "local"`: a directory in development (`.data/files`), and in the end-to-end journey and the integration spec of the slice, each in a temporary directory; the memory in the handler specs. MinIO in `docker-compose.yml` behind the `files` profile is a recipe for moving to an object store (the comment of the service says the steps), not a storage the example runs on |
| Platform | what `init --storage local` writes for this stack (`platform/files/`, `platform/config/read-files.ts`, the file routes mounted before `express.json()`, the upload reader of the HTTP boundary, the purge of staged files every hour), applied as the diff between `init --storage none` and `init --storage local` of the same stack, since `init --force` would have rewritten the hand-tuned files of the platform |
| Generators | `generate value-object` (`AttachedDocument`), two `generate error` (`noDocument`, `documentNameTooLong`), `generate file-upload`, `generate command`, `generate query`, two `generate route`, then `docs` |
| Written or rewritten by hand | the value object, the two refusals, the state and two methods of `Appointment`, the six columns of the mapper, the migration `20261013090000_add-appointment-documents.js` and `upgradeTables` for the in-process database of the tests, the three handlers, the three controllers, the specs, the end-to-end journey |
| Routes added | `POST`, `GET` and `DELETE` `/appointments/{appointmentId}/document`; the rest of `openapi/openapi.yaml` is unchanged (228 lines added, none removed) |
| Audit | `scheduling:appointment.read-document` is a sensitive permission of `auditDecisions`: every allowed read of a document is recorded |
| Tests | 23 unit specs of the slice, the round trip of the reference in the contract of both appointment repositories, `document-lands-with-its-file.spec.ts` on the in-process database and the local storage (the row and the file land together; a commit refused after the file moved returns it to `staging/` and leaves the row without a document), and `test/e2e/journey-documents.e2e.spec.ts` on the local storage: an upload streamed through the multipart reader, the file under its final key on disk, a download through the link, a 415 for a disguised file, a 403 for another patient, the link that stops answering and the file gone once the document is removed |

After the review of the lot, the order of a write changed in the kit and here with it. The
command carries a `FileUpload` (`new FileUpload(file, 'appointment-documents')`), which the
command bus stages after the permission and before the audit entry opens the transaction
(`platform/files/staging-uploads.ts`, as `init` now writes it): no transaction waits on a
client that uploads slowly. The handler reads `command.document.file` and calls
`promoteOnCommit`, which moves the file inside the transaction, as its last step, so a committed
row never points into `staging/` and the hourly purge only meets orphans. One behaviour moved:
an upload to an appointment that does not exist is now received, then left in `staging/` for
the purge, since the handler that finds the appointment runs after the staging. In production
`FILES_PUBLIC_URL` is now required, like `FILES_SIGNING_SECRET`.

What the generators did not fit, to change in the kit:

- `generate file-upload` writes a controller without the schema of its path parameters: a
  document attached to an appointment needs `appointmentId`, written by hand with its class
  schema. The command it writes carries the file only; the identifier of the aggregate was added.
- `generate query` wrote a reader port, its in-memory adapter and its fake: this query reads the
  aggregate and signs a link, so the three files were removed.
- `scripts/kit.mjs` of this example failed on any generator that creates a file (`NOT_A_FILE`
  was declared after the call that read it); fixed here.
- The integration specs of this example time out when vitest runs their files in parallel on a
  loaded machine (PGlite per file); `npm run test:postgres` runs them one file at a time, and
  passes.

## 2026-10-13: refusals at the edge in the audit trail, and the tenancy of the application

Two changes of the kit reached this application.

**A caller refused by a guard leaves a denied decision.** The previous section noted it: since
`PracticeOpeningRoutes` and `AuditRoutes` ask `HasRole('platform-admin')` at the edge, a caller
without the role was refused before the bus, and the trail no longer recorded anything, since no
decision was asked. The HTTP pipeline now reports every refusal of a guard to `onGuardRefusal`,
and `auditGuardRefusals` of `@ddd-ts-kit/audit` records it: category `authorization`, action
`http:<operationId>`, outcome `denied`, the code of the refusal as reason, and the actor, the
session and the correlation of the request. Three files changed here, as `init` now writes them:
`audit/create-audit.ts` (the hook, next to `decisions`), `auth/http-boundary.ts` (`refusals` in,
`onGuardRefusal` out) and `compose-application.ts` (the hook built from the bound `AuditTrail`,
`Clock` and `IdGenerator`). `identity-open-practice.e2e.spec.ts` now holds that the refusal of
a person who is not a platform admin is in the trail, under `http:openPractice`.

**The tenancy of this application is proposed, not yet decided.** The kit can now
confine every statement to a tenant (`"stack.tenancy": "shared-table"`, row-level security, a
schema or a database per tenant). The data here is grouped by practice, but a practice is not a
tenant: a patient books in several practices with one account and lists their appointments across
them, and the boundary between practices is the relationship model, decided per element and
narrowing every search. ADR-0003 proposes it; the owner had asked for a tenancy made explicit
and enforced, so the record stays `proposed` until the owner chooses between it and one network
as a tenant on shared tables. Until then the config says nothing of tenancy, so the new rule
`tenancy/scoped-statement` has nothing to judge: it is the one entry of `NOT_APPLICABLE` of the
conformance suite, with that reason, and the kit proves the rule both ways in its own fixtures and
on the shared-table stacks of its end-to-end matrix.

Checked here: the type check of the application and `ddd-ts-kit check` (0 finding in 657 files).
The end-to-end specs, `npm run verify` and the conformance run were left to the pipeline of the
pull request, which runs them on a fresh clone.

Frictions:

1. **A refusal at the edge is recorded outside the unit of work of any command.** It is written
   when the answer is built, after the request scope closed: the entry carries the execution
   context the pipeline hands over, not one the trail reads from the scope. Same facts, another
   path; a project that writes its own hook must use `GuardRefusal.execution`.
2. **The tenant of the realm token is not the practice.** The `tenant_id` claim still names the
   chain of the audit trail of an actor; a reader who expects it to bound what a user sees will
   be surprised. ADR-0003 says where the boundary is instead.

## 2026-10-13 (later): what a review of the tenancy changed here

A review of the kit's multitenancy found holes the application does not reach, since its config
says nothing of tenancy, and two that it does:

- **A refusal of a caller without a credential is no longer recorded.** The trail of
  `http:openPractice` keeps the refusal of an authenticated person who is not a platform admin
  (what `identity-open-practice.e2e.spec.ts` holds); an anonymous request answered 401 writes
  nothing, so unauthenticated traffic cannot grow the trail.
- **A guard that fails is not a refusal.** A guard of this application that threw something other
  than a `DomainError` would now answer 500 and leave no denied decision.

ADR-0003 went back to `proposed`: the owner asked for an enforced tenancy, and the record says the
opposite, so the owner decides. Nothing else changed in the code of the application.

Frictions:

1. **A tenant id has one grammar now** (letters, digits, `_`, `-`, at most 63). The `tenant_id`
   claim of the realm names a practice by its id, which fits; a realm whose ids held a `.` would
   be refused at the first request.

## 2026-10-12: value objects that throw their refusals

The value objects of the four contexts moved from a `Result` to factories that return the value
or throw, with `ddd-ts-kit value-objects` alone: `"stack.valueObjects": "throwing"` is set, and
nothing was left to a person.

| | Before | After |
|---|---|---|
| Methods returning a `Result` | 18 (17 `create`, `Booking#movedTo`) | 0 |
| `return err(..)` and `ok(..)`/`err(..)` ternaries | 25 and 3 | 28 `throw`, 3 of them after an `if` |
| `unwrap(..)` of a value object | 168, in handlers, aggregates, a domain service, mappers, builders and specs | 0 |
| Assertions on a `Result` in the specs | 31 (`.ok`, `toMatchObject({ ok: false, error })`, `expectRefusal(result, ..)`) | `expectRefusal(() => .., code)` and `expect(() => ..).not.toThrow()` |
| Files | | 82 sources and the config, 389 lines added, 498 removed |

The HTTP contract did not move: `npm run docs:generate` rewrote `openapi/openapi.yaml`
byte for byte, since a request is still validated at the edge by its schema before any value
object is built, and a refusal of a factory still reaches the error mapper as the same
`ConceptError` with the same code. The 1004 unit tests pass unchanged in number.

## 2026-10-12: closed vocabularies instead of magic strings, and numbers with a name

The statuses, kinds and roles of the four contexts became closed vocabularies, each declared once
by `ddd-ts-kit generate vocabulary` (an object `as const` and the union type of its name, under
`domain/vocabularies/`), and the permission ids and realm roles of the platform are read from
their declarations. `language/declared-vocabulary` listed every raw value before the change;
none is left.

| Vocabulary | Context | Raw values replaced |
|---|---|---|
| `AppointmentStatus` | scheduling | 71 |
| `Weekday` | scheduling | 36 |
| `OutcomeState` | analytics | 27 |
| `NotificationKindName` | notification | 20 |
| `RoleName` (the role of a member of a practice) | identity | 15 |
| `ReminderStatus` | notification | 14 |
| `DelegationEndCause` | identity | 9 |
| `Role` (the realm roles a token carries) | platform | 5 |
| permission ids, through the permission set of each context (`schedulingPermissions['appointment.book'].id`) | platform | 30 |
| Total | | 227, in 37 files |

The union types written next to the values (`'requested' | 'booked' | ...` in the aggregate, the
port of the agenda, the row schema, the DTOs) became the type of the vocabulary; an `@IsIn([...])`
of a DTO reads `Object.values(AppointmentStatus)`, in the same order, so the OpenAPI contract is
regenerated byte for byte. The two-word list of who cancelled, `'patient' | 'practice'`, stays a
union of literal types: both words also name a type of resource, a relation of the access model
and a field of a read model, which a vocabulary would report. The published languages keep their
literal values: a contract names them itself.

`clean/no-magic-number` reported 8 numbers in `domain/` and `application/`, all in two value
objects: the minutes of an hour and the two digits of `HH:MM` in `Range`, the minutes of an hour
and the four digits of a year in `TimeZone`. Each is now a constant of its module
(`MINUTES_PER_HOUR`, `TWO_DIGITS`, `YEAR_DIGITS`).

## 2026-10-13: event names declared once, and the inventory of closed values

Each of the 22 domain events now declares its name once, `static readonly eventName =
'scheduling.appointment.expired'`, and carries it in `readonly name = AppointmentExpired.eventName`.
The 33 reactions that repeated it (26 event handlers and publishers, 7 methods of the agenda
projection) read it, `@DomainEventHandler(AppointmentExpired, { name: AppointmentExpired.eventName })`
and `@On(AppointmentExpired, { name: AppointmentExpired.eventName })`, and the 5
integration event handlers of `notification` read the type they handle from the declaration of
`scheduling`, `static readonly eventType = appointmentExpiredV1.type`. The event catalog script
resolves that reference through the names the published languages export: `docs:generate` wrote
`event-catalog.md`, `asyncapi.yaml` and `openapi.yaml` byte for byte as before. The specs keep the
names written out: a test spells what it expects.

Before the change `scheduling.appointment.expired` was written six times in the sources: the
domain event, the published-language declaration, the event handler, the publisher, the agenda
projection and the consumer in `notification`. It is now written twice, once per language: the domain event of
`scheduling` and its published contract, which names its own values.

What else is a closed list of values in the example, with what holds it:

| Category | Count | Declared in | Read as | State |
|---|---|---|---|---|
| Statuses and kinds of the model | 7 vocabularies, 33 values | `domain/vocabularies/*.vocabulary.ts` | `AppointmentStatus.NoShow` | typed, `language/declared-vocabulary` |
| Realm roles | 1 vocabulary, 3 values | `src/platform/auth/role.ts` | `Role.Admin` | typed, same rule |
| Permission ids | 31 | `definePermissions` of each context | `schedulingPermissions['appointment.book']` | typed, same rule |
| Domain event names | 22 | `static readonly eventName` of the event class | `AppointmentExpired.eventName`, 33 reactions | typed, `events/name-format`, `declarations/role-declared` |
| Integration event types | 14 declarations | `type` of the published-language declaration | `appointmentExpiredV1.type`, 5 handlers | typed |
| Error codes | 43 | the factory of the concept | `errors: [..]` of a route | literal, each checked against a factory by `errors/known-code` |
| Job names | 3 | `@Scheduled('notification.send-due-reminders')` | repeated once in `systemActor(..)` of the job | literal twice per job, held equal by `scheduling/job-name` |
| Consumer names | 5 | `{ consumer: '..' }` of `@IntegrationEventHandler` | repeated once in `systemActor(..)` of the handler | literal twice per handler |
| Other system actors | 5 | `systemActor('..')` of a domain event handler | once | literal, single site |
| Projection and policy names | 4 and 2 | `@Projection('..')`, `@Policy(.., { name })` | once | literal, single site |
| Route group tags | 5 tags on 8 root groups | `tags: ['scheduling']` | the name of the context | literal, `scheduling` 3 times and `identity` twice |
| ReBAC resource types | 8 | `defineSchema` of the platform | `{ type: 'calendar', id }` in `@Requires`, 31 places | literal, not judged |
| ReBAC relations | 13 | `defineSchema` of the platform | `relation: 'patient'` in 2 repositories, 9 places | literal, not judged |
| Cache keys | 0 | none | the cache is bound in the platform; no context reads or writes a key | nothing to declare |

Not done, and why. Job and consumer names: the decorator of a class cannot read a static of that
class under standard decorators (its arguments are evaluated before the class exists), and
`scheduling/job-name`, the generated lists and the docs read the literal of the decorator; the
second copy, in `systemActor(..)`, stays. Route group tags are the name of the context and are
not compared anywhere. ReBAC resource types and relations are declared by the relationship schema
of the platform, which the application layer may not import; a typed form needs a vocabulary the
contexts can read (the shared kernel, or one per context), not decided in this change.

The enum measurement now covers each compiler a generated project runs, on Node 24.21, with a
string `enum` and the object `as const` of the same values, each file compiled and run:

| Compiler | Where a generated project runs it | `enum` | `as const` |
|---|---|---|---|
| `tsc` 6.0.3 | the build and the type check (a Nest project too) | accepted | accepted |
| `tsc` under `erasableSyntaxOnly` | a project that opts in | refused, TS1294 | accepted |
| Node's type stripping | a `.ts` file run by `node` | refused, `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` | runs |
| tsx 4.23.15 (esbuild 0.28.2) | `npm run dev` | runs | runs |
| Oxc, through rolldown 1.2.13 | Vitest 5 (Vite 8.3.4) | runs | runs |
| SWC 1.16.13 | Jest, through `@swc/jest` | runs | runs |

SWC was measured with its WebAssembly build of the same version: the native one refused to load on
this machine (`ERR_SWC_NATIVE_CACHE`, a permission check of its cache directory), which says
nothing of the syntax. The transpilers accept both; what refuses the `enum` is the erasable
subset, which Node runs and `tsc` can enforce. The object `as const` runs on every one of them,
so the decision stands.

## 2026-10-12: a typed client of the contract

`node scripts/kit.mjs sdk` generated `clients/api`, the package `scheduling-api-client`, from
`openapi/openapi.yaml`, and wired the example: `"sdk"` in the config, the workspace, the `paths`
entry of the package in `tsconfig.json`, knip with the root as a workspace and the clients left
out, and the scripts (`docs:generate` and `docs:check` end with the client, `ci:build` builds
it). The scripts that call the CLI go through `scripts/kit.mjs` here, as the others do; the
command leaves a script that already runs it.

| | |
|---|---|
| Generated | 6 sources, 1 748 lines, for 25 operations and 39 error codes; a README of 100 lines; package.json and two tsconfig files |
| Time of `sdk --check` | 0.18 s, the contract read back from YAML, no build |
| Specs moved to the client | the specs of registering a person and of opening a practice, and `registerPeople` and `openStaffedPractice`, which four spec files set their people and practice up with: 131 lines added, 97 removed |
| New helpers | `expectAnswer` and `expectRefusal`, typed by the outcome: a status or a code the operation does not declare does not compile (`'SLOT_TAKEN'` for the 404 of `openPractice` is refused, `418` too) |
| End-to-end specs run after the change | the two that changed, the three journeys and the spec of adding a member, 36 tests, pass in process |
| Left on the HTTP helpers | `VALIDATION_FAILED`: a body the contract does not describe cannot be written with the client, which is the point; the steps that wait for another context (`eventually`) |

Frictions met while wiring it, each fixed in the kit before this commit: Biome lays out a
package.json as npm does (every list expanded), so the command writes it that way; knip, once
package.json declares workspaces, asks for the root to be a workspace of its own, so the command
moves what knip.json said of the project under `workspaces["."]`; `imports/alias-declared`
reported `sdk:build` as a compile without `build-aliases`, which a client does not need (its
sources import relatively), so the rule leaves the build of `clients/`; and the CLAUDE.md of the
project said never to add a `paths` entry, so it now says that the command writes the one of
each client.

The three generators the kit did not take were measured on this contract
(`docs/tools/client-sdk.md`): none types `problem.code` by the codes the contract lists, so
`expectRefusal` could not have been written on their output.

## 2026-10-13: the typed client after its review

A review of the client found what the first pass had not met on this example. Each fix was made
in the kit, then `npm run docs:generate` rewrote `clients/api`:

| | |
|---|---|
| A 500 of the application | thrown as `UnexpectedResponseError` with the raw body; it now reads the problem document, `code` `INTERNAL_ERROR` and `requestId`, the reference a caller quotes |
| `operations.ts` | each operation holds its own description inside its function: no module-level constant, so no two operation ids can clash (`listItems` and `list_items` once both gave `LIST_ITEMS`) |
| `apiAs(actor)` | gave the token as a raw `authorization` header; it now gives it as the `bearer` credential, a function asked before each request, so the specs prove the authentication of the client against the real server, and it no longer needs `await` |
| Lockfile | none in this directory, which is a workspace of the kit; a generated npm project is told to run `npm install` when its lock misses a client |

The two changed spec files and the three journeys pass again in process (30 tests).

## 2026-10-13: background jobs, a state machine and a process manager

What this example gained, and how much of it a generator wrote:

| | |
|---|---|
| The lifecycle of an appointment | `domain/state-machines/appointment.state-machine.ts`, written by hand before `generate state-machine` existed; the aggregate now asks it every status, and `CONTEXT.md` draws it |
| The confirmation deadline | a process manager (`application/processes/confirmation-deadline.process.ts`), four event handlers and the background job of its timeouts, written by hand before `generate process` existed; its shape is the one the generator now writes |
| The clearance of a calendar | `generate command` (`ClearCalendar`), `generate query` (`GetClearance`) and `generate route` twice wrote the skeletons; the background job was written by hand |
| Stores | the jobs and the process instances in the `messaging` schema of PostgreSQL (`KnexJobStore`, `KnexProcessStore`), recorded as `"queue": "database"` |

Frictions met on the way:

- `generate background-job ... --command CancelAppointment` refuses the command: its constructor
  needs `appointmentId`, which a generated job cannot know. Right for a generated job, which sends
  one command from its actor; the clearance sends one command per element of its payload, a
  loop with a checkpoint that no template guesses. Written by hand, 70 lines.
- `generate query GetClearance` wrote a reader port, its in-memory adapter and its fake: the
  answer comes from `JobQueue.find`, a port of the kernel, so the three files were deleted.
- In a spec, a command executed with an actor that is not the one of the execution scope
  enqueues its job as the scope's actor (`test-user`), not as the actor of the command: the job
  was then refused `appointment.cancel`. `application.as(holder, ...)` in the spec, as the HTTP
  boundary does, fixed it; the spec `generate background-job` writes enqueues the same way.
- The first status list of the answer of `GetClearance` wrote `'cancelled'` as a literal:
  `language/declared-vocabulary` reported it as a value of `AppointmentStatus`. Since the review
  below, the kit publishes `QueuedJobStatus` as a vocabulary and the contract has an enum.

Proven: 16 unit tests for the clearance (the command, the job interrupted half-way and resumed,
an appointment cancelled meanwhile, the query, both controllers), and an end-to-end journey of
two tests on the application with its worker running, on PostgreSQL in process: the time off is
refused, the clearance cancels both appointments and says `{ done: 2, total: 2 }`, then the
time off is accepted. The unit suite (1 340 tests) and its coverage floors pass.

### 2026-10-13, after review: a clearance belongs to its calendar

A review of the lot found the query of a clearance trusting the secrecy of its identifier, its
status published as free text, and the queue blind to tenants. What changed here:

| | |
|---|---|
| Ownership | `ClearCalendar` enqueues its job with the calendar as its `subject`; `GetClearance` answers `UNKNOWN_CLEARANCE` (404) for a job whose subject is another calendar, and the queue hides the jobs of another tenant from `find` |
| Contract | `GET /calendars/{calendarId}/clearances/{clearanceId}`: `status` is now an enum (`waiting`, `running`, `succeeded`, `cancelled`, `dead`) through `@IsIn(Object.values(QueuedJobStatus))`; the typed client narrows it the same way. No route was added or removed |
| Proven | a unit case (the clearance of another calendar is unknown) and an end-to-end case (the practitioner of another practice gets 404 for the clearance of this one) |
| Known gap | the clearance fixes its list when it is asked and does not reserve the period: an appointment booked before the time off is added is neither cancelled nor blocked, and the time off is refused again; a retried request starts a second clearance. Written in the handler, left as is |

`generate background-job` now carries the inputs of a command in the payload (a `Date` as its
ISO text): `--command CancelAppointment` would generate today, but the clearance still sends one
command per appointment of its payload, with a checkpoint between two, which no template guesses.

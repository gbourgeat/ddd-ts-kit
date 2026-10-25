**English** · [Français](spend-management-example.fr.md)

# Proposal: a second example, spend management on the most popular stack

**Summary.** The kit has one example, [scheduling](../../examples/README.md): Express,
class-validator, tsyringe in the declared style, Knex, Redis Streams, Keycloak, ReBAC, Vitest.
It proves the method on the defaults of `init` and their nearest variants. This page specifies a
second example that proves it on the other half of the stack: NestJS with its own container,
Prisma, Jest, Kafka, S3, ABAC, Winston, Scalar, in the explicit style, on a business every
company knows and no two run the same way, spend management (expense reports, corporate cards,
approvals, budgets, reimbursements, the accounting export). It is written to be given to the
story and parallel-work skills as a statement of work. Its first part is not the example: a
dry run of `init` on 2026-10-24 shows that the most popular stack switches off four
capabilities of the kit (background jobs and processes, the shared-table tenancy, the SQL audit
trail, the identity preset), so the kit is fixed first, and the example is the proof that the
fixes hold. MySQL is a decision taken here, not an oversight: not in this example, with the list
of what it would take.

## Status (2026-10-25)

**Specified, part 1 under way.** The stack below was run through `init --dry-run` on 0.88.0, which
is where the refusals of part 1 come from. Each part is one or several pull requests; a part is
marked built here when its last pull request lands.

| Part | Verdict |
|---|---|
| 1. The kit on the stack: queue and processes on Nest, tenancy and audit on Prisma, the preset on Nest and Prisma | under way, before the example: 1.1 built (#273), 1.2 built (#276, read models included), 1.3 built (#297), 1.4 built (#287), 1.5 built (#301, #302), 1.6 built (#PR), the TypeORM job store and the default of the queue on every container (#298) |
| 2. The example: `examples/spend-management`, seven contexts, the documents of the method | to build, after part 1 |
| 3. The repository: a second workspace in the gates, the website, the examples page | to build, with part 2 |
| MySQL | **not in this example**, see [What is left out](#what-is-left-out-and-why) |

## Why a second example, and why this one

Two wishes drove the choice and partly contradict each other: the most popular technologies,
and as many capabilities of the kit as one application can exercise.

**The most popular stack is not the default stack.** By downloads and by job offers, the
TypeScript back end of 2026 is NestJS (about 16 million weekly downloads of `@nestjs/core`,
[HTTP frameworks](../tools/http-frameworks.md)), class-validator with it, Prisma as its ORM,
Jest as its runner, Kafka as its broker, S3 as its file storage, Winston as its logger. The
scheduling example shows none of these but class-validator. A reader who comes from that world
finds no page of the kit written in their words, and the kit itself has run that stack only
through the generated matrix of `stacks.ts` (zero finding and a type check), never through a
whole application with a gate, a real run and a tooling report.

**That stack switches capabilities off.** `init` refuses, today, on 0.88.0:

| Flags | Refusal of `init` or of `generate` | Where |
|---|---|---|
| `--di nest --queue database` or `--queue redis` | `--queue database cannot be combined with --di nest`: the job store is bound by the kernel module of `@ddd-ts-kit/di` | `packages/cli/src/init/stack/resolve-queue.ts` |
| `--di nest`, then `generate background-job` or `generate process` | `A background job cannot be generated with --di nest`: the queue, its worker and the process runner are bound by the kernel module | `packages/cli/src/generate/kinds/background/require-container.ts` |
| `--orm prisma --tenancy shared-table` (TypeORM alike) | the tenant helpers are generated for Knex and Drizzle | `packages/cli/src/init/stack/resolve-tenancy.ts` |
| `--orm prisma --queue database` | the jobs table ships with `@ddd-ts-kit/knex` and `@ddd-ts-kit/drizzle` | `resolve-queue.ts` |
| `--orm prisma --audit on` | accepted, but the project starts on an in-memory trail behind a `TODO(platform)`: the audit package stores on Knex and Drizzle only | `packages/cli/templates/init/platform/audit/create-audit.ts.tpl` |
| `--di nest --preset identity` | the identity preset is not written for `stack.style: explicit`, nor for Prisma, nor for `http: nest` | `packages/cli/src/presets/identity-refusal.ts` |
| `--orm prisma --database mysql` | the generated adapters are written for PostgreSQL | `packages/cli/src/init/stack/resolve-persistence.ts` |

Every line but the last is a gap of the kit, not a limit of the technology: Nest has a
container that can hold a `JobStore`, Prisma writes a `where` with a tenant as well as Knex
does. An example that worked around them (jobs in memory, tenancy by hand, no audit, identity
rebuilt with the generators) would teach the workaround. So the gaps are closed first, and the
example is what proves they are closed.

**Why spend management.** The business has to be legible to anyone, unlike a niche vertical,
and complex enough that each capability of the kit answers a real need rather than a demo:
money (value objects, currencies, rounding), rules about amounts and people (ABAC: thresholds,
self-approval forbidden, finance above a limit), documents (receipts in S3), an external system
that calls back (the card issuer, idempotent webhooks, an anti-corruption layer), a long-running
process with a deadline (an approval that escalates, a payout that waits for the bank), a
ledger that must never be rewritten (an event-sourced aggregate), exports in the formats of
other software (CSV, XML, by content negotiation), periods that close on a date (scheduled
jobs), one company that must never see another (tenancy). Scheduling has slots and calendars;
this one has money and workflows. Together the two examples cover the kit twice, on two stacks
and two businesses.

## Part 1: what the kit builds first

Each item names the refusal it lifts, the files found on 2026-10-24, what is added, and how it
is proven. The order is the order of dependency: the example needs all of them at `init`.

### 1.1 The queue, the worker and the processes on the Nest and manual containers

Today the manual platform (`platform.manual.ts.tpl`, `lay-foundations.manual.ts.tpl`,
`create-platform.manual.ts.tpl` under `packages/cli/templates/init/platform/composition/`)
builds no `JobQueue`, `QueueWorker` or `ProcessRunner`, although `persistence-over.knex.ts.tpl`
and `persistence-over.drizzle.ts.tpl` already build the stores (`jobs`, `processes`) and
`open-redis.ts.tpl` the `RedisJobStore`. The tsyringe platform rebinds them in
`platform.module.tsyringe.ts.tpl` through `kernelModule`.

To build:

- the manual platform builds the queue, the worker and the runner the way `kernelModule` does
  (`packages/di/src/kernel/kernel-module.ts`, lines 218 to 252): on the `jobs` and `processes`
  of the persistence, or on `redis.jobs(..)`, with the clock, the execution scope, the logger,
  the metrics and the error reporter, tuned by the same `queues` options; a worker entry point
  (`generate worker`) that runs them on `--di nest` and `--di manual`;
- `resolve-queue.ts` accepts `--queue database` and `--queue redis` with every container, and
  keeps refusing `database` with an ORM that has no table (lifted for Prisma by 1.3);
- `generate background-job` and `generate process` write, in the manual family, the class and
  its registration in `<context>.module.ts` (the `module.manual.ts.tpl` family in
  `packages/cli/templates/context/`), as the tsyringe family writes the declaration;
  `require-container.ts` goes away;
- `service-selection.ts` (the standalone entry point of a context) passes the worker on;
- [Background jobs](../concepts/background-jobs.md), [Sagas and process
  managers](../concepts/sagas-and-process-managers.md), [Dependency
  injection](../tools/dependency-injection.md) and [CONFIG.md](../CONFIG.md) stop saying
  tsyringe only.

Proof: `stacks.ts` gains `nest + knex + queue database` and `nest + redis queue`; the
end-to-end spec of the background jobs runs on the Nest stack; `init --dry-run` with the
command of part 2 passes this refusal.

### 1.2 The shared-table tenancy on Prisma, and on TypeORM

The helpers exist on Knex (`tenantTable`, `ownTenantTable`, `packages/knex/src/tenancy/`) and
Drizzle (`tenantCondition`, `ownTenantCondition`, `packages/drizzle/src/postgres/tenancy/`);
the Prisma README shows the pattern by hand (`where: { id, ...tenantScopeOf(this.scope) }`,
`packages/prisma/README.md`, "Audit columns, tenant scoping and pages"); TypeORM has the
column (`tenantColumn`) and no condition. The outbox stores of Knex
(`add-outbox-tenant-column.ts`) and Drizzle (`tenant-outbox-table.ts`) keep the tenant of each
event so that a consumer runs in it; `packages/prisma/src` and the TypeORM outbox hold no tenant
at all.

To build:

- `@ddd-ts-kit/prisma`: `tenantWhere(scope)` and `ownTenantWhere(scope)` (the condition every
  read and write spreads into its `where`; the own one refuses the elevation of platform staff
  on a write, as `ownTenantTable` does), the tenant column of the outbox and of the processed
  events, the consumer run in the tenant of the event, held to the same contract suites as Knex;
  the same two conditions on TypeORM beside `tenantColumn`;
- the generated Prisma repository with `--tenant-scoped`, and every repository of a project
  initialised with `--tenancy shared-table` on Prisma: the templates of `generate repository`,
  the `schema.prisma` fragment (`tenant_id`, the indexes that start with it);
- the rule `tenancy/scoped-statement` (`packages/cli/src/check/rules/tenancy-scoped-statement.ts`)
  reads a Prisma delegate call (`findFirst`, `findMany`, `update`, `updateMany`, `delete`,
  `deleteMany`, `count`, `aggregate`) whose `where` does not spread the helper, and a TypeORM
  query builder without the condition; `tenancy-fixtures.ts` gains the Prisma and TypeORM
  scoped and unscoped adapters; `findUnique` is reported as such, since the tenant is never part
  of the key;
- `resolve-tenancy.ts` accepts Prisma and TypeORM; [Multitenancy](../concepts/multitenancy.md),
  [Persistence](../tools/persistence.md) and the two READMEs say so.

Proof: the tenancy contract suite of `@ddd-ts-kit/testing` on the Prisma and TypeORM stores
(PGlite in the unit run, PostgreSQL in the integration job); the matrix gains
`fastify + prisma + shared-table`; the conformance suite of the example (part 3) breaks the rule
once in a Prisma repository and must see it reported.

### 1.3 The jobs and the process instances on Prisma

`KnexJobStore`, `KnexProcessStore`, `DrizzleJobStore`, `DrizzleProcessStore` exist, held to
`jobStoreContract` and the process store contract. To build: `PrismaJobStore` and
`PrismaProcessStore` on the `messaging` schema, their models in the generated `schema.prisma`
(`packages/cli/templates/init/platform/database/schema.prisma.tpl`) and their binding in
`persistence-over.prisma.ts.tpl`; `resolve-queue.ts` accepts `--queue database` with Prisma.
The claim uses the same `FOR UPDATE SKIP LOCKED` as the Prisma outbox claim
(`prisma-outbox-claim.ts`). TypeORM may follow in the same pull request or a later one; the
example does not need it.

Proof: the two contract suites on PGlite and PostgreSQL; `stacks.ts` gains
`nest + prisma + queue database`.

### 1.4 The SQL audit trail on Prisma

**Built**, with TypeORM: `PrismaAuditTrail` and `TypeOrmAuditTrail` (one class each, trail and
reader) held to `auditTrailContract` and to the SQL specs of the other stores, `auditPrismaModels`
and `auditEntities` proven to create the tables of `createAuditTables`, `create-audit.ts.tpl`
binding them, the `TODO(platform)` kept for `custom` and no ORM. The text below is the plan as it
was written.

`@ddd-ts-kit/audit` stores on Knex and Drizzle; on Prisma the generated project starts on the
in-memory trail behind the `TODO(platform)` of `create-audit.ts.tpl` (line 131). To build:
`PrismaAuditTrail` and `PrismaAuditReader` held to `auditTrailContract`, the models in
`schema.prisma`, the hash chain and the erasure of a subject (`auditedSubjectKeys`) as on Knex,
`create-audit.ts.tpl` binding them with Prisma and the `TODO(platform)` kept for TypeORM and
`custom` only.

Proof: the audit contract suite on Prisma; the `search-audit-entries` route of the platform in
the end-to-end run of the example.

### 1.5 The identity preset on Nest, Prisma and the explicit style

`identity-refusal.ts` needs `style: declared`, `dependencies: signature`, `orm: knex|drizzle`,
`validation: zod|class-validator`, `http: express|fastify`, `authn: jwt|keycloak`,
`database: postgres`. The preset holds 275 template files: 29 persistence variants (mappers,
row schemas, repositories, `.knex.` and `.drizzle.`), 35 validation variants (`.zod.` and
`.class-validator.`, the latter already written), the rest shared.

To build:

- the 29 persistence files on Prisma (`.prisma.` variants: mappers over the generated client,
  repositories with `tenantWhere`, since the preset makes organisations tenants with
  `--tenancy shared-table`, `organisations-as-tenants.ts`), and the `schema.prisma` fragment of
  the five aggregates (accounts, organisations, members, invitations, delegations) with the
  partial unique indexes the preset relies on, written as Prisma writes them (a raw migration
  step where the schema language cannot);
- the explicit `identity.module.ts` the manual family needs: the bindings `kernelModule` and
  the declarations do in the declared style, written once in the template, the way
  `module.manual.ts.tpl` writes an empty context; the route group of the preset mounted by
  `create-app-module.ts.tpl` on Nest;
- `identity-refusal.ts` accepts `explicit` with `nest` and `manual`, `prisma`, `http: nest`;
  the guide [Bootstrap with well-designed contexts](../guides/bootstrap-with-well-designed-contexts.md)
  says what changed and keeps its reasons for the rest (`dependencies: signature` stays, it has
  no meaning in the explicit style and is not read there).

Proof: the end-to-end spec of the preset runs on `nest + class-validator + prisma + jest` as it
runs on the default stack: the project is green as generated (checker, ESLint, dependency
cruiser, knip, its unit and end-to-end specs), its contract is current.

### 1.6 Jest in the proof of the kit

`stacks.ts` leaves Jest out of the stacks the workspace runs ("not installed in this
workspace"), so a project on Jest is type-checked but never run by the matrix. The example is
the first application on Jest held green in CI, with the `process` fix of #233 behind it. The
kit's matrix gains one runnable Jest stack (Jest installed as a dev dependency of the
workspace, one stack in `RUNNABLE`), so that the proof does not depend on the example alone.

### 1.7 What `init` and the templates learn from the example

The scheduling example was built with 213 generator runs and 27 refusals, and its tooling
report lists about 40 hand fixes of generated code. The second example is built the same way
and keeps the same report; every hand fix of generated code on this stack is either a defect
fixed in the kit in the same pull request series, or a line of the report that says why not.
This is the part that cannot be specified in advance; it is why the example is built after
part 1 and not alongside it.

## Part 2: the example

### 2.1 Statement of needs

Written as `examples/spend-management/docs/architecture/needs.md`, in the words of its product
owner, the finance director of a group of companies that gives this platform to its employees.
The shape follows [scheduling's](../../examples/scheduling/docs/architecture/needs.md): who we
are, what we need in numbered paragraphs, what we do not need, how we will judge it. The content,
in short:

1. **Spend according to a policy.** Each company sets its expense policy: categories (travel,
   meals, lodging, equipment, mileage), a ceiling per category and per day, a receipt required
   above an amount, a deadline to submit after the expense, mileage paid at a rate per
   kilometre, per diems by country. An expense in another currency is converted at the rate of
   its day. An employee files expense reports: one or several lines, each with its receipt, its
   category, its date, its amount; a report is submitted whole.
2. **Pay with a card.** The company gives some employees a corporate card with a monthly limit
   and allowed categories. The issuer asks us, in real time, whether an authorization is
   allowed; we answer in under two seconds or the issuer declines. A settled transaction has to
   be matched to an expense line with its receipt within ten days; otherwise the employee is
   reminded, then their card is frozen until they comply.
3. **Approve.** A submitted report is approved by the employee's manager; above a threshold set
   by the company, by finance as well, in that order. Nobody approves their own report, nor a
   report of someone who approves theirs. An approver who is away names a delegate for a period.
   A report that waits more than five working days escalates to the approver's own manager. A
   report is approved whole, or returned with the lines to fix, or rejected with a reason.
4. **Hold the budget.** Each company has cost centres with a budget per period (month or
   quarter) and per category. A submitted report commits its amount on its cost centre; an
   approved one consumes it; a rejected one releases it. The controllers see the consumption
   live and are warned at 80 percent and at 100 percent; a report that would exceed a closed
   budget needs finance whatever its amount. A period closes on its last day: no more commitment
   on it, the remainder reported.
5. **Reimburse.** Approved reports of an employee are paid in the next payout run of their
   company, weekly, by bank transfer: one batch, one file for the bank (SEPA pain.001), one
   status per transfer when the bank answers, within three days, or the transfer is marked
   unknown and finance is told. Card expenses are not reimbursed; they are reconciled.
6. **Keep the books.** Every approved expense and every card transaction lands in the ledger of
   its company as a journal entry on the accounts of its chart of accounts; the ledger is never
   rewritten, a correction is a new entry. The accountant exports the entries of a period to the
   accounting software, in its format (CSV for one, XML for another), and locks the period once
   exported.
7. **Keep each company to itself.** An employee sees their reports and their card. A manager
   sees the reports of their cost centres. Finance and the accountant see everything of their
   company and nothing of another. The platform operators open the companies and support them,
   and read, never write, with the elevation recorded.
8. **Tell people.** The employee learns that a report was approved, returned, rejected, paid;
   the approver that a report waits; the controller that a budget is at 80 percent; every
   notification is in the application and, when the person wants it, by email, with a daily
   digest instead when they ask for it.

What is not needed: travel booking, a mobile application, purchase orders and suppliers
(a second step), VAT recovery.

### 2.2 Contexts

Seven bounded contexts, from the discovery (`discovery.md`) and the boundary tests of
[Bounded context](../concepts/bounded-context.md); `contexts.md` records the cuts that were
rejected (cards as a module of expenses, approval inside expenses, accounting inside budgets).

| Context | Kind | What it holds | Modules |
|---|---|---|---|
| `identity` | generic, **the preset** | accounts, organisations (one organisation is one company, one tenant), members and their role, delegations | as written by the preset |
| `expenses` | core | the expense policy of a company, expense reports and their lines, receipts (files in S3), currency conversion at the rate of the day, submission, return, the lifecycle of a report | `policy`, `reports`, `receipts` |
| `approval` | core | an approval case per submitted report, the chain (manager, then finance above the threshold), delegations of approval for a period, the escalation after five working days (a process manager with a timeout), the decision | none |
| `cards` | supporting | corporate cards, their limits, the real-time authorization of the issuer (anti-corruption layer, a projection answered under two seconds), settled transactions, matching to an expense line, the reminders and the freeze | `authorizations`, `matching` |
| `budgets` | supporting | cost centres, budgets per period and category, commitments and consumption, the alerts, the closing of a period on its last day | none |
| `reimbursement` | supporting | payout runs, batches of transfers, the SEPA file (XML by content negotiation), the status answered by the bank (a process manager with a three-day timeout), bank details of employees | none |
| `accounting` | supporting | the chart of accounts of a company, the ledger kept as its events (event sourcing per aggregate), journal entries, the export of a period (CSV, XML), the lock of a period | `ledger`, `export` |
| `notification` | generic | one notification per event and recipient, the channel preferences, the daily digest; the shape of scheduling's, rewritten in this business's words | none |

The context map (`context-map.md`) names each pair; the shape in one line: `identity` is
upstream of everything (published language, organisations as tenants); `expenses` is upstream
of `approval` (customer-supplier: the case is opened for a submitted report and the decision
comes back), of `budgets`, `reimbursement`, `accounting` and `notification` (published
language); `cards` is upstream of `expenses` (a settled transaction becomes a line to match) and
of `accounting`; `approval` is upstream of `expenses` (conformist: the report takes the
decision as it is), `budgets` and `reimbursement`; `reimbursement` of `accounting` and
`notification`; `budgets` of `notification`. No cycle: `approval` answers `expenses` through
an event, never a command.

### 2.3 Stack

The command, as `plan.md` records it; in this repository the CLI is
`node ../../packages/cli/dist/bin.js`, run from `examples/spend-management`:

```bash
npx ddd-ts-kit init --http nest --di nest --validation class-validator --tests jest \
  --orm prisma --database postgres --events outbox --broker kafka --cache redis --queue database \
  --storage s3 --tenancy shared-table --authn keycloak --authz abac --audit on \
  --errors sentry --logger winston --docs-ui scalar --ci github \
  --representations negotiated --forms on --sdk --package-manager npm \
  --context identity:generic --preset identity \
  --context expenses:core --context approval:core --context cards:supporting \
  --context budgets:supporting --context reimbursement:supporting \
  --context accounting:supporting --context notification:generic --json
```

Each value against scheduling's, and why:

| Decision | Scheduling | Spend management | Why |
|---|---|---|---|
| HTTP, container, style | Express, tsyringe, declared | **NestJS, its container, explicit** (`init` imposes `explicit` with `--di nest`) | the most used TypeScript framework; the example shows what framework-agnostic routes cost with Nest and what Nest still gives (its modules for health and metrics) |
| Validation | class-validator | class-validator | Nest's own; the legacy decorator mode on the whole program, as on scheduling |
| Tests | Vitest | **Jest** | Nest's default and the most used runner; first application on Jest held green |
| ORM, database | Knex, PostgreSQL | **Prisma**, PostgreSQL | the most used TypeScript ORM; PostgreSQL stays, see MySQL below |
| Events, broker | outbox, Redis Streams | outbox, **Kafka** (KRaft, one node) | the most used broker; the fake of `@ddd-ts-kit/kafka` runs the specs, the real server runs in one CI job |
| Cache, queue | Redis (Dragonfly), database | **Redis (Valkey in compose)**, database | `--queue database` is what 1.1 and 1.3 enable; the cache backs the rates of the day and the rate limiter of the webhook |
| HTTP cache | Varnish | **none** | no public read in this business: every answer is per actor and per company; a shared cache would show nothing |
| Storage | local | **S3** (MinIO in compose) | receipts and the bank and export files |
| Tenancy | shared-table | shared-table | one organisation is one company; what 1.2 enables on Prisma |
| Authentication | Keycloak | Keycloak | the one provider the compose stack has; the preset maps its claims |
| Authorization | ReBAC, with roles | **ABAC, layered over roles** | the rules are about amounts, cost centres, thresholds and people (self-approval); ADR 0001 says how lists are narrowed, since a predicate is not a query |
| Audit, errors, logger | on, GlitchTip, pino | on, GlitchTip, **Winston** | the audit on Prisma is what 1.4 enables; Winston is the most downloaded logger |
| Documentation UI | Swagger | **Scalar** | the other UI of the kit, never shown |
| CI | both | GitHub | the gate of the example runs in this repository's pipeline; the GitLab pipeline is proven by scheduling |
| Representations, forms | negotiated, on | negotiated, on | the SEPA file and the accounting export are XML and CSV of the same routes; the forms of the expense policy are served to the client |
| Package manager | npm | npm | the example is a workspace of this repository's npm workspace, as scheduling is; `pnpm` is proven by the generated matrix |
| Refusals, routes, schemas, value objects, literals, values | the defaults | the defaults | nothing to prove again |

### 2.4 The capabilities of the kit, each in one place

The table the README of the example opens with: a reader looks for a capability and opens one
folder. `<c>` stands for `src/contexts`.

| Capability | Where it is exercised |
|---|---|
| aggregates, value objects, state machines | `ExpenseReport` and its lifecycle (draft, submitted, returned, approved, rejected, paid), `Money` with currency and rounding, `Mileage`, `ApprovalCase`, `Budget`, `Card` |
| modules of the model | `expenses` (`policy`, `reports`, `receipts`), `cards`, `accounting` |
| policies (ABAC), permissions on the use case | `approval`: nobody approves their own report nor a report of someone who approves theirs; a manager up to the threshold of the company, finance above; `expenses`: an employee reads their own, a manager their cost centres, finance everything; `budgets`: a controller of the cost centre; the explicit deny of a frozen card |
| access scope on a search | the reports a manager lists are those of their cost centres: the attributes of the actor become the scope of the search, not a post-filter (ADR 0001) |
| multitenancy | one organisation is one tenant; the operators read with the elevation recorded; the outbox carries the tenant to every consumer |
| file storage | receipts (staged before the transaction, moved with the commit, served by signed links), the SEPA file and the export file written by background jobs |
| integration events, outbox, Kafka, idempotent consumers | fourteen events or more across seven contexts; a redelivered `approval.decision.taken` never approves twice |
| anti-corruption layer, gateway, webhook | the issuer's authorization request and settlement webhook (`cards`), idempotent by the issuer's id, answered from a projection of limits under two seconds, with a timeout and a circuit breaker on the issuer's own API; the exchange-rate provider (`expenses`) behind a gateway, cached per day |
| process managers with timeouts | the escalation of an approval after five working days; the status of a payout batch within three days |
| background jobs | the SEPA file of a batch, the export of a period, the daily digest, the conversion of a report's lines on submission |
| scheduled jobs | the weekly payout run, the closing of a period on its last day, the reminders and freezes of unmatched transactions, the purge of staged files |
| event sourcing per aggregate | the ledger of a company (`accounting`): entries are its events, a correction is a new entry, projections give the balances; an upcaster when the entry gains a field |
| projections and read models | the balances of the ledger, the consumption of a budget, the limits of a card, the reports waiting for an approver |
| representations by content negotiation | `GET /payout-batches/:id/file` in XML (pain.001), `GET /periods/:id/export` in CSV or XML; the same route, one schema |
| forms described by the server | the expense policy of a company, edited through the form the server describes; fields reserved to finance hidden from a manager |
| audit trail | every command, the refusals of the guards at the edge, the elevation of an operator; the search route of the platform |
| resilience | `@Retry` and `@Timeout` on the issuer and the bank, a circuit breaker on the exchange-rate provider, the rate limiter on the webhook |
| observability | one trace from the webhook to the ledger entry; Winston to stdout; GlitchTip for the failures |
| typed client | the generated SDK, used by the demo script |
| extractability | `cards` has its own entry point (`generate service`) and its boot test, since it is the context a company would scale alone |

### 2.5 Decision records

Written as the work raises them; four are known now.

| ADR | Decision |
|---|---|
| 0001 | ABAC layered over roles, and how a list is narrowed: the attributes of the actor (cost centres, role, company) become an access scope the search applies, the policies decide on one element; a pure predicate never filters a page |
| 0002 | one organisation is one tenant (as scheduling's 0003, in this business: a company, its cost centres, its policy) |
| 0003 | the ledger is kept as its events, the other aggregates as their state: what it buys here (a correction is an entry, the balances are projections) and what it costs (the upcaster, the rebuild) |
| 0004 | a card authorization is answered from a projection of limits, not from the aggregate: two seconds, the issuer's own retry, the settlement that reconciles later |

### 2.6 How it is built

The same path as scheduling, so that the two tooling reports compare: needs, discovery,
contexts, glossary of each context (`CONTEXT.md` first, 80 to 100 terms), the draft map, `init`
with the command above, the contracts and skeletons committed by the conductor (aggregates,
repositories, integration events with their payloads, gateways, policies, the jobs), the
slices (`slices.md`, one row per use case, contracts first), the briefings, one worker per
context in a git worktree, the fixed merge order of the context map, the integration on the
trunk, a green gate, then the real run recorded in `demo-transcript.md`.

Workers: seven, one per context, `identity` being the preset plus its glossary (the smallest
briefing), `expenses` the largest (its three modules may be two workers, as scheduling split
`scheduling` in two). Platform work (the Nest app module with the kit's routes mounted, health
and metrics as native Nest modules, the Kafka consumer group, MinIO, the Keycloak realm with the
roles and the attributes of the demo users) is a worker of its own, first.

Sizes, as a target against scheduling's 32 commands and queries, 25 routes, 14 integration
events: about 45 commands and queries, 35 routes, 18 integration events, 3 process managers,
6 scheduled jobs, 5 background jobs, 8 projections, 6 policies.

The tooling report (`tooling-report.md`) keeps the same sections as scheduling's: headline
numbers, wall clock per phase, generator runs per kind, hand fixes of generated code, frictions
ranked, contradictions, defects of the kit with reproductions, what was not built. Its first
section says what the stack changed against scheduling's, Nest, Prisma and Jest in particular.

### 2.7 Demo and real run

`docker-compose.yml` of the example: PostgreSQL, Valkey, Kafka (KRaft), Keycloak with the realm
of the demo, MinIO, Jaeger, GlitchTip. A script plays the scenario of the transcript with real
tokens: a company is opened, its policy set, a card given; an employee files a report with two
receipts and a mileage line, a card transaction is settled and matched; the manager approves,
finance is needed for the amount; the budget hits 80 percent; the payout run pays the employee;
the SEPA file is read in XML; the ledger shows the entries; the period is exported in CSV and
locked; the audit search shows the operator who read it. A second script simulates the issuer
(authorization and settlement webhooks) and the bank (statuses), since neither can be in the
compose stack. The transcript is the recorded output.

## Part 3: the repository

- `examples/spend-management` joins the npm workspace (`examples/*` already matches); the root
  gains `example:verify:spend-management`, `example:verify` runs both, and the CI job `example`
  becomes one job per example (the Varnish step stays on scheduling; the new one has a Kafka
  and a MinIO step, and the Prisma adapter specs on the PostgreSQL server as scheduling runs
  its Knex ones).
- The conformance suite runs on the second example too, since its rules meet Prisma
  repositories, an explicit module and Nest routes: every rule broken once in a copy, reported
  on the file that breaks it; the Prisma branch of `tenancy/scoped-statement` of 1.2 is proven
  here.
- `examples/README.md` becomes the index of two examples: the table of what each shows, with
  the stack of each side by side, and one request followed through the code of the second
  (a card authorization: the webhook, the anti-corruption layer, the projection, the answer,
  then the settlement and the matching).
- `docs/README.md` and the website list the documents of the second example as they list the
  first; every page in French.
- The release notes (`changes/`) of each pull request of part 1 say what a project gains; the
  example itself is one line.

## What is left out, and why

**MySQL (and SQLite in production).** `init` refuses another database than PostgreSQL with the
four ORMs, and that refusal is kept for this example. PostgreSQL is the database most used with
Prisma and the only one in the automated suites of every adapter
([Persistence, per database](../tools/persistence.md#per-database)); the example on it proves
the stack people actually run. What MySQL would take is not small and is listed so that it is
a decision for a later proposal, not a gap found at `init`: a dialect of the generated
persistence (`ON CONFLICT` to `ON DUPLICATE KEY`, `jsonb` to `json`, one schema per context to
a table prefix or a database, `SKIP LOCKED` on 8.0 only), the stores of the ORM packages on
MySQL 8 in CI where they are run by hand once today, the event store of the kernel
(`packages/kernel/src/infrastructure/event-sourcing/postgres/`) rewritten without partial
indexes and `RETURNING`, the partial unique indexes of the identity preset, the SQL audit trail,
and a second real server in every integration job.

**An HTTP cache.** Nothing in this business is public; a cache per actor is the cache of the
kernel, which the example uses for the rates of the day.

**OpenFGA, SpiceDB.** ABAC is the point; the relationship engines are shown by scheduling and
their page.

**Import of a file.** The chart of accounts could be imported from a CSV, which is exactly the
[file import design](../concepts/file-import-export.md), not built. The example does not build
it; if the design is built later, this is where it would be shown.

**Real integrations.** No real card issuer, bank or accounting software: the anti-corruption
layers are written against the public formats (ISO 8583 fields of an authorization in JSON,
pain.001.001.09, a CSV the common accounting packages read) and the simulators of the demo.

## Decisions to confirm with the owner of the repository

Taken here, to be confirmed or changed before `init` is run; each is one line of `plan.md`:

1. Kafka rather than RabbitMQ (both exist in the kit, Kafka is the more asked for, RabbitMQ is
   in the generated matrix already).
2. Keycloak kept as the provider (the preset and the compose stack know it); a plain OIDC
   provider would show `--authn jwt` but the compose stack has none.
3. Seven contexts, `cards` and `accounting` as contexts and not modules of `expenses` (their
   language and their external systems differ); `notification` written with the generators and
   not waiting for a preset ([Context presets](context-presets.md) says notification is next:
   this example is the second application to write it, which is the material of that preset).
4. The name `spend-management` for the folder, the workspace and the pages.
5. Part 1 as five pull requests in the order 1.1, 1.2, 1.3, 1.4, 1.5 (1.6 with 1.5), each with
   its contract suites and its line of the matrix; part 2 starts when `init --dry-run` with the
   command of 2.3 passes.

## See also

- [Examples](../../examples/README.md): the first example, and how it was built.
- [Context presets](context-presets.md): the identity preset, and notification as the next one.
- [HTTP frameworks](../tools/http-frameworks.md): what framework-agnostic routes cost with Nest.
- [Persistence](../tools/persistence.md): the four ORMs, per database.
- [Authentication and authorization](../concepts/authentication-and-authorization.md): ABAC,
  and why a predicate is not a query.
- [Multitenancy](../concepts/multitenancy.md): the shared table, the outbox with the tenant.

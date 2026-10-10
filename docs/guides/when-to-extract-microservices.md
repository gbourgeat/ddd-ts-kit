# When to extract a microservice, and when not to

**Summary.** Start with a modular monolith: one deployable whose bounded contexts are kept
isolated by rules. Extract a context into its own service only when a measurable signal says
the single deployment is now the problem: an independent scaling need, a conflict of release
cadence, team ownership and cognitive load, the need to isolate a failure or a compliance
scope, or a different technology constraint. Code size, fashion and "it might be needed" are
not signals. Extraction brings costs on its first day (distributed failure, operations, data
consistency, testing, latency, observability), so this guide gives the signals with how to
measure them, a readiness checklist tied to the kit's rules, the extraction steps, and the
conditions under which two services should be merged back.

## Start with a modular monolith

A modular monolith is one process and one deployment in which every bounded context owns its
model and its data and talks to the others only through published contracts. The
[concept page](../concepts/modular-monolith.md) explains it; the argument for starting there
is short:

- **Boundaries are hypotheses at the start.** Moving a boundary inside one repository is a
  refactoring. Moving it between two services is a migration with data, contracts and
  deployments. Fowler's observation ("MonolithFirst") is that successful microservice systems
  mostly grew out of a monolith, and that systems built as microservices from scratch often
  ran into trouble, because the boundaries were drawn before the domain was understood.
- **Microservices carry a premium.** Fowler's "MicroservicePremium": the operational and
  cognitive overhead is paid from the first service, and only pays back above a certain system
  complexity. Below it, a monolith is more productive.
- **The benefits that matter early do not need a network.** Clear ownership, a model per
  context, independent reasoning: all come from the boundary, not from the deployment. Newman
  recommends a modular monolith as a first step for the same reason, and warns that the result
  to avoid is the distributed monolith, which has the costs of both and the benefits of
  neither.

This kit makes the default explicit: a bounded context is a deployable unit in waiting, and
extraction must be a change of composition root and adapters, never of domain or application
code ([architecture reference](../ARCHITECTURE.md#4-tactical-rules), "Extractable contexts").

## Signals that justify extracting a context

Each signal is something you can measure or point to. One strong signal is enough; none means
stay.

| Signal | What you observe | How to measure it | Cheaper answer to try first |
|---|---|---|---|
| **Independent scaling need** | one context's load differs by an order of magnitude from the rest, or has a different shape (bursty, CPU-bound, long-lived connections) | per-context metrics: request rate, CPU, memory, queue depth; the cost of scaling the whole deployable to serve one context | scale the monolith horizontally; move the work to a queue; run the context's consumers or jobs as a dedicated worker of the same codebase |
| **Release cadence conflict** | one context must ship several times a day while another needs a slow, audited release; or one context's failed deploy keeps rolling back the others | deployment frequency and change failure rate per context; hours lost to a shared release train | feature flags; better pipeline; trunk-based development |
| **Team ownership and cognitive load** | several teams commit to one deployable and queue behind each other; no single team can hold the whole in its head | merge queue wait, cross-team review latency, time for a newcomer to make a first change | code ownership per context, which the context map already supports; split the team's scope, not the runtime |
| **Isolation of failure** | a fault in a non-critical context (a memory leak in reporting, a runaway job) takes down booking | incidents where the blast radius exceeded the faulty context | bulkheads and timeouts on the calls; a separate worker process for jobs and consumers |
| **Isolation of compliance scope** | one context handles data under a regime (payment card data, health records) whose audit scope would otherwise cover the whole system | the audit perimeter and its cost; who needs production access to what | a separate database and credentials for that context inside the monolith (often insufficient for auditors) |
| **Different technology constraint** | a context needs another runtime, a library that conflicts, a GPU, a region, or a data store with a different operational profile | a concrete requirement that the current runtime cannot meet | an adapter behind a port calling an external component |

In the scheduling application: `notifications` may send in bursts every morning and depends on
slow external providers, a candidate for failure isolation, first as a worker process and
only then as a service. `analytics` may want a different store and tolerate hours of delay, a
candidate on technology grounds. `appointments` and `calendars` change together and are owned
by one team: extracting them buys nothing.

Notice the third column: several signals have a cheaper answer that keeps one deployable.
A dedicated worker process is the most useful of them, and the kit supports it for scheduled
jobs without leaving the codebase (see [Scheduled jobs](../concepts/scheduled-jobs.md)).

## Signals that do not justify it

| Not a reason | Why |
|---|---|
| **Code size** | a large codebase with good boundaries is navigable; a small one split in ten services is not. Size is a reason to check boundaries, not to deploy them apart |
| **Fashion, or what other companies do** | their constraint was hundreds of engineers; the pattern answers an organisational problem you may not have |
| **"It might be needed later"** | the option is kept cheap by the isolation rules. Paying the cost now for a need that may not come is speculation |
| **"Clean separation"** | the separation is enforced by the checker and the import graph. A network does not enforce design; it only makes violations slower |
| **Slow builds or tests** | fix with test levels, caching and affected-only runs. The fast gates of the pipeline run in seconds |
| **A wish to rewrite in another language** | a technology constraint is a requirement, not a preference |
| **One context is "messy"** | extracting a mess produces a distributed mess. Fix the model first |

## The costs that arrive on day one

None of these is deferred; each starts with the first extracted service.

- **Distributed failure.** A call that could not fail now can time out, fail halfway, or
  succeed without the caller knowing. Every synchronous call needs a timeout, a retry policy
  safe for the operation, and a stated behaviour when the other side is down
  ([Resilience](../concepts/resilience.md)). Availability multiplies: two services at 99.9%
  in a chain give less than either.
- **Operations.** A second pipeline, image, deployment, set of secrets, dashboard, on-call
  runbook; a broker to run where the in-memory bus was enough; versions of the two services
  that must be compatible during every rollout.
- **Data consistency.** No transaction spans the two. What was atomic becomes a process with
  compensation ([Sagas and process managers](../concepts/sagas-and-process-managers.md)), and
  what was a read becomes a projection that lags
  ([Eventual consistency](../concepts/eventual-consistency.md)).
- **Testing.** An end-to-end test now needs both services, a broker and their databases.
  Contract tests between the two become mandatory where a compiler used to check the call.
- **Latency.** An in-process call measured in microseconds becomes a network round trip
  measured in milliseconds, with serialisation at both ends, and a tail that grows with every
  hop.
- **Observability.** A stack trace no longer crosses the boundary. Without distributed tracing
  and a correlation id carried on every call and every event, an incident cannot be followed
  ([Observability](../concepts/observability.md)).
- **Contract evolution.** The published language is now deployed in two places at two moments;
  every change must be backward compatible across a rollout
  ([Event versioning](../concepts/event-versioning.md)).

## Readiness checklist

A context is ready to leave when extraction changes composition and adapters only. The kit's
rules are the checklist; the rule ids link to their statements in the
[architecture reference](../ARCHITECTURE.md#3-dependency-rules).

| Requirement | Held by |
|---|---|
| The context owns its data: its own schema, no foreign key, join or query on another context's tables | `context/extractable`, `context/published-language-only`; review for raw SQL, which the checker does not see |
| No transaction spans two contexts | `context/extractable`; review (a cross-context transaction is in the checker's stated blind spots) |
| Other contexts are reached only through their published language, with a declared relationship and no cycle | `context/published-language-only`, `context/declared-relationship`, `context/no-cycle` |
| Integration events leave through the transactional outbox | `events/outbox-required` |
| Every consumer has a stable, unique name and deduplicates | `events/consumer-idempotent` |
| A synchronous need goes through a port of the caller whose adapter could be remote, with timeout and failure behaviour already decided | `layer/application-inward`; the `gateway` kind; review |
| The context boots alone with the kernel and the platform | the generated `test/architecture/extractable.spec.ts` |
| Adapters are created only in the composition root; no shared mutable state | `composition/only-in-module`, `context/extractable` |
| The actor travels in the message, never as an ambient session | `authz/actor-explicit` |
| Configuration is read through the platform, namespaced by context | review |
| The published language is versioned and its consumers known | the generated event catalog |
| Tracing and the correlation id cross integration events | the traced publisher and subscriber of the tracing package |

Run `npx ddd-ts-kit check --rule context/extractable` and the architecture test. Then add the
checks no tool makes: is there a team to own and operate the service, a deployment target, an
on-call rota, dashboards and alerts for the new failure modes?

## The extraction steps

As the `extract-service` skill drives them:

1. **Generate the entry point.** `npx ddd-ts-kit generate service <context>` writes
   `src/apps/<context>/main.ts` (that context, the kernel and the platform), a start script, a
   compose service and sets `deployable: true` in the config.
2. **Replace in-process gateways by remote adapters.** In the remaining contexts, each
   `gateway` adapter that pointed at the extracted context becomes a remote adapter of the
   same port, held to the same contract suite.
3. **Switch the event provider to a broker on both sides.** Outbox relay on the producer,
   durable subscription on the consumer. Handlers do not change. Choosing the broker:
   [Message brokers](../tools/message-brokers.md).
4. **Move the schema and its migrations.** The others never read it, so nothing else moves.
5. **Decide how the published language is shared.** A versioned package or a shared source
   folder: a contract either way.
6. **Record it.** `docs/context-map.md` and an ADR: what is deployed where, and the new
   failure modes.

Roll out behind the existing interfaces: run the extracted service next to the monolith,
switch one adapter at a time, keep the ability to switch back until the new path has carried
production load. Newman's *Monolith to Microservices* catalogues the patterns for this
(strangler fig, branch by abstraction, parallel run); the gateway port is the abstraction the
branch is made on.

The repository does not start in pieces: the first extraction usually keeps one repository
with two entry points, which is exactly what `src/apps/<context>/main.ts` is. A separate
repository is a later, separate decision.

## When to merge two services back

Extraction is reversible, and reversing it is sometimes the right call. Merge when:

- **they always change and deploy together**: the release independence that justified the
  split never materialised;
- **most requests need a synchronous call between them**: the latency and the failure coupling
  are paid on every request, which says the consistency boundary runs through the middle;
- **a process across the two keeps needing compensation** for what would be one transaction:
  the two are one context (the consistency test of
  [Bounded context](../concepts/bounded-context.md));
- **the team that owned one of them no longer exists**, and one team now runs both;
- **the signal disappeared**: the load evened out, the compliance scope changed, the
  technology constraint was lifted.

Merging back is the extraction in reverse: remote adapters become in-process ones, the broker
may become the in-memory bus again, the entry point goes. It is cheap for the same reason
extraction was: the domain and application code never knew.

## Limits and when not to use it

- **The checks see shapes, not behaviour.** The CLI README lists what
  `context/extractable` misses: a schema name in raw SQL, a cross-context transaction, a
  mutable exported array or object. A green check is necessary, not sufficient; the per-context
  boot test and a review cover part of the gap.
- **The boot test proves wiring, not load.** It shows a context starts alone, not how it
  behaves when its upstream is slow.
- **Extractability has a price inside the monolith too**: no cross-context join, projections
  instead of queries, events instead of calls. For a small system with one team that will
  never split, this is overhead; classify fewer contexts rather than fight the rule.
- **The kit ships no service mesh, no API gateway, no service discovery, no remote adapter
  generator for a specific protocol.** `generate adapter` writes a remote adapter skeleton for
  a port with its resilience policy; the HTTP or RPC client inside is yours.
- **The thresholds are judgment.** "An order of magnitude" and "several teams" are starting
  points; measure your own system.

## Sources

- Martin Fowler, "MonolithFirst" (2015) and "MicroservicePremium" (2015), martinfowler.com.
- Sam Newman, *Building Microservices*, 2nd edition, O'Reilly, 2021, chapters 1 to 3;
  *Monolith to Microservices*, O'Reilly, 2019 (when not to, migration patterns).
- Chris Richardson, *Microservices Patterns*, Manning, 2018, chapters 1 to 4 (decomposition,
  sagas); microservices.io, "Database per service".
- Matthew Skelton and Manuel Pais, *Team Topologies*, IT Revolution, 2019 (cognitive load as a
  boundary criterion).
- Vlad Khononov, *Learning Domain-Driven Design*, O'Reilly, 2021, chapter 14 (microservices
  and bounded contexts).
- Nicole Forsgren, Jez Humble and Gene Kim, *Accelerate*, IT Revolution, 2018 (deployment
  frequency and change failure rate as measures).
- This repository: the skill `extract-service`, the
  [CLI README](../../packages/cli/README.md).

## See also

- [Modular monolith](../concepts/modular-monolith.md)
- [Bounded context](../concepts/bounded-context.md)
- [Transactional outbox](../concepts/transactional-outbox.md)
- [Delivery and idempotency](../concepts/delivery-and-idempotency.md)
- [Message brokers](../tools/message-brokers.md)
- [Team workflow](team-workflow.md)

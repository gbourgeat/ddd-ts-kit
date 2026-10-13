# Documentation

**Summary.** This is the index of the long-form documentation of ddd-ts-kit. Two documents are
normative and short: the [architecture reference](ARCHITECTURE.md) (the canonical tree, the
rule ids, the tactical and clean code conventions, the test levels) and the
[configuration reference](CONFIG.md). Everything else explains and teaches: the concepts
behind the rules, the tool decisions with their comparisons and limits, and guides for working
on such a project as a team and with coding agents. When a page here and the architecture
reference disagree, the reference is right.

## Reference (normative)

| Page | What it holds |
|---|---|
| [Architecture reference](ARCHITECTURE.md) | the canonical tree, every rule id, the tactical rules, tests, clean code |
| [Configuration](CONFIG.md) | every key of `ddd-ts-kit.config.json` |
| [Pipeline](../pipeline/README.md) | the quality gates, the git hooks, GitHub and GitLab side by side |
| Package READMEs under [`packages/`](../packages) | what each package does, its limits and what was verified |

## Concepts: one page per idea

Ordered as a reading path in [concepts/README.md](concepts/README.md).

| Page | In one line |
|---|---|
| [Domain and subdomains](concepts/domain-and-subdomains.md) | core, supporting, generic: how to classify and what it changes |
| [Bounded context](concepts/bounded-context.md) | what a boundary is, and the language, autonomy and consistency tests |
| [Ubiquitous language](concepts/ubiquitous-language.md) | the glossary-first rule and how a glossary is written |
| [Context map](concepts/context-map.md) | the relationship patterns, when each fits and what it costs |
| [Context map: a worked example](concepts/context-map-worked-example.md) | the scheduling application, from a statement of needs to its map |
| [Entities and value objects](concepts/entities-and-value-objects.md) | identity versus value, and primitive obsession |
| [Aggregates](concepts/aggregates.md) | consistency boundary, one transaction, reference by id, sizing |
| [Domain building blocks](concepts/domain-building-blocks.md) | domain event, domain service, repository, factory |
| [Invariants, permissions, validation](concepts/invariants-permissions-validation.md) | three different things in three places |
| [Anemic model](concepts/anemic-model.md) | how to recognise one, and when a thin model is fine |
| [Layers and the dependency rule](concepts/layers-and-dependency-rule.md) | hexagonal, onion, clean: what they share, where they differ |
| [Ports and composition](concepts/ports-and-composition.md) | ports as abstract classes, the composition root, declared or explicit wiring |
| [The presentation layer](concepts/presentation-layer.md) | one controller class per route, route groups, guards at the edge and permissions on the use case, mapper and serializer |
| [CQRS](concepts/cqrs.md) | command and query buses, no event sourcing: what it buys and what it does not |
| [Modular monolith](concepts/modular-monolith.md) | one deployable, contexts kept extractable |
| [Domain and integration events](concepts/domain-and-integration-events.md) | the two kinds of events and the translation between them |
| [Transactional outbox](concepts/transactional-outbox.md) | the dual write problem, the outbox, relay strategies |
| [Delivery and idempotency](concepts/delivery-and-idempotency.md) | at-least-once, idempotent consumers, ordering |
| [Eventual consistency](concepts/eventual-consistency.md) | explained to a product person |
| [Sagas and process managers](concepts/sagas-and-process-managers.md) | long-running processes: what the kit provides and what it does not |
| [Event versioning](concepts/event-versioning.md) | evolving a published event |
| [Authentication and authorization](concepts/authentication-and-authorization.md) | RBAC, ABAC, ReBAC compared, with a decision table |
| [Actor and execution scope](concepts/actor-and-execution-scope.md) | the explicit actor, and what every unit of work carries |
| [Multitenancy](concepts/multitenancy.md) | the tenant from the edge to the storage: isolation strategies, propagation, elevation of platform staff, the proof |
| [Audit trail](concepts/audit-trail.md) | tamper-evident history recorded around the use cases |
| [Observability](concepts/observability.md) | tracing, logs, metrics, error reporting, the correlation id |
| [Resilience](concepts/resilience.md) | retry, timeout, circuit breaker, bulkhead, cache and their failure modes |
| [HTTP caching](concepts/http-caching.md) | what to cache at which layer, cache policies, never a decision of authorization across actors |
| [Scheduled jobs](concepts/scheduled-jobs.md) | jobs that trigger use cases, several instances, idempotence |
| [Clean code](concepts/clean-code.md) | naming, small functions, stepdown, comments, with before and after |
| [Testing strategy](concepts/testing-strategy.md) | fakes versus mocks, builders, contract tests, the four levels |

## Tools: one page per decision

Each page has a comparison table, selection criteria, what the kit supports and verified, the
limits, and a recommendation by situation.

| Page | The decision |
|---|---|
| [HTTP frameworks](tools/http-frameworks.md) | Express, Fastify or NestJS, and what framework-agnostic routes cost with Nest |
| [Validation](tools/validation.md) | zod, class-validator or a Standard Schema library |
| [Dependency injection](tools/dependency-injection.md) | tsyringe with the kit's declarations, NestJS, or manual wiring |
| [Persistence](tools/persistence.md) | Drizzle, Knex, Prisma or TypeORM; PostgreSQL versus others |
| [Message brokers](tools/message-brokers.md) | in-process, RabbitMQ, Kafka, NATS JetStream or Redis Streams |
| [Cache and coordination](tools/cache-and-coordination.md) | Redis, Dragonfly or Valkey; what the lock does and does not guarantee |
| [HTTP caches](tools/http-caches.md) | Varnish, Souin, nginx, Fastly, Cloudflare or Bunny in front of the API: how each purges by tag, what the kit verified |
| [Identity](tools/identity.md) | Keycloak or plain OIDC and JWT |
| [Authorization engines](tools/authorization-engines.md) | in-process models versus OpenFGA, SpiceDB, Cedar, OPA |
| [Observability](tools/observability.md) | OpenTelemetry with Jaeger or Tempo; loggers; Sentry or GlitchTip |
| [Static analysis and pipeline](tools/static-analysis-and-pipeline.md) | the checker, the ESLint plugin, dependency-cruiser, knip, TypeScript 6 and 7; GitHub or GitLab |
| [Quality baseline](tools/quality-baseline.md) | what every project gets and what each tool answers: type check, lint, format, dead code, import graph, architecture check, tests |
| [Test runners](tools/test-runners.md) | Vitest or Jest |
| [Client SDK](tools/client-sdk.md) | openapi-typescript with openapi-fetch, hey-api or orval, measured on the example contract, against the client `ddd-ts-kit sdk` writes: typed error codes, no dependency; how it is checked and published |
| [Import aliases](tools/import-aliases.md) | `@/`, declared once under tsconfig `paths` and rewritten into relative paths by the build; imports without an extension by default, and why the build writes the `.js` Node needs; why not a Node subpath import; what each tool reads |

## Guides

| Page | For |
|---|---|
| [Methodology](guides/methodology.md) | the end-to-end path from a statement of needs to running code, step by step: the supported path |
| [Which command, when](guides/commands.md) | the command or skill for each moment of a project, a first feature from zero, and the reference of every command and flag |
| [Team workflow](guides/team-workflow.md) | ownership per context, the glossary, contracts first, review, decisions, onboarding |
| [Parallel work](guides/parallel-work.md) | several people or agents at once: what is safe, what is sequenced, a concrete plan |
| [Commit discipline](guides/commit-discipline.md) | commit and pull request size, generated files, what hooks and CI enforce |
| [When to extract microservices](guides/when-to-extract-microservices.md) | the signals, the costs, a readiness checklist, the steps, when to merge back |
| [Choosing access control](guides/choosing-access-control.md) | five questions that pick roles, attributes or relationships (Zanzibar), worked presets for each, the combined model of the example, scopes and refusals at the edge |
| [Token economy](guides/token-economy.md) | spending fewer tokens with coding agents, and complementary tools |

## Proposals

| Page | Status |
|---|---|
| [The read side](proposals/read-side.md) | criteria, representations, read models and projections; the page says, part by part, what is built in the runtime packages, what the CLI does not generate yet and what is not built |

## Suggested reading order

**New to DDD.** Follow the reading path of [concepts/README.md](concepts/README.md) in order,
at least sections 1 and 2, then:

1. [Layers and the dependency rule](concepts/layers-and-dependency-rule.md)
2. [Domain and integration events](concepts/domain-and-integration-events.md) and
   [Eventual consistency](concepts/eventual-consistency.md)
3. [Testing strategy](concepts/testing-strategy.md)
4. [Methodology](guides/methodology.md), to see the ideas as steps
5. the [architecture reference](ARCHITECTURE.md), which will now read as a summary

**Tech lead adopting the kit.**

1. the root README and the [architecture reference](ARCHITECTURE.md)
2. [Methodology](guides/methodology.md)
3. the tools pages for the decisions you have to take, starting with
   [Persistence](tools/persistence.md), [Message brokers](tools/message-brokers.md) and
   [Static analysis and pipeline](tools/static-analysis-and-pipeline.md)
4. [Modular monolith](concepts/modular-monolith.md) and
   [When to extract microservices](guides/when-to-extract-microservices.md)
5. [Team workflow](guides/team-workflow.md), [Parallel work](guides/parallel-work.md),
   [Commit discipline](guides/commit-discipline.md)
6. [Token economy](guides/token-economy.md), if the team works with coding agents
7. [Configuration](CONFIG.md)

**Contributor to the kit.**

1. `CONTRIBUTING.md` at the root, then the [architecture reference](ARCHITECTURE.md): a change
   of rule starts there
2. [Ports and composition](concepts/ports-and-composition.md) and
   [Layers and the dependency rule](concepts/layers-and-dependency-rule.md)
3. the README of the package you change, and of the
   [CLI](../packages/cli/README.md) and the
   [ESLint plugin](../packages/eslint-plugin/README.md), which hold the rules
4. [Static analysis and pipeline](tools/static-analysis-and-pipeline.md) and
   [Testing strategy](concepts/testing-strategy.md)
5. the tools page of the area you touch: it states what was verified and what was not, which
   is where a contribution is most useful

## See also

- [Concepts: a reading path](concepts/README.md)
- [Architecture reference](ARCHITECTURE.md)
- [Configuration](CONFIG.md)
- [Pipeline](../pipeline/README.md)

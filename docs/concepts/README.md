# Concepts: a reading path

**Summary.** These pages explain the ideas this kit is built on: Domain-Driven Design
(strategic and tactical), the layered architecture and its dependency rule, messaging and
consistency between bounded contexts, the cross-cutting concerns, clean code and testing. They
teach and give the reasons; the rules themselves are stated once, in the
[architecture reference](../ARCHITECTURE.md), and each page links to them by rule id. Every
page can be read on its own in a few minutes. Read in order, they form a path from "what is a
domain" to "how do I test this", using one example throughout: an appointment scheduling
application.

## The running example

Clients book appointments with practitioners. Five bounded contexts are built, and identity is
bought:

| Context | Classification | Owns |
|---|---|---|
| `appointments` | core | booking, rescheduling and cancellation rules; no practitioner is booked twice |
| `availability` | supporting | the open slots, computed from calendars and booked appointments |
| `calendars` | supporting | the working hours and time off of each practitioner |
| `notifications` | supporting | confirmations and reminders, through email and SMS providers |
| `analytics` | supporting | occupancy and no-show statistics |
| identity | generic | an OpenID Connect provider; no context in the code |

## 1. Strategic design: where the boundaries are

Read these first. They decide everything that follows, and they are decisions of people, not
of tools.

1. [Domain and subdomains](domain-and-subdomains.md): core, supporting, generic, and how to
   classify.
2. [Bounded context](bounded-context.md): what a boundary is and the tests that find one.
3. [Ubiquitous language](ubiquitous-language.md): the glossary, and why it is written before
   the code.
4. [Context map](context-map.md): the relationship patterns between contexts, when each fits
   and what it costs.
5. [Context map: a worked example](context-map-worked-example.md): from a plain statement of
   needs to the map of the scheduling application.

## 2. Tactical design: what is inside a context

6. [Entities and value objects](entities-and-value-objects.md): identity versus value.
7. [Aggregates](aggregates.md): the consistency boundary, one transaction, reference by id,
   sizing.
8. [Domain building blocks](domain-building-blocks.md): domain event, domain service,
   repository, factory.
9. [Invariants, permissions, validation](invariants-permissions-validation.md): three
   different things, three places.
10. [Anemic model](anemic-model.md): how to recognise one, and when a thin model is fine.

## 3. Architecture: how the code is arranged

11. [Layers and the dependency rule](layers-and-dependency-rule.md): hexagonal, onion and
    clean architecture, what they share and where they differ.
12. [Ports and composition](ports-and-composition.md): ports as abstract classes, the
    composition root, declarations by decorators or explicit wiring.
13. [CQRS](cqrs.md): command and query buses as used here, without event sourcing.
    [The presentation layer](presentation-layer.md) comes with it: one controller class per
    route, route groups, guards at the edge and permissions on the use case.
14. [Modular monolith](modular-monolith.md): one deployable, real modules.

## 4. Messaging and consistency: how contexts collaborate

15. [Domain and integration events](domain-and-integration-events.md): the two kinds and what
    separates them.
16. [Transactional outbox](transactional-outbox.md): why publishing straight to a broker loses
    or invents events, and the relay strategies.
17. [Delivery and idempotency](delivery-and-idempotency.md): at-least-once, idempotent
    consumers, the processed-event store, ordering.
18. [Eventual consistency](eventual-consistency.md): explained to a product person.
19. [Sagas and process managers](sagas-and-process-managers.md): what the kit provides and
    what it does not.
20. [Event versioning](event-versioning.md): changing a contract that others consume.

## 5. Cross-cutting concerns: what surrounds the use cases

21. [Authentication and authorization](authentication-and-authorization.md): roles,
    attributes, relationships, with a decision table.
22. [Actor and execution scope](actor-and-execution-scope.md): who acts, explicitly, and what
    every unit of work carries.
23. [Audit trail](audit-trail.md): who did what, recorded from outside the use cases.
24. [Observability](observability.md): tracing, logs, metrics, error reporting, and the
    correlation id that ties them.
25. [Resilience](resilience.md): retry, timeout, circuit breaker, bulkhead, cache, and how
    each one fails.
26. [Scheduled jobs](scheduled-jobs.md): work triggered by time, and why it must be
    idempotent.

## 6. Code and tests

27. [Clean code](clean-code.md): naming, small functions, stepdown, comments, testability by
    construction.
28. [Testing strategy](testing-strategy.md): fakes rather than mocks, builders, contract
    tests, the four levels.

## Shorter paths

- **A product person or a newcomer to DDD:** 1, 2, 3, 5, then 18.
- **Before writing a first use case:** 3, 7, 9, 11, 13, 28.
- **Before making two contexts talk:** 4, 15, 16, 17, 20.
- **Before putting the system in production:** 21, 24, 25, 26, then the
  [tools pages](../README.md#tools-one-page-per-decision).

## Limits and when not to use it

These pages describe one opinionated way of applying the patterns, the one this kit enforces.
Other valid applications exist (event sourcing, a separate read database, aggregates persisted
as documents), and several pages say where the kit stops. The patterns themselves have a cost:
for a small tool with little business logic, most of sections 2 to 4 is more than the problem
needs, and each page has a "Limits and when not to use it" section that says so in its own
terms.

## See also

- [Documentation index](../README.md)
- [Architecture reference](../ARCHITECTURE.md): the normative rules
- [Methodology](../guides/methodology.md): the same ideas as a sequence of steps
- [Configuration](../CONFIG.md)

**English** · [Français](cycle-between-contexts.fr.md)

# A cycle between two contexts

**Summary.** Two contexts that need each other form a cycle, and `context/no-cycle` refuses it.
Refusing the cycle is a choice of this kit, so that every context stays extractable, not a rule
of Domain-Driven Design: Evans describes Partnership, two teams that depend on each other and
coordinate. Merging the two contexts makes the refusal disappear, and often makes one context
too large to hold in mind. Before merging, ask three questions, in this order: one language or
two; can one direction become an event; is a concept missing.

## Why the kit refuses the cycle

The config is directional: a downstream names its upstream, and the generated
[context map](../concepts/context-map.md) draws the arrow. A cycle means that neither context can
be changed, tested or deployed without the other, which is what
[`context/extractable`](../ARCHITECTURE.md#3-dependency-rules) and the
[modular monolith](../concepts/modular-monolith.md) set out to prevent.

Evans does accept mutual dependence, between teams: Partnership, "Institute a process for
coordinated planning of development and joint management of integration" (*Domain-Driven Design
Reference*, 2015). It is a relationship of people, not an arrangement of code. The kit has no
`partnership` value on purpose; two teams in partnership still choose one direction in the code,
and describe their partnership in the written part of the context map.

## Three questions, in this order

### 1. One language, one model?

Read the two glossaries side by side. If the same words mean the same things, and the rules of
one part keep needing the facts of the other in the same transaction, the two are one model:
merge them into one context, and divide it into [modules of the model](../concepts/modules.md)
so that it stays readable. Evans places subdomains in modules of one model (Generic Subdomains:
"place them in separate modules"; Abstract Core: "modules defined by subdomain").

```bash
npx ddd-ts-kit generate module scheduling waitlist --purpose "..."
npx ddd-ts-kit move-to-module scheduling waitlist domain/aggregates/waitlist.aggregate.ts application/commands/join-waitlist
```

If a word changes meaning between them, they are two contexts: go to question 2.

### 2. Otherwise, can one direction become an event?

Usually one direction is a decision and the other a reaction. The context that decides is
upstream and publishes an integration event; the other reacts, and keeps what it needs in a
local projection (Evans, Domain Events: "We keep the aggregates internally consistent at all
times, while making other changes asynchronously"). The import that made the cycle disappears,
replaced by a subscription.

```bash
npx ddd-ts-kit generate integration-event calendars Calendar Closed
npx ddd-ts-kit generate integration-handler scheduling calendars calendars.calendar.closed
```

See [Domain and integration events](../concepts/domain-and-integration-events.md) and
[Eventual consistency](../concepts/eventual-consistency.md): the reaction comes a moment later,
and the business must accept that delay.

### 3. Otherwise, is a concept missing?

When both directions are decisions that need immediate consistency, the two contexts are often
fighting over a concept that belongs to neither: the "overlooked concept" of the Modules pattern
("look for a way to change the model to disentangle the concepts, or an overlooked concept that
might be the basis of a module"). Name it, give it to one context or to a third one, and the
two old contexts become its downstreams.

## What not to do

| Not this | Why |
|---|---|
| merge without question 1 | a context with two languages becomes too large and its glossary contradicts itself |
| declare both upstreams and silence `context/no-cycle` | the two contexts can no longer be extracted, and the deviation hides a design question |
| a shared kernel that grows to hold what both need | the kernel becomes a third context nobody owns |

## Sources

- Eric Evans, *Domain-Driven Design Reference*, Domain Language, 2015: Partnership, Domain
  Events, Modules, Generic Subdomains, Abstract Core.
- Eric Evans, *Domain-Driven Design*, Addison-Wesley, 2003, chapter 14 (Maintaining Model
  Integrity).

## See also

- [Context map](../concepts/context-map.md)
- [Bounded context](../concepts/bounded-context.md)
- [Modules of the model](../concepts/modules.md)
- [A handler with many dependencies](many-dependencies.md)
- [When to extract microservices](when-to-extract-microservices.md)

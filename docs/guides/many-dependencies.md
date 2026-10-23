**English** · [Français](many-dependencies.fr.md)

# A handler with many dependencies

**Summary.** A handler whose constructor takes many ports, repositories and gateways is a smell
that Mark Seemann calls constructor over-injection: a sign, not a fault. The kit sets no limit on
the number, because no reference gives one and a number invites facades made only to silence it.
This guide is an order of diagnosis instead: read what each dependency does, and every remedy
already has its place in the canonical tree. Dividing the context into
[modules of the model](../concepts/modules.md) does not help here: a handler keeps its
dependencies whatever folder it sits in.

## A smell, not a rule

Seemann treats the number of constructor arguments as guidance: "This is only guidance", and
"There could be cases where it's genuinely valid to have dozens of dependencies" ("On
Constructor Over-injection", 2018). The root cause, when there is one, is usually a violation of
the single responsibility principle: the handler does more than one thing. Counting would treat
the symptom; the question is what the dependencies do.

## Diagnose, in this order

Read the constructor, then each dependency in turn, and ask what the handler does with it.

| What the dependencies do | Remedy | Where |
|---|---|---|
| Logging, caching, rights, retries | a decorator or a chain of responsibility: "better addressed with Decorators or the Chain of Responsibility pattern" (Seemann) | the middlewares of the buses, the decorators of the adapters ([cross-cutting concerns](../concepts/observability.md), [resilience](../concepts/resilience.md)) |
| Effects that follow the decision (notify, index, recompute) | a domain event and its handler (Evans, Domain Events: "We keep the aggregates internally consistent at all times, while making other changes asynchronously") | `application/event-handlers/` ([domain and integration events](../concepts/domain-and-integration-events.md)) |
| Reads of another context | a local projection fed by its integration events (Evans, Domain Events) | `application/projections/` |
| Steps spread over time | a process manager (Hohpe and Woolf, *Enterprise Integration Patterns*, 2003) | `application/processes/` ([sagas and process managers](../concepts/sagas-and-process-managers.md)) |
| Reads that together form one concept | one port named in the ubiquitous language, whose adapter composes the sources: a Facade Service, when the arguments "fall in two or more natural clusters" (Seemann, "Refactoring to Aggregate Services", 2010) | `application/ports/` ([ports and composition](../concepts/ports-and-composition.md)) |
| A decision over several aggregates | a domain service, stateless and without I/O (Evans, Services: "Give the service a name, which also becomes part of the ubiquitous language") | `domain/services/` ([domain building blocks](../concepts/domain-building-blocks.md)) |
| Still too many | the handler does two things: split the use case (single responsibility) | two use cases, each with its permission |

A facade that groups dependencies without naming a concept of the language is not a remedy: it
moves the constructor elsewhere and hides the second responsibility. A port earns its place when
its name is a term of the glossary.

## What the kit does not add

| Not added | Why |
|---|---|
| a rule with a maximum of dependencies | Seemann: "only guidance". A number would be met by fake facades |
| an `application/services/` role | the six places above cover every case, and a shared application service tends to become the place where everything else goes |

`clean/function-size` does not count the parameters of a constructor: a constructor lists the
dependencies it is given, which is wiring, and this guide is where their number is read.

## In a review

The `architecture-reviewer` agent walks the table above for a constructor with many
dependencies and names the remedy that applies, with the place it goes. It never counts.

## Sources

- Mark Seemann, "On Constructor Over-injection", 2018, blog.ploeh.dk.
- Mark Seemann, "Refactoring to Aggregate Services", 2010, blog.ploeh.dk.
- Eric Evans, *Domain-Driven Design Reference*, Domain Language, 2015: Services, Domain Events.
- Gregor Hohpe and Bobby Woolf, *Enterprise Integration Patterns*, Addison-Wesley, 2003
  (Process Manager).

## See also

- [A cycle between two contexts](cycle-between-contexts.md)
- [Modules of the model](../concepts/modules.md)
- [Domain building blocks](../concepts/domain-building-blocks.md)
- [Ports and composition](../concepts/ports-and-composition.md)
- [Architecture reference](../ARCHITECTURE.md)

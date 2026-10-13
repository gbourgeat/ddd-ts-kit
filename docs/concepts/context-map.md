**English** · [Français](context-map.fr.md)

# Context map

**Summary.** A context map is the picture of how bounded contexts relate: who depends on whom
(upstream and downstream), and under which arrangement. The arrangement has a name, one of a
small set of relationship patterns, and each name states who adapts to whom and what that
costs. In this kit the map is not a drawing kept beside the code: relationships are declared in
`ddd-ts-kit.config.json`, an import between contexts is refused without a declared
relationship, and `docs/context-map.md` is generated from the declarations.

## Upstream and downstream

When context B needs something from context A, A is **upstream** and B is **downstream**:
changes flow down. The upstream can break the downstream by changing; the reverse is not true.
The pattern says how that power is handled.

In the kit, the downstream names its upstream and the pattern:

```json
"availability": {
  "classification": "supporting",
  "upstreams": [
    { "context": "calendars", "relationship": "published-language" },
    { "context": "appointments", "relationship": "published-language" }
  ]
}
```

## The patterns

| Pattern | Who adapts | Fits when | Costs |
|---|---|---|---|
| Published language | upstream designs a contract made for consumers | the default between contexts of one product | the upstream must version and keep its contract stable |
| Customer-supplier | upstream plans the downstream's needs into its backlog | two teams, one organisation, the downstream has a say | negotiation and planning on both sides |
| Conformist | downstream takes the upstream model as is | the upstream will not adapt, and its model is good enough | the downstream's model follows every upstream change |
| Anticorruption layer | downstream translates at its edge | the upstream model is foreign, legacy or unstable | a translator to write, test and maintain |
| Open host service | upstream offers one protocol for many consumers | many downstreams, none special | a public API to govern; no consumer gets a custom fit |
| Shared kernel | two contexts co-own a small model | a concept is truly identical and changes together | joint ownership: neither side changes it alone |
| Partnership | two teams coordinate, succeed or fail together | two contexts that must evolve in step for a while | constant coordination; no clear upstream |
| Separate ways | nobody adapts: no integration | the cost of integrating exceeds the benefit | duplication, and no shared data |

![The eight relationship patterns drawn as pairs of contexts: published language, a versioned contract between upstream and downstream; customer-supplier, the needs of the downstream flow back into the plan of the upstream; conformist, the downstream reuses the upstream model; anticorruption layer, a translator at the edge of the downstream; open host service, one protocol for many downstreams; shared kernel, a small model owned by two contexts; partnership, two contexts coordinated with no upstream; separate ways, no integration at all](../assets/diagrams/context-map-patterns.svg)

### Published language

The upstream publishes a documented, versioned contract: event types, payload types, read
contracts. It is the default in this kit and the only code another context may import: the
upstream's `published-language/` folder. Integration events are declared there once, with a
schema ([Domain and integration events](domain-and-integration-events.md)). In the example,
`appointments` publishes `appointments.appointment.booked`, and `availability` and
`notifications` consume it without knowing the `Appointment` aggregate.

### Customer-supplier

The downstream is a customer whose needs are planned by the supplier. It suits two teams of the
same organisation with aligned priorities. It costs meetings: the downstream must state its
needs early, the upstream must not ship a breaking change unannounced. If `notifications` needs
the client's preferred channel in the booked event, a customer-supplier relationship means the
`appointments` team schedules that addition.

### Conformist

The downstream gives up translating and uses the upstream's model directly. It is cheap and
honest when the downstream has no model worth protecting. `analytics` is conformist towards
`appointments`: it stores the events as they come, and when a payload gains a field, analytics
gains a column. The cost is that the downstream cannot resist an upstream change, so use it
only where that is acceptable.

### Anticorruption layer

The downstream protects its model with a translator. In the kit it lives in
`infrastructure/anti-corruption/` and is generated with `generate acl`. `notifications` uses
one towards the email and SMS provider: the provider speaks of "messages", "templates" and
delivery statuses of its own, and none of those words enter the glossary of notifications. The
cost is real code, and it grows with the upstream's surface: translate only what is used.

A translator takes what the provider sends, in its names and codes, and answers a value of the
downstream's model; nothing of the provider's vocabulary goes past it:

<!-- checked sample -->
```ts
// notifications/infrastructure/anti-corruption/sms-provider.translator.ts

/** A delivery report exactly as the provider sends it: its names, its statuses. */
export interface SmsProviderReport {
  readonly message_sid: string;
  readonly status: 'queued' | 'sent' | 'delivered' | 'undelivered' | 'failed';
  readonly error?: 'invalid_destination' | 'blocked_by_carrier' | 'unknown';
}

/** What notifications calls it, in its glossary: the outcome of a reminder. */
export type ReminderOutcome =
  | { readonly kind: 'on-its-way' }
  | { readonly kind: 'reached' }
  | { readonly kind: 'unreachable'; readonly because: 'wrong-number' | 'refused' | 'unknown' };

export class SmsProviderTranslator {
  translate(report: SmsProviderReport): ReminderOutcome {
    switch (report.status) {
      case 'queued':
      case 'sent':
        return { kind: 'on-its-way' };
      case 'delivered':
        return { kind: 'reached' };
      case 'undelivered':
      case 'failed':
        return { kind: 'unreachable', because: this.reasonOf(report.error) };
    }
  }

  private reasonOf(error: SmsProviderReport['error']): 'wrong-number' | 'refused' | 'unknown' {
    if (error === 'invalid_destination') {
      return 'wrong-number';
    }

    return error === 'blocked_by_carrier' ? 'refused' : 'unknown';
  }
}
```

`generate acl notifications sms-provider` writes this class, empty, with `TODO(domain)` markers,
and a spec whose `it.todo` entries ask for real samples received from the provider.

### Open host service

The upstream defines a protocol open to all who need it, instead of one integration per
consumer. It is usually paired with a published language, which is the protocol's vocabulary.
The identity provider of the example behaves this way: OpenID Connect is its open protocol, and
every application conforms to it.

### Shared kernel

Two contexts share a small part of the model, in code. In the kit that is `src/shared-kernel/`,
which holds only what at least two contexts use. A `TimeSlot` value object could live there if
`appointments` and `availability` truly mean the same thing by it. It is the most coupling of
all the patterns: every change needs both owners, so the kernel must stay small, and a kernel
that keeps growing is a signal that a boundary is wrong.

### Partnership and separate ways

Evans describes two more. **Partnership**: two teams with mutual dependence coordinate their
planning and integrate continuously; neither is upstream. **Separate ways**: the contexts are
not integrated at all, and each solves its need alone.

## What the kit's config accepts

Six values, for `contexts.<name>.upstreams[].relationship` ([CONFIG.md](../CONFIG.md)):

`published-language` (default), `customer-supplier`, `conformist`, `anti-corruption-layer`,
`open-host-service`, `shared-kernel`.

Said plainly:

- **Separate ways has no value** because it is the absence of a declared relationship. Two
  contexts with no `upstreams` entry between them cannot import each other
  (`context/declared-relationship`), which is exactly that pattern.
- **Partnership is not modelled.** The config is directional (a downstream names an upstream)
  and `context/no-cycle` refuses mutual dependence. Two contexts in partnership must still
  choose a direction in the config, or express one direction as an event, and describe the
  partnership in the written part of the context map. The tool has no notion of it.
- The value is a **label with one mechanical effect**: it authorises the import of the
  upstream's published language and appears on the arrow of the generated diagram. The kit does
  not enforce the behaviour a pattern implies. Declaring `anti-corruption-layer` does not check
  that a translator exists; declaring `customer-supplier` does not create a planning meeting.
  The label documents the arrangement; people keep it true.

Whatever the pattern, the mechanics between two contexts are the same in this kit: imports only
from `published-language/` (`context/published-language-only`), integration events for
collaboration, and for a synchronous need a port in the caller with a gateway adapter.

![What a downstream context may import from its upstream: availability imports the published-language folder of appointments, which the config declares as a published-language relationship; an import of the domain, application or infrastructure of appointments is refused by context/published-language-only, and any import without a declared relationship by context/declared-relationship](../assets/diagrams/context-map-imports.svg)

Instead of reaching into the model of the upstream:

```ts
// src/contexts/availability/application/...
import { Appointment } from '@/contexts/appointments/domain/aggregates/appointment.aggregate';
// context/published-language-only: the aggregate of appointments is now frozen by availability
```

import what the upstream published for its consumers, and nothing else:

```ts
// src/contexts/availability/application/...
import { appointmentBookedV1, type AppointmentBookedV1 } from '@/contexts/appointments/published-language/index';
```

For a synchronous need, the downstream declares a port in its own words, and a gateway adapter
calls the read contract the upstream publishes. Today the call is in process; when the upstream
runs as its own service, only the adapter changes. `generate gateway availability calendars
OpeningTimes` writes the three files below (plus a fake and a contract suite), and names the
upstream contract after the gateway:

<!-- checked sample -->
```ts
import { Gateway } from '@ddd-ts-kit/kernel/declarations';

// calendars/published-language/opening-times.contract.ts: what calendars offers to read
export interface WorkingInterval {
  readonly startsAt: string;
  readonly endsAt: string;
}

export abstract class OpeningTimesContract {
  abstract ofPractitioner(practitionerId: string, day: string): Promise<readonly WorkingInterval[]>;
}

// availability/application/ports/opening-times-gateway.port.ts: what availability needs, in its words
export abstract class OpeningTimesGateway {
  abstract openOn(practitionerId: string, day: string): Promise<readonly { readonly from: Date; readonly to: Date }[]>;
}

// availability/infrastructure/external/in-process-opening-times.gateway.ts: the only class that
// knows the contract of calendars
@Gateway(OpeningTimesGateway)
export class InProcessOpeningTimesGateway implements OpeningTimesGateway {
  constructor(private readonly calendars: OpeningTimesContract) {}

  async openOn(practitionerId: string, day: string): Promise<readonly { readonly from: Date; readonly to: Date }[]> {
    const intervals = await this.calendars.ofPractitioner(practitionerId, day);

    return intervals.map((interval) => ({ from: new Date(interval.startsAt), to: new Date(interval.endsAt) }));
  }
}
```

## Choosing

![Choosing a pattern: if the two contexts do not need each other, separate ways, declare nothing; if the concept is identical and changes together, a small shared kernel; if you control or influence the upstream, published language within one product or customer-supplier with another team that plans with you; otherwise conformist when the upstream model is acceptable inside yours, and an anticorruption layer when it is not](../assets/diagrams/context-map-choosing.svg)

An upstream serving many consumers adds an open host service on its side. The choice is the
project owner's, and each pattern other than the default deserves a sentence of justification
in the map and often a decision record.

## The generated map

`npx ddd-ts-kit docs` regenerates `docs/context-map.md` between
`<!-- ddd-ts-kit:context-map -->` markers:

- a Mermaid diagram: one node per context styled by classification, one arrow per relationship
  from upstream to downstream, labelled with the pattern;
- a table of contexts: the first sentence of each purpose, upstreams, downstreams, published
  events, and whether the context is deployable alone.

Text outside the markers is kept. The `document` skill says what to write there, and only when
it is true: a reading guide for the main business flow, why the debated boundaries were drawn
where they are, why each non-default pattern was chosen and what it costs, and the known
tensions with the signal that would trigger a split or a merge. `docs --check` fails in CI when
the generated part is stale, so the map cannot drift from the config.

## Limits and when not to use it

- **The map shows declared relationships, not real coupling.** Two contexts that share
  assumptions through a database convention, or duplicated logic, are coupled without an arrow.
- **External systems are not nodes of the generated map.** Only contexts of the config appear.
  An identity provider or a payment service is described in the written part and in
  `docs/integration/README.md`.
- **Pattern names are social contracts.** As said above, the kit enforces the import rule and
  the absence of cycles, nothing about how teams behave.
- **A map of one context is empty**, and that is fine: do not split a model to have something
  to draw.
- **Shared kernel is easy to abuse** as a way around boundaries. Nothing constrains what the
  shared kernel imports (CLI README, Limits); review it.

## Sources

- Eric Evans, *Domain-Driven Design*, Addison-Wesley, 2003, chapter 14 "Maintaining Model
  Integrity" (context map and the relationship patterns).
- Eric Evans, *Domain-Driven Design Reference*, 2015, section "Context Mapping for Strategic
  Design" (adds partnership), domainlanguage.com/ddd/reference.
- Vaughn Vernon, *Implementing Domain-Driven Design*, Addison-Wesley, 2013, chapter 3 "Context
  Maps".
- Vlad Khononov, *Learning Domain-Driven Design*, O'Reilly, 2021, chapter 4 "Integrating
  Bounded Contexts" (cooperation, customer-supplier and separate ways groups).

## See also

- [A worked example: the context map of the scheduling application](context-map-worked-example.md)
- [Bounded context](bounded-context.md)
- [Domain and subdomains](domain-and-subdomains.md)
- [Domain and integration events](domain-and-integration-events.md)
- [Event versioning](event-versioning.md)
- [Team workflow](../guides/team-workflow.md)
- [Configuration reference](../CONFIG.md)
- [Concepts index](README.md)

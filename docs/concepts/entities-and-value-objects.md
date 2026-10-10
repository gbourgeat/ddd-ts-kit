# Entities and value objects

**Summary.** The domain model is made of two kinds of objects. An entity has an identity that
persists while its attributes change: an appointment stays the same appointment when it is
rescheduled. A value object has no identity: it is defined entirely by its attributes, it is
immutable, and two of them with the same attributes are interchangeable, like a time slot or a
cancellation reason. Most concepts should be value objects; entities are the few things whose
continuity the business tracks. In this kit both have a private constructor and factories,
entities change only through methods named after a business intention, and value objects never
change at all.

## Telling them apart

Ask the domain expert: "if every attribute were the same, would these still be two different
things?"

| | Entity | Value object |
|---|---|---|
| Identity | has one, stable over time | none |
| Equality | by identifier | by attributes (`equals`) |
| Mutability | changes state through intention methods | immutable; an operation returns a new instance |
| Lifecycle | created, changed, sometimes ended; stored and loaded | created when needed, discarded freely |
| Example | `Appointment`, `Calendar`, a `TimeOff` entry inside a calendar | `TimeSlot`, `CancellationReason`, `WorkingHours`, an email address |

Two appointments for the same client, practitioner and slot would still be two appointments
(and a bug the invariant must prevent): entity. Two `TimeSlot`s from 09:00 to 09:30 on the same
day are the same slot: value object.

The same concept can be an entity in one context and a value in another. A practitioner is an
entity where profiles are managed; in `appointments` it is only a `practitionerId`.

## Value objects

A value object gathers a concept that would otherwise be scattered as primitives, together with
the rules that make it valid and the operations that belong to it.

```ts
// contexts/appointments/domain/value-objects/time-slot.vo.ts
import { ValueObject, err, ok, type Result } from '@ddd-ts-kit/kernel';
import { InvalidTimeSlot } from '../errors/invalid-time-slot.error.js';

export type TimeSlotProps = {
  readonly startsAt: Date;
  readonly endsAt: Date;
};

export class TimeSlot extends ValueObject<TimeSlotProps> {
  private constructor(props: TimeSlotProps) {
    super(props);
  }

  static create(startsAt: Date, endsAt: Date): Result<TimeSlot, InvalidTimeSlot> {
    if (endsAt.getTime() <= startsAt.getTime()) {
      return err(new InvalidTimeSlot());
    }

    return ok(new TimeSlot({ startsAt, endsAt }));
  }

  overlaps(other: TimeSlot): boolean {
    return this.startsAt < other.endsAt && other.startsAt < this.endsAt;
  }

  startsWithin(durationMs: number, now: Date): boolean {
    return this.startsAt.getTime() - now.getTime() < durationMs;
  }

  get startsAt(): Date {
    return this.props.startsAt;
  }

  get endsAt(): Date {
    return this.props.endsAt;
  }
}
```

What the shape gives:

- **Valid by construction.** The constructor is private and `create` checks the rules, so a
  `TimeSlot` that exists is a valid one. Code that receives a `TimeSlot` never re-validates.
- **Immutable.** Properties are readonly and no method assigns to the object
  (`domain/value-object-immutability`). It can be shared and passed around without defensive
  copies.
- **Behaviour next to data.** `overlaps` is written once, on the type it concerns, instead of
  being repeated wherever two pairs of dates meet.
- **No hidden clock.** `startsWithin` receives `now`; the domain never reads the system time
  (`purity/no-system-clock`).

### Primitive obsession

The architecture reference calls it a defect: an email, an amount, a period are types
([ARCHITECTURE.md](../ARCHITECTURE.md), section 4). The symptom is a signature such as
`book(practitionerId: string, clientId: string, start: Date, end: Date)`: two strings that can
be swapped unnoticed, two dates whose order nothing guarantees. Candidates for a value object:

- anything with a **format or a range** (email, phone number, duration, percentage);
- anything that is **two values that travel together** (start and end, amount and currency);
- anything with a **closed set of values** (a status, a channel);
- **identifiers of other aggregates**, when confusing them would be costly.

The generator's own templates remind it: state is declared "with value objects, not
primitives".

## Entities

An entity is defined by a thread of continuity. Its class protects that thread:

```ts
// contexts/calendars/domain/entities/time-off.entity.ts
import { Entity } from '@ddd-ts-kit/kernel';
import type { Period } from '../value-objects/period.vo.js';

export interface TimeOffState {
  readonly period: Period;
  readonly reason: string;
}

export class TimeOff extends Entity<string> {
  private constructor(
    id: string,
    private state: TimeOffState,
  ) {
    super(id);
  }

  static create(id: string, state: TimeOffState): TimeOff {
    return new TimeOff(id, state);
  }

  static rehydrate(id: string, state: TimeOffState): TimeOff {
    return new TimeOff(id, state);
  }

  shortenTo(period: Period): void {
    this.state = { ...this.state, period };
  }

  covers(period: Period): boolean {
    return this.state.period.overlaps(period);
  }

  toState(): TimeOffState {
    return { ...this.state };
  }
}
```

- **Private constructor, two factories.** `create` is birth and checks the invariants the
  entity guards on its own; `rehydrate` is loading from storage and checks nothing, because the
  stored state was valid when it was saved.
- **No setter, no public mutable property** (`domain/aggregate-encapsulation`). State is
  replaced by a method whose name the business would recognise: `shortenTo`, not `setPeriod`.
- **Identity is given, not generated inside.** The identifier comes from the `IdGenerator` port
  through the application layer (`purity/no-ambient-randomness`), which keeps tests
  deterministic.
- **State is made of value objects.** The entity carries identity and lifecycle; the values
  carry validity.

An entity is either the root of an [aggregate](aggregates.md) (`Appointment`, `Calendar`) or
lives inside one (`TimeOff` inside `Calendar`). An inner entity is reached and changed only
through its root, has no repository of its own, and its identity only needs to be unique
within the aggregate.

```bash
npx ddd-ts-kit generate value-object appointments TimeSlot
npx ddd-ts-kit generate entity calendars TimeOff
```

Each command writes the file and its spec, with `TODO(domain)` markers where a business
decision is expected.

## Choosing: prefer values

Model a concept as a value object unless the business needs to track it over time. Values are
cheaper in every way: no identity to manage, no lifecycle, no concurrency, trivially testable.
A frequent mistake is to give an identity to something because it has a database row. Storage
is the mapper's concern; a value object can be stored in columns of its owner's table, or in a
table of its own with a technical key the domain never sees.

| Question | If yes |
|---|---|
| Does the business refer to "that one" over time, even after it changed? | entity |
| Could it be replaced by an equal one without anyone noticing? | value object |
| Does it have a lifecycle with states? | entity |
| Is it a measure, a description, a quantity, a range? | value object |

## Limits and when not to use it

- **Not every string deserves a type.** A free-text note with no rule and no operation gains
  nothing from a wrapper class. Wrap what has validity rules, behaviour, or a real risk of
  confusion.
- **`Result` or throw.** The generated value object returns a `Result` from `create`; an
  aggregate method typically throws a `DomainError`. Both are accepted by the reference
  ("exceptions or `Result`"); choose one convention per context and keep to it.
- **Immutability is checked syntactically.** `domain/value-object-immutability` sees readonly
  properties and writes to `this`; it does not see a mutable object held in a readonly field
  (a `Date` can still be mutated through its methods, an array can be pushed to). Hold values
  that are themselves immutable, or copy on the way in and out.
- **Encapsulation rules belong to the ESLint plugin**, which reads the syntax tree; the
  text-level CLI checker has no equivalent for `domain/*` (CLI README).
- **A thin CRUD context** may have entities with few rules. That is acceptable where the
  subdomain is simple; see [Anemic model](anemic-model.md).

## Sources

- Eric Evans, *Domain-Driven Design*, Addison-Wesley, 2003, chapter 5 "A Model Expressed in
  Software" (entities, value objects, services).
- Vaughn Vernon, *Implementing Domain-Driven Design*, Addison-Wesley, 2013, chapter 5
  "Entities" and chapter 6 "Value Objects".
- Vlad Khononov, *Learning Domain-Driven Design*, O'Reilly, 2021, chapter 6 "Tackling Complex
  Business Logic".
- Martin Fowler, *Patterns of Enterprise Application Architecture*, Addison-Wesley, 2002,
  "Value Object"; and "ValueObject", martinfowler.com/bliki/ValueObject.html.

## See also

- [Aggregates](aggregates.md)
- [Domain events, domain services, repositories and factories](domain-building-blocks.md)
- [Invariants, permissions and validation](invariants-permissions-validation.md)
- [Anemic model](anemic-model.md)
- [Ubiquitous language](ubiquitous-language.md)
- [Clean code](clean-code.md)
- [Architecture reference](../ARCHITECTURE.md)
- [Concepts index](README.md)

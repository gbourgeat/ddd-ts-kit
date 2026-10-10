# Anemic model

**Summary.** An anemic domain model has the classes of a domain model and none of its
behaviour: objects that only hold data, with the business rules written elsewhere, in handlers
and services that read and assign their fields. It looks like object-oriented design and works
like procedures over records, with the cost of both. The harm is that rules get duplicated,
skipped by new entry points, and lost to the reader. This page shows how to recognise it, a
before and after on the appointment example, what the kit's rules do and do not catch, and when
a thin model is the right choice.

## What it looks like

```ts
// BEFORE: a data holder, and the rules in the handler
export class Appointment {
  id!: string;
  practitionerId!: string;
  clientId!: string;
  startsAt!: Date;
  endsAt!: Date;
  status!: 'booked' | 'cancelled';
  cancelledAt?: Date;
  cancellationReason?: string;
}

export class CancelAppointmentHandler {
  async execute(command: CancelAppointment): Promise<void> {
    const appointment = await this.appointments.findById(command.appointmentId);
    if (!appointment) {
      throw new Error('Appointment not found');
    }

    if (appointment.status === 'cancelled') {
      throw new Error('Already cancelled');
    }
    if (appointment.startsAt.getTime() - Date.now() < 24 * 60 * 60 * 1000) {
      throw new Error('Too late to cancel');
    }

    appointment.status = 'cancelled';
    appointment.cancelledAt = new Date();
    appointment.cancellationReason = command.reason;

    await this.appointments.save(appointment);
    await this.events.publish({ type: 'appointment-cancelled', id: appointment.id });
  }
}
```

Everything a domain expert would call a rule is in the handler. The consequences:

- The rescheduling handler needs the "not cancelled" check too, and will have its own copy, or
  forget it.
- A reminder job, an import script or a test can set `status = 'cancelled'` without any check
  and without `cancelledAt`: the type allows a cancelled appointment with no cancellation date.
- The 24-hour rule reads the system clock, so its test needs to fake time globally.
- The errors are generic: a caller cannot tell "already cancelled" from "too late" except by
  message text.
- Nothing in the code says "cancel". The business verb exists only as a handler's file name.

## The same use case with the behaviour in the model

```ts
// AFTER: the aggregate decides
export class Appointment extends AggregateRoot<string> {
  /* private constructor, book, rehydrate: see the Aggregates page */

  cancel(reason: CancellationReason, at: Date): void {
    this.assertNotCancelled();
    this.assertCancellationStillFree(at);
    this.state = { ...this.state, status: 'cancelled' };
    this.record(new AppointmentCancelled(this.id, at, reason));
  }

  private assertNotCancelled(): void {
    if (this.state.status === 'cancelled') {
      throw new AppointmentAlreadyCancelled();
    }
  }

  private assertCancellationStillFree(at: Date): void {
    if (this.state.slot.startsWithin(FREE_CANCELLATION_MS, at)) {
      throw new CancellationWindowPassed();
    }
  }
}

export class CancelAppointmentHandler implements CommandHandler<CancelAppointment> {
  constructor(
    private readonly appointments: AppointmentRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: CancelAppointment): Promise<void> {
    const appointment = await this.appointments.findById(command.appointmentId);
    if (appointment === undefined) {
      throw new AppointmentNotFound(command.appointmentId);
    }

    appointment.cancel(command.reason, this.clock.now());

    await this.appointments.save(appointment);
  }
}
```

The handler loads, calls one intention, saves. It has no `if` on business state. The rules are
in one place, apply to every caller, are named, raise specific errors with stable codes, and
are tested without a database, a clock or a bus:

```ts
given(anAppointment().cancelled())
  .when((appointment) => appointment.reschedule(anotherSlot, at))
  .thenError(AppointmentAlreadyCancelled);
```

## How to recognise it

A design review of a context looks for the smells below. The first two are the anemic model
itself; the others usually travel with it.

| Smell | How to spot it |
|---|---|
| anemic aggregate | public setters, or methods that only assign; rules in handlers |
| fat handler | branches on domain state, loops over entities, computes amounts |
| primitive obsession | `string` or `number` for emails, money, periods, statuses, identifiers of other aggregates |
| invalid states representable | optional fields that are mandatory together, a status plus nullable dates |
| generic errors | `throw new Error(...)` for a business failure, or one error class for many cases |
| cross-aggregate transaction | a handler saving two aggregates |
| leaking persistence | ORM entities or rows returned through a repository interface |
| DTO reuse | a presentation schema imported by application or domain, or a response returning a domain object |

Quick questions for a review:

1. Read the aggregate's public methods aloud. Are they business verbs (`cancel`,
   `reschedule`), or `setStatus`, `update`, `changeX`? A method that only assigns its argument
   is a setter with a longer name.
2. Open a handler. Does it contain `if` or `switch` on the aggregate's state? Each one is a
   rule living in the wrong layer.
3. Search for the same condition in two handlers.
4. Count domain specs against handler specs. A context whose rules are all tested through
   handlers with fakes, and whose aggregates have almost no spec, keeps its rules in handlers.
5. Could a test build the aggregate in a state the business calls impossible?

## What the kit's rules catch, and what they do not

| Rule | Catches |
|---|---|
| `domain/aggregate-encapsulation` | a public constructor, a public mutable property, a setter on an aggregate or entity |
| `domain/value-object-immutability` | a value object that can change |
| `domain/no-generic-error` | `throw new Error(...)` in `domain/` or `application/` |
| `language/no-technical-name`, `language/glossary-term` | `AppointmentManager`, names outside the glossary |
| `purity/no-system-clock` | `Date.now()` or `new Date()` in a handler or an aggregate |
| `clean/no-flag-argument` | a boolean parameter standing for two intentions |
| `application/handler-shape` | a handler class with more than `execute` |
| `test/spec-required`, `test/builder-required` | an aggregate without a spec or a builder |

The rule table is in [ARCHITECTURE.md](../ARCHITECTURE.md), section 3. Together they make the
"before" code above fail in several places. They do **not** make a model rich:

- A method `changeStatus(status)` passes every rule and is still a setter.
- A handler full of `if (appointment.isCancelled)` passes every rule: the checker does not
  count business branches in handlers.
- A spec file that exists and holds only `it.todo` passes `test/spec-required`, which checks
  the file and not its content (CLI README, Limits).

The rules remove the mechanical forms of anemia. The judgement, "is this decision in the right
place?", belongs to a reviewer: the `architecture-reviewer` agent of the plugin
is written for it, and so is a human review focused on the domain layer
([Team workflow](../guides/team-workflow.md)).

## From anemic to rich, one move at a time

1. Pick one rule in one handler. Write the domain spec first: given a state, when the
   intention, then the event or the error.
2. Add the intention method on the aggregate and move the condition into it. Name the refusal
   with `generate domain-error`.
3. Replace the handler's branches by the single call. Its spec gets shorter: happy path, each
   error code, nothing saved or published on failure.
4. Remove the setter or public property the handler was using. The compiler lists the other
   callers; each is a rule that was also living outside.
5. Replace the primitives the rule manipulated by a value object (`TimeSlot` instead of two
   dates) when the same comparison appears twice.

Do it per use case, in small commits, not as a rewrite.

## When a thin model is fine

Fowler calls the anemic model an anti-pattern for a domain model. He does not say that every
part of every system needs a domain model, and neither does this kit.

- **Supporting and generic contexts** often have little to decide. A `calendars` context where
  `SetWorkingHours` replaces a list of valid intervals is mostly validated data. Its aggregate
  will have a few methods that check a value object and assign. That is a simple model that
  matches a simple subdomain, not a defect
  ([Domain and subdomains](domain-and-subdomains.md)).
- **Read sides** are thin by design: a query handler returns the shape a port declares, with no
  aggregate at all ([CQRS](cqrs.md)).
- **Pure CRUD** over reference data can stay CRUD. Khononov describes simpler patterns
  (transaction script, active record) as the right fit for subdomains whose logic is simple.

The test is not "how many methods does the aggregate have" but "are there business rules, and
if so, where are they?". A thin aggregate in a context with no rules is honest. A thin
aggregate next to a 200-line handler is the anti-pattern.

What stays required in every context of this kit, thin or not: the canonical tree, the
encapsulation rules, named errors, tests. A thin model costs little under those rules because
the generator writes the structure.

## Limits and when not to use it

- **A rich model is not a goal in itself.** Moving trivial assignments behind ceremonial
  methods adds reading without adding protection. Enrich where a rule exists.
- **Do not push orchestration into aggregates** in the name of richness. Loading other
  aggregates, calling ports and publishing are the handler's job; an aggregate that receives a
  repository has swapped one problem for another.
- **Do not push access rules in either.** "Only the client who booked may cancel" is a policy
  of the application layer
  ([Invariants, permissions and validation](invariants-permissions-validation.md)).
- **Some logic fits no single aggregate.** That is what a domain service is for
  ([Domain building blocks](domain-building-blocks.md)); it becomes a problem only when
  services hold most of the rules.

## Sources

- Martin Fowler, "AnemicDomainModel", 2003, martinfowler.com/bliki/AnemicDomainModel.html.
- Eric Evans, *Domain-Driven Design*, Addison-Wesley, 2003, chapter 4 "Isolating the Domain"
  (the smart UI and layered alternatives) and chapter 5.
- Vaughn Vernon, *Implementing Domain-Driven Design*, Addison-Wesley, 2013, chapter 1 (anemia
  and memory loss) and chapter 10.
- Vlad Khononov, *Learning Domain-Driven Design*, O'Reilly, 2021, chapter 5 "Implementing
  Simple Business Logic" and chapter 6 "Tackling Complex Business Logic".
- Robert C. Martin, *Clean Code*, Prentice Hall, 2008, chapter 6 "Objects and Data Structures".
- Repository: `plugin/agents/architecture-reviewer.md` (what a review judges beyond the checks).

## See also

- [Aggregates](aggregates.md)
- [Entities and value objects](entities-and-value-objects.md)
- [Domain events, domain services, repositories and factories](domain-building-blocks.md)
- [Invariants, permissions and validation](invariants-permissions-validation.md)
- [Domain and subdomains](domain-and-subdomains.md)
- [Clean code](clean-code.md)
- [Testing strategy](testing-strategy.md)
- [Team workflow](../guides/team-workflow.md)
- [Architecture reference](../ARCHITECTURE.md)
- [Concepts index](README.md)

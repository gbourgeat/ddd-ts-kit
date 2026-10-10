# Clean code as applied here

**Summary.** The kit applies a small, enforceable subset of Robert C. Martin's Clean Code to
TypeScript: names taken from the ubiquitous language, small functions that do one thing, files
that read top to bottom (the stepdown rule), one concept per file, comments only for what the
code cannot say, no escape hatch around the type system, and code that is testable by
construction because time, identifiers and I/O come through ports. Each convention has a rule
id, a reason and a fix; this page shows what they look like on real code, before and after, and
what a tool cannot judge. The normative text is
[section 6 of the architecture reference](../ARCHITECTURE.md#6-clean-code).

## Why these rules, and why enforced

Code is read far more often than it is written, and in a project where coding agents write
much of it, it is read by people who did not write it. Conventions that depend on goodwill
erode at the first deadline. The kit therefore turns each one into a check with a `fix`
sentence (`npx ddd-ts-kit explain <rule-id>` gives the reason and an example), so a recurring
review comment becomes a failing check and reviewers keep their attention for design.

## Names come from the language

A name is either a word of the context's glossary or a word that names an architectural role
outside the domain (`AppointmentRepository`, `BookAppointmentHandler`). Rules
`language/glossary-term` and `language/no-technical-name`.

Before:

```ts
export class AppointmentManager {
  updateStatus(data: AppointmentData, status: string, flag: boolean): void { /* ... */ }
}
```

After:

```ts
export class Appointment extends AggregateRoot {
  cancel(reason: CancellationReason, at: Date): void { /* ... */ }

  reschedule(slot: TimeSlot, at: Date): void { /* ... */ }
}
```

What changed: `Manager` and `Data` said nothing and are refused in the domain; `updateStatus`
was a setter in disguise, replaced by what the business says happens; the `string` status and
the boolean became types and intentions. If the word you need is not in the glossary, the
concept is not understood yet: add the term with its meaning first, or ask. See
[Ubiquitous language](ubiquitous-language.md).

Smaller habits with large effects: one word per concept in a context (not `fetch` here and
`retrieve` there), a boolean reads as a predicate (`isCancelled`), a collection is a plural.

## Small functions, one thing, one level of abstraction

A function has at most three parameters and stays short (rule `clean/function-size`, limits
30 lines by default, configurable under `limits`, never more than 100). More parameters are a
concept that deserves a type. A comment announcing a "step" inside a function marks a function
waiting to be extracted, with a name that replaces the comment.

Before:

```ts
cancel(reason: string, at: Date, byPractitioner: boolean): void {
  // check state
  if (this.status === 'cancelled') {
    throw new Error('already cancelled');
  }
  // check window
  const hours = (this.slot.startsAt.getTime() - at.getTime()) / 3_600_000;
  if (!byPractitioner && hours < 24) {
    throw new Error('too late');
  }
  this.status = 'cancelled';
  this.cancelledAt = at;
}
```

After:

```ts
cancel(reason: CancellationReason, at: Date): void {
  this.assertNotCancelled();
  this.assertWithinCancellationWindow(at);

  this.status = AppointmentStatus.cancelled(reason, at);
  this.record(new AppointmentCancelled(this.id, reason, at));
}

private assertNotCancelled(): void {
  if (this.status.isCancelled) {
    throw new AppointmentAlreadyCancelled(this.id);
  }
}

private assertWithinCancellationWindow(at: Date): void {
  if (!this.slot.startsAfter(at, CANCELLATION_NOTICE)) {
    throw new CancellationWindowPassed(this.id);
  }
}
```

Four rules met at once:

- `clean/no-flag-argument`: the boolean `byPractitioner` meant two intentions in one method.
  Who cancels is a question of rights, answered by a policy before the aggregate is called
  ([Invariants, permissions and validation](invariants-permissions-validation.md)); if the
  business truly has two behaviours, they are two methods.
- `domain/no-generic-error`: a business failure is a specific `DomainError` with a stable
  code, not `new Error('too late')`.
- `clean/no-noise-comment`: `// check state` restated the code; the extracted name says it.
- Command or query, never both: `cancel` changes state and returns nothing.

Guard clauses come first and the happy path stays unindented; there is no `else` after a
`return` or a `throw`.

## The stepdown rule

A file reads like a newspaper article: the intention at the top, the details below. In a class:
static factories, then public methods, then private methods, each private method placed after
its first caller. In a module: the exported function first, its helpers after it in the order
they are called. Rule `clean/stepdown`.

```ts
export class Appointment extends AggregateRoot {
  static book(...)                          // 1. factories
  static rehydrate(...)
  reschedule(slot: TimeSlot, at: Date)      // 2. public intentions
  cancel(reason: CancellationReason, at: Date)
  private assertNotCancelled()              // 3. each helper below its first caller
  private assertWithinCancellationWindow(at: Date)
}
```

The payoff is in reading: opening the file answers "what can an appointment do" in the first
screen, and a reader stops as soon as they know enough. It also makes files predictable for a
tool or an agent that reads only the top of a file.

## One concept per file

One exported class, interface or function per file, named after it, in the directory of its
role with the suffix of its role: `appointment.aggregate.ts`, `time-slot.vo.ts`,
`book-appointment.handler.ts`. Rules `naming/suffix`, `naming/one-concept-per-file` and
`clean/one-export-per-file`: the only companions of the exported concept are the types of its
own signature and small closed families, anything else is listed in `onePerFile.allow` of the
config with its reason, and an index file only re-exports. A file past 350 lines, tests
included, holds more than one responsibility (`clean/file-size`).

The reason is navigation. The path of a concept is derivable from its name, so nobody searches
for it; a diff touches the files of one concept; two people rarely edit the same file. See
[Token economy](../guides/token-economy.md) for what this is worth with coding agents.

## Layout

A blank line before every `return` that is not alone in its block and between the logical
blocks of a function; no blank line padding the edges of a block (`clean/blank-lines`; the
text-level checker holds the `return` and the padded block, ESLint the blank lines between
statements, with an automatic fix). Class members are `private`, never `#name`
(`clean/no-hash-private`): one way to hide a member, the one the compiler checks.

Every `if`, `else`, `for`, `while` and `do` has braces, and its body is on its own lines
(`clean/braces`): a branch is visible at a glance, and a statement added to it later cannot
silently fall outside it. A ternary and an arrow function returning an expression stay as they
are.

```ts
// refused
if (wrapped.has(repository)) return repository;

// required
if (wrapped.has(repository)) {
  return repository;
}
```

Everything else about where a token goes is decided by the formatter, Biome, at a line width of
120 (`clean/formatted`): `npm run format` writes it, `npm run format:check` holds it before a
commit and in the pipeline. See the [quality baseline](../tools/quality-baseline.md).

## Comments

The default is none: the code says what. A comment is kept for what the code cannot say.

| Keep | Example |
|---|---|
| why a non-obvious choice was made | `// Notice is counted in clock hours, not business hours: decided with support, ADR-0004` |
| a warning about a consequence | `// Order matters: the outbox append must share the transaction of the save` |
| an external reference | a law, an RFC, a vendor quirk with its link |
| the contract of a public API or a port | what a method guarantees, its units, the error it raises |

Delete: paraphrases of the next line, banners and section dividers, closing-brace labels,
change history, author names, a `@param id the id`, and commented-out code (version control
remembers). Rules `clean/no-noise-comment` and `clean/no-commented-out-code`. Generated files
carry only `TODO(domain)` and `TODO(platform)` markers, each stating the decision expected.

## No escape hatch

`strict` TypeScript, no `any` (use `unknown` and narrow), no non-null assertion, no type
assertion outside mappers and infrastructure, no suppressed diagnostic without a written
reason. Rule `clean/no-escape-hatch`. Each of these silences the compiler exactly where it was
about to say something. Model alternatives as discriminated unions so a `switch` is exhaustive,
and make invalid states unrepresentable instead of validating them later:

```ts
// before: a cancelled appointment without a reason is representable
interface AppointmentState { status: 'booked' | 'cancelled'; cancelledAt?: Date; reason?: string }

// after: it is not
type AppointmentStatus =
  | { kind: 'booked' }
  | { kind: 'cancelled'; at: Date; reason: CancellationReason };
```

A suppression is a deviation: it names its rule, gives a reason and points to a decision
record (rule `governance/recorded-deviation`).

## Testable by construction

Domain and application code is pure with respect to the outside world. Time comes from the
`Clock` port, identifiers from the `IdGenerator` port, every I/O from a port, dependencies by
constructor. Rules `purity/no-system-clock`, `purity/no-ambient-randomness`,
`purity/no-environment`.

Before:

```ts
async execute(command: BookAppointment): Promise<string> {
  const id = crypto.randomUUID();
  const appointment = Appointment.book(id, command.clientId, command.slot, new Date());
  if (process.env.SMS_ENABLED === 'true') {
    await sendSms(command.clientId, 'Booked');
  }
  await this.appointments.save(appointment);
  return id;
}
```

After:

```ts
async execute(command: BookAppointment): Promise<string> {
  const appointment = Appointment.book(this.ids.next(), command.clientId, command.slot, this.clock.now());

  await this.appointments.save(appointment);

  return appointment.id;
}
```

The first version cannot be tested without mocking a module, a global and the environment, and
its result differs at every run. The second takes a fixed clock and sequential identifiers in
a spec and asserts exact values. The SMS left the handler altogether: confirming a booking is
a reaction of the `notifications` context to `appointments.appointment.booked`. Note that the
aggregate receives the instant as an argument; aggregates do not hold a clock.

A class that needs a mock of a module to be tested is breaking one of these rules. That is the
link between this page and [Testing strategy](testing-strategy.md).

## What the tools cannot see

The checks are deliberately mechanical, and their limits are documented in the
[CLI README](../../packages/cli/README.md) and the
[ESLint plugin README](../../packages/eslint-plugin/README.md):

- **A good name.** The glossary rule matches word by word with a crude English inflection. It
  knows no synonym and cannot tell that `process` is vague when the glossary happens to define
  "process".
- **One thing.** A function of twenty lines can still do three things; size is a proxy.
- **A useful comment.** The comment rules are heuristics on the shape of a line: prose ending
  like a statement can be flagged, code written as a sentence is missed.
- **Purity through a wrapper.** The purity rules look for the listed tokens and modules; a
  helper that hides `Date.now()` in an allowed place goes unseen.
- **Arrow functions and nested functions** are not judged by the text-level checker for order,
  size and flag arguments; the ESLint plugin, which reads the syntax tree, is the authority
  when the two disagree.
- **Whether the model is right.** An anemic aggregate with perfectly ordered, well-sized
  methods passes every clean code rule ([Anemic model](anemic-model.md)).

Design review exists for that remainder.

## Limits and when not to use it

- **Rules are a floor, not a definition of quality.** Passing them proves the absence of a
  list of known defects.
- **Small functions can be overdone.** Extracting every two lines scatters a simple algorithm
  across a file; extract when a name adds information.
- **Limits are configurable for a reason.** A project may raise them deliberately, with a
  decision record; raising them to get to green is the defect.
- **Some code is legitimately different.** Mappers and infrastructure adapters need type
  assertions, and files under a `generated/` directory are exempt from the file size rule. The
  rules already carve these out.
- **Throwaway code.** A spike meant to be deleted does not need this discipline; the trouble
  is only that spikes are rarely deleted. `ddd-ts-kit check --clean-only` runs the file-level
  rules on any directory, without a project, to measure the gap before adopting.

## Sources

- Robert C. Martin, Clean Code, Prentice Hall, 2008: chapters 2 (Meaningful Names), 3
  (Functions, including the stepdown rule and flag arguments), 4 (Comments), 7 (Error
  Handling), 10 (Classes).
- Robert C. Martin, Clean Architecture, Prentice Hall, 2017.
- Eric Evans, Domain-Driven Design, Addison-Wesley, 2003: Ubiquitous Language,
  Intention-Revealing Interfaces, Side-Effect-Free Functions.
- Bertrand Meyer, Object-Oriented Software Construction, 2nd edition, Prentice Hall, 1997:
  command-query separation.
- Martin Fowler, Refactoring, 2nd edition, Addison-Wesley, 2018: Extract Function, Replace
  Primitive with Object, Remove Flag Argument.
- Yaron Minsky, "Effective ML" (2010): the phrase "make illegal states unrepresentable".

## See also

- [Ubiquitous language](ubiquitous-language.md)
- [Entities and value objects](entities-and-value-objects.md)
- [Anemic model](anemic-model.md)
- [Testing strategy](testing-strategy.md)
- [Static analysis and pipeline](../tools/static-analysis-and-pipeline.md)
- [Token economy](../guides/token-economy.md)
- [Architecture reference](../ARCHITECTURE.md): section 6, rules `clean/*`, `purity/*`,
  `language/*`, `naming/*`

---
name: clean-code
description: >-
  Clean Code rules of a ddd-ts-kit project for TypeScript under src/contexts. Business
  naming from the ubiquitous language, small single-purpose functions, stepdown ordering of
  a file, comments only for what code cannot say, no escape hatches, testability by
  construction (Clock, IdGenerator, ports). Use when a clean/*, purity/* or language/* rule
  is reported, or when the user asks to clean, simplify, rename or make code more readable.
  To define a missing business term use glossary.
allowed-tools:
  - Read
  - Edit
  - Bash(npx ddd-ts-kit check *)
  - Bash(npx ddd-ts-kit explain *)
  - Bash(npm run lint *)
---

# Clean code

The checker holds these rules (`npx ddd-ts-kit check`); this skill says how to satisfy them
without fighting them. Reference: `docs/ARCHITECTURE.md` section 6.

## Names

- Take the word from the context's glossary (`CONTEXT.md`). If it is not there, the concept
  is not understood yet: add the term with its meaning first, or ask.
- Class: a noun of the domain. Method: what the business says happens (`order.cancel(reason)`),
  never `setStatus`, `update`, `process`, `handle`, `manage`, `doX`.
- No `Manager`, `Helper`, `Util`, `Data`, `Info`, `Processor`, `Wrapper`, `Impl`, `Base`,
  `Abstract`, `Dto`, `Entity`, `Model` in a name of the domain or of a use case
  (`language/no-technical-name`). A technical suffix is allowed only where it names the architectural role outside the
  domain (`OrderRepository`, `PlaceOrderHandler`).
- One word per concept in a context: not `fetch` here and `retrieve` there.
- A boolean reads as a predicate (`isOverdue`), a collection as a plural, a function that
  answers as a question, a function that acts as a verb.
- A refusal reads as a sentence: `throw AppointmentError.slotTaken(calendar.id, slot.startsAt)`,
  a static factory of the error class of the concept, whose code says the same words
  (`SLOT_TAKEN`). Never `new SomethingError(...)`, never a factory named `create` or `of`
  (`errors/through-factory`, `errors/factory-name`). Add one with
  `npx ddd-ts-kit generate error <context> <Concept> <refusal>`.

## Functions

- One thing, one level of abstraction. If a blank line separates "steps", each step is a
  function whose name replaces the comment you were about to write.
- Three parameters at most. More means a missing value object or command.
- No boolean parameter: `publish(draft)` and `schedule(draft, date)`, not `publish(draft, true)`.
- Either changes state or returns an answer.
- Guard clauses first, happy path unindented. No `else` after a `return` or `throw`.

## Order of a file: stepdown

Read top to bottom like an article: what, then how.

```ts
export class Invoice extends AggregateRoot {
  static issue(...)            // 1. factories
  static rehydrate(...)
  pay(payment: Payment)        // 2. public intentions, most important first
  cancel(reason: Reason)
  private assertPayable()      // 3. each private helper below its first caller
  private remainingAmount()
}
```

In a module: the exported function first, then its helpers in call order. Constants and types
a reader needs to understand the first function go above it; everything else below.

## Comments

Default: none. Clear code with good names is the documentation. Write a comment only when it
carries what the code cannot:

| Keep | Example |
|---|---|
| why a non-obvious choice | `// Rounded per line, not on the total: required by the tax authority (art. 242)` |
| a warning | `// Order matters: the outbox append must share the transaction of the save` |
| an external reference | RFC, law, vendor bug link |
| the contract of a public API or port | what a method guarantees, units, error raised |

Delete: paraphrases of the next line, banners, section dividers, closing-brace labels,
change history, author, commented-out code, `@param id the id`. If a block needs a comment to
say what it does, extract it and name it.

## Testable by construction

- Time: inject `Clock`, never `new Date()` or `Date.now()` in domain or application. Pass
  `clock.now()` into the aggregate method; aggregates do not hold a clock.
- Identifiers: `IdGenerator`.
- Anything outside the process: a port in `application/ports/`, with a fake.
- Dependencies by constructor, as ports (abstract classes). No singleton import, no static
  state, no `process.env` outside `src/platform/config/`.

## Files and layout

One exported class, interface or function per file, named after it in kebab-case; at most
350 lines. Members are `private`, never `#name`. A blank line before a `return` that is not
alone in its block and around `if`, `for`, `try`. Every `if`, `else`, `for`, `while` and `do`
has braces and its body on its own lines, never `if (a) return b;`: a branch is visible at a
glance, and a statement added to it later cannot silently fall outside it. `npm run lint:fix`
then `npm run format` (Biome, line width 120) settle layout: do not spend tokens on it.

## Types

No `any` (use `unknown` and narrow), no `!`, no `as` outside mappers, no `@ts-ignore`. Model
alternatives as discriminated unions so that `switch` is exhaustive. Make invalid states
unrepresentable instead of validating them later.

## When a rule is reported

Fix the code, not the rule. Suppressing (`// ddd-ts-kit-disable-next-line <rule> -- reason`),
lowering a severity or raising a limit needs the owner's explicit agreement and a decision
record: skill `ddd-ts-kit:deviation`.

---
paths:
  - "{{config.contextsDir}}/*/domain/**"
  - "{{config.sharedKernelDir}}/**"
---

# Domain layer

- Imports only its own `domain/`, the shared kernel and `@ddd-ts-kit/kernel` (`layer/domain-purity`): no framework, no decorator, no validation library, no `node:` module.
- Names come from the glossary of `CONTEXT.md`, written first (`language/glossary-term`); no `Manager`, `Helper`, `Data`, `Info`, `Model` (`language/no-technical-name`).
- Aggregate: private constructor, `create` for birth, `rehydrate` for loading, state changed by methods named after the business intention, no setter, no public mutable property (`domain/aggregate-encapsulation`). One aggregate per transaction; another one is referenced by its id.
- Value objects are immutable, validated in `create`, compared with `equals` (`domain/value-object-immutability`). An email, an amount, a period are types, not strings.
{{#if literals.named}}
- A closed list of values (a status, a kind, a role of the model) is a vocabulary, `npx ddd-ts-kit generate vocabulary <context> <Name> --value <value>...`: code reads `AppointmentStatus.NoShow`, never the string (`language/declared-vocabulary`).
- No number without a name: 0, 1, -1 and an index only; a duration, a limit or a rate is a constant of the module (`const MINUTES_PER_HOUR = 60;`) or a value object (`clean/no-magic-number`).
{{/if}}
{{#if refusals.factories}}
- A violated invariant throws a refusal built by a static factory of the error class of its concept, never `new` and never a bare `Error`: `throw InvoiceError.alreadyIssued(this.id)` (`errors/through-factory`, `domain/no-generic-error`). One class per concept of the glossary in `domain/errors/`, extending `ConceptError`, no constructor (`errors/constructor-not-public`); a factory is named after the refusal and its code says the same words (`errors/factory-name`), one code per refusal of the context (`errors/code-unique`).
- A factory takes the facts of the refusal as typed parameters and gives them to `refusal(code, message, facts)`. Facts are private: one reaches a client only when the factory names it, `.exposing('<fact>')`, and never when it identifies a person.
{{/if}}
{{#if refusals.classes}}
- A violated invariant throws a `DomainError` of `domain/errors/` with a stable `code`, never a bare `Error` (`domain/no-generic-error`).
{{/if}}
{{#if valueObjects.throwing}}
- A value object refuses in `create` as the rest of the domain does: it returns the value object or throws the refusal of the concept it describes{{#if refusals.factories}} (`throw PersonError.invalidEmail(raw)`){{/if}}. The caller takes the value as it is, with no `unwrap`; a spec asserts the refusal with `expectRefusal(() => Email.create(raw), 'INVALID_EMAIL')`.
{{/if}}
{{#if valueObjects.result}}
- A value object returns its refusals in the `Result` of `create`{{#if refusals.factories}}: `err(PersonError.invalidEmail(raw))`{{/if}}; the caller unwraps it with `unwrap(..)` of the kernel. `npx ddd-ts-kit value-objects` moves the project to factories that throw.
{{/if}}
- Domain events are named in the past tense, `<context>.<aggregate>.<fact>` (`events/name-format`), and recorded by the aggregate (`this.record(...)`). They leave with the save: nothing here dispatches them.
- A repository here is a port: an abstract class extending the kernel `Repository<Aggregate>`, abstract members only (`ports/abstract-class`). A domain service is stateless.
- Time and identifiers come in as parameters (`purity/*`); nothing here knows the acting user or its rights (`authz/in-application`).
- One concept per file, with the suffix of its role: `.aggregate.ts`, `.entity.ts`, `.vo.ts`, `.vocabulary.ts`, `.event.ts`, `.error.ts`, `.repository.ts`, `.service.ts` (`naming/suffix`, `naming/one-concept-per-file`).
{{#if refusals.factories}}
- The language first, with `/ddd-ts-kit:glossary`. Then create with `npx ddd-ts-kit generate aggregate|entity|value-object|vocabulary|domain-event|domain-service|repository ... --json`, a refusal with `npx ddd-ts-kit generate error <context> <Concept> <refusal> --json` (it adds the factory to the class of the concept, and its case to the spec), and fill the `TODO(domain)` places it lists.
{{/if}}
{{#if refusals.classes}}
- The language first, with `/ddd-ts-kit:glossary`. Then create with `npx ddd-ts-kit generate aggregate|entity|value-object|vocabulary|domain-event|domain-error|domain-service|repository ... --json` and fill the `TODO(domain)` places it lists.
{{/if}}

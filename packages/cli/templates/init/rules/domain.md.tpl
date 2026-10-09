---
paths:
  - "{{config.contextsDir}}/*/domain/**"
  - "{{config.sharedKernelDir}}/**"
---

# Domain layer

- Imports only its own `domain/`, the shared kernel and `@ddd-ts-kit/kernel` (`layer/domain-purity`). No framework, no decorator, no validation library, no `node:` module.
- Aggregate: private constructor, `create` for birth, `rehydrate` for loading. State changes through methods named after the business intention, never setters or public mutable properties (`domain/aggregate-encapsulation`).
- One aggregate per transaction; another aggregate is referenced by its id.
- A violated invariant throws a `DomainError` of `domain/errors/` with a stable `code`, never a bare `Error` (`domain/no-generic-error`).
- Names come from the glossary of `CONTEXT.md` (`language/glossary-term`); time and identifiers come in as parameters (`purity/*`).
- Value objects are immutable (`domain/value-object-immutability`), validated in `create`, compared with `equals`. An email, an amount, a period are types, not strings.
- Domain events are named in the past tense, `<context>.<aggregate>.<fact>` (`events/name-format`), and recorded by the aggregate.
- Repositories here are interfaces only; a domain service is stateless.
- One concept per file (`naming/one-concept-per-file`), suffixes `.aggregate.ts`, `.entity.ts`, `.vo.ts`, `.event.ts`, `.error.ts`, `.repository.ts`, `.service.ts`.
- Model with `/ddd-ts-kit:model-context`; scaffold with `npx ddd-ts-kit generate aggregate|entity|value-object|domain-event|domain-error|domain-service|repository`.

---
paths:
  - "src/contexts/*/domain/**"
  - "src/shared-kernel/**"
---

# Domain layer

- Imports only its own `domain/`, the shared kernel and `@ddd-ts-kit/kernel` (`layer/domain-purity`): no framework, no decorator, no validation library, no `node:` module.
- Names come from the glossary of `CONTEXT.md`, written first (`language/glossary-term`); no `Manager`, `Helper`, `Data`, `Info`, `Model` (`language/no-technical-name`).
- Aggregate: private constructor, `create` for birth, `rehydrate` for loading, state changed by methods named after the business intention, no setter, no public mutable property (`domain/aggregate-encapsulation`). One aggregate per transaction; another one is referenced by its id.
- Value objects are immutable, validated in `create`, compared with `equals` (`domain/value-object-immutability`). An email, an amount, a period are types, not strings.
- A violated invariant throws a `DomainError` of `domain/errors/` with a stable `code`, never a bare `Error` (`domain/no-generic-error`).
- Domain events are named in the past tense, `<context>.<aggregate>.<fact>` (`events/name-format`), and recorded by the aggregate (`this.record(...)`). They leave with the save: nothing here dispatches them.
- A repository here is a port: an abstract class extending the kernel `Repository<Aggregate>`, abstract members only (`ports/abstract-class`). A domain service is stateless.
- Time and identifiers come in as parameters (`purity/*`); nothing here knows the acting user or its rights (`authz/in-application`).
- One concept per file, with the suffix of its role: `.aggregate.ts`, `.entity.ts`, `.vo.ts`, `.event.ts`, `.error.ts`, `.repository.ts`, `.service.ts` (`naming/suffix`, `naming/one-concept-per-file`).
- The language first, with `/ddd-ts-kit:glossary`. Then create with `npx ddd-ts-kit generate aggregate|entity|value-object|domain-event|domain-error|domain-service|repository ... --json` and fill the `TODO(domain)` places it lists.

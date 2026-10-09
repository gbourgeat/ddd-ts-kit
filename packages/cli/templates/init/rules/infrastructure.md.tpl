---
paths:
  - "{{config.contextsDir}}/*/infrastructure/**"
  - "{{config.contextsDir}}/*/*.module.ts"
  - "{{config.platformDir}}/**"
  - "{{config.sourceRoot}}/main.ts"
---

# Infrastructure and composition

- An adapter implements a port of `application/ports/` or a repository interface of `domain/repositories/`. It never imports `presentation/` (`layer/infrastructure-no-presentation`).
- `persistence/` holds repository adapters and mappers, `external/` the adapters of outside systems, `anti-corruption/` the translators of another model.
- A mapper is the only place where a type assertion is acceptable; nothing of the storage schema leaks into the domain.
- Infrastructure faults are plain errors (they become a 5xx); business refusals are `DomainError`s raised by the domain.
- No shared tables between contexts.
- Adapters are instantiated and bound to their port in `<context>.module.ts` only (`composition/only-in-module`); platform-wide providers in `{{config.platformDir}}/platform.module.ts`.
- Tracing wraps adapters and handlers at registration; never import tracing in `domain/` or `application/`. Spans carry class, method, context and an error code, never arguments or messages.
- Every adapter passes the same contract suite as the fake of its port (`test/integration/*.contract.spec.ts`).
- Persistence with `/ddd-ts-kit:persistence`; scaffold with `npx ddd-ts-kit generate repository|acl`.

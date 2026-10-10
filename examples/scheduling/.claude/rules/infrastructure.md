---
paths:
  - "src/contexts/*/infrastructure/**"
---

# Infrastructure layer

- An adapter `implements` a port of `application/ports/` or a repository port of `domain/repositories/`, and never `extends` it (`ports/implements-never-extends`). It never imports `presentation/` (`layer/infrastructure-no-presentation`).
- `persistence/` holds repository adapters, mappers and rows, `external/` the adapters of outside systems, `anti-corruption/` the translators of another model.
- Rows never leave `persistence/`: a mapper translates to and from the aggregate, and is the only place for a type assertion (`clean/no-escape-hatch`).
- Own tables, in the schema of the context: no join, foreign key or transaction across contexts (`context/extractable`).
- Audit columns and the tenant column are stamped from the execution scope with the kernel helpers (`stampCreation`, `stampUpdate`, `tenantScopeOf`), never handed over by a use case.
- An adapter declares itself on its class, one per file (`declarations/role-declared`): `@Repository(InvoiceRepository, [KnexContext, ExecutionScope, Clock])`, `@Gateway(Port, [Ports])` or `@Adapter(Port, { kind }, [Ports])`.
- Retry, timeout and cache go on the declaration (`aspects: [ownPolicy(retry(...), timeout(...))]`) or, when the policy is part of what the adapter is, as decorators of `@ddd-ts-kit/aspects/decorators` (`aspects/outside-in`). Kinds `external` and `gateway` get the default policy of the platform otherwise.
- A repository only persists: no `pullEvents()`, no dispatcher (`domain-events/dispatched-on-save`). A removal that announces an event takes the aggregate, not its id.
- Infrastructure faults are plain errors (a 5xx, reported from outside); business refusals are `DomainError`s raised by the domain.
- Every adapter passes the contract suite of the fake of its port (`test/integration/*.contract.spec.ts`).
- Method: `/ddd-ts-kit:persistence`. Create with `npx ddd-ts-kit generate repository|adapter|gateway|acl ... --json`.

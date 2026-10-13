---
paths:
  - "{{config.contextsDir}}/*/infrastructure/**"
---

# Infrastructure layer

- An adapter `implements` a port of `application/ports/` or a repository port of `domain/repositories/`, and never `extends` it (`ports/implements-never-extends`). It never imports `presentation/` (`layer/infrastructure-no-presentation`).
- `persistence/` holds repository adapters, mappers and rows, `external/` the adapters of outside systems, `anti-corruption/` the translators of another model.
- Rows never leave `persistence/`: a mapper translates to and from the aggregate, and is the only place for a type assertion (`clean/no-escape-hatch`).
- The content of a file never goes in a table: no binary or base64 column (`persistence/no-file-content`). The file lives in the `FileStorage` port; a row keeps the key, size, media type and checksum of its `StoredFile`.
- Own tables, in the schema of the context: no join, foreign key or transaction across contexts (`context/extractable`).
- Audit columns and the tenant column are stamped from the execution scope with the kernel helpers (`stampCreation`, `stampUpdate`, `tenantScopeOf`), never handed over by a use case.
{{#if tenancy.any}}
- Tenant data is reached through the helpers of the ORM package, never straight from the executor: {{#if orm.knex}}`tenantTable` to read, `ownTenantTable` to update or delete{{/if}}{{#if orm.drizzle}}`tenantCondition` in the condition of a read, `ownTenantCondition` in that of an update or a delete{{/if}}, the tenant named on every insert (`tenancy/scoped-statement`). A table of no tenant is a recorded deviation. See `docs/concepts/multitenancy.md` of the kit.
{{/if}}
{{#if style.declared}}
- An adapter declares itself on its class, one per file (`declarations/role-declared`): `@Repository(InvoiceRepository)`, `@Gateway(Port)` or `@Adapter(Port, { kind })`. What it is given is what its constructor takes, each parameter typed by one class (`{{persistence.tokenOrNone}}`, `ExecutionScope`, `Clock`, a port, an abstract class the platform binds to a value) and nothing listed in the decorator (`declarations/constructor-injection`); an adapter that extends a class of a package writes its own constructor.
- Retry, timeout and cache go on the declaration (`aspects: [ownPolicy(retry(...), timeout(...))]`) or, when the policy is part of what the adapter is, as decorators of `@ddd-ts-kit/aspects/decorators` (`aspects/outside-in`). Kinds `external` and `gateway` get the default policy of the platform otherwise. `ownPolicy` is the helper of `{{alias.platform}}/resilience/own-policy{{alias.ext}}`, which `generate adapter` writes when the platform does not have it yet.
{{/if}}
{{#if style.explicit}}
- An adapter is bound to its port in `<context>.module.ts` only (`composition/only-in-module`), with its kind (`repository`, `gateway`, `external`).
- Retry, timeout and cache go on the binding (`ownPolicy(retry(...), timeout(...))`) or, when the policy is part of what the adapter is, as decorators of `@ddd-ts-kit/aspects/decorators` (`aspects/outside-in`). Kinds `external` and `gateway` get the default policy of the platform otherwise. `ownPolicy` is the helper of `{{alias.platform}}/resilience/own-policy{{alias.ext}}`, which `generate adapter` writes when the platform does not have it yet.
{{/if}}
- A repository only persists: no `pullEvents()`, no dispatcher (`domain-events/dispatched-on-save`). A removal that announces an event takes the aggregate, not its id.
- The repository adapter of an event-sourced aggregate delegates to `EventSourcedRepository` of the kernel. Its stored events are declared in `persistence/<aggregate>-events.mapper.ts` with `defineStoredEvent` and a named type of their data; a change of that type is a new version with its upcaster, never an edit (`event-sourcing/upcaster-required`, against `stored-events.lock.json`, which `ddd-ts-kit docs --stored-events` writes once the shape of a version is final; `docs --check` fails while a version is unrecorded). Every named type the data reaches is declared in the codec file too.
- Infrastructure faults are plain errors (a 5xx, reported from outside); business refusals are `DomainError`s raised by the domain.
- Every adapter passes the contract suite of the fake of its port (`test/integration/*.contract.spec.ts`).
- Method: `/ddd-ts-kit:persistence`. Create with `npx ddd-ts-kit generate repository|adapter|gateway|acl ... --json`.

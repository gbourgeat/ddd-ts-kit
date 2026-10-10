---
paths:
  - "{{config.contextsDir}}/*/application/**"
  - "{{config.contextsDir}}/*/published-language/**"
---

# Application layer and published language

- Imports `domain/`, `application/`, published languages and `@ddd-ts-kit/kernel` only (`layer/application-inward`). Never `infrastructure/`, `presentation/`, a framework or a driver: declare a port in `application/ports/`.
{{#if style.declared}}
- A class declares itself with a decorator of `@ddd-ts-kit/kernel/declarations` (`declarations/role-declared`): `@Requires(permission)` or `@Public()` on the command or query (`authz/declared`), `@CommandHandler(Message, [TOKENS])` or `@QueryHandler` on its handler, `@IntegrationEventHandler(definition, { consumer }, [TOKENS])`, `@DomainEventHandler(Event, { name })`, `@Policy(permission, { name })`. The token list names the constructor parameters in order; tokens of the context live in `ports/<context>.ports.ts`. Names are string literals.
{{/if}}
- One use case per folder: `commands/<use-case>/` or `queries/<use-case>/`. A command extends `Command<Result>`, a query `Query<Result>`; the handler file exports one class whose only public method is `execute` (`application/handler-shape`).
- A handler orchestrates (load, call the aggregate, save, dispatch events); the business decision lives in the domain.
- A command returns at most an identifier. A query never saves, deletes or publishes (`application/command-query-separation`) and may read a projection through a port.
- The unit of work is a middleware of the command bus, not code in the handler. Time and identifiers come from `Clock` and `IdGenerator` (`purity/*`).
- A port is named for what the application needs (`PaymentGateway`), not for a technology. Each port has a fake in `test/fakes/`.
- Another context is known only through its `published-language/` (`context/published-language-only`), with the relationship declared in the config (`context/declared-relationship`).
- `published-language/` holds versioned, serializable contracts and imports only the kernel (`context/published-language-is-a-contract`). Inside a version, fields are added, never renamed or removed.
- Integration event handlers are idempotent under their consumer name: delivery is at least once.
- Add behaviour with `/ddd-ts-kit:use-case`; scaffold with `npx ddd-ts-kit generate command|query|port|event-handler|integration-event|integration-handler`.

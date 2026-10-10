---
paths:
  - "src/contexts/*/application/**"
---

# Application layer

- Imports `domain/`, `application/`, published languages, `@ddd-ts-kit/kernel` and `@ddd-ts-kit/auth` only (`layer/application-inward`): never `infrastructure/`, `presentation/`, a framework or a driver.
- One use case per folder, `commands/<use-case>/` or `queries/<use-case>/`: the message, its handler, a `*.result.ts` when the answer has a shape of its own. The handler has one public method, `execute` (`application/handler-shape`): it loads or builds, calls ONE intention method, `await repository.save(aggregate)`, and returns at most an identifier.
- Events leave with the save: never `pullEvents()`, never a `DomainEventDispatcher` here (`domain-events/dispatched-on-save`). A reaction is a class of `event-handlers/` or a publisher of `integration/publishers/`.
- Every command and query carries `@Requires(permission)` or `@Public()` (`authz/declared`), and the actor is in the message (`authz/actor-explicit`). Permissions live in `authorization/<context>.permissions.ts`, rules that need loaded state in `authorization/*.policy.ts`.
- The decorator is the registration (`declarations/role-declared`): `@CommandHandler(Message, [Ports])`, `@QueryHandler`, `@DomainEventHandler(Event, { name }, [Ports])`, `@IntegrationEventHandler(definition, { consumer }, [Ports])`, `@Scheduled('<context>.<job>', schedule, [CommandBus])`, `@Policy(permission, { name })`. Names are string literals.
- A port is an abstract class in `ports/<name>.port.ts` and its own injection token (`ports/abstract-class`, `ports/no-token-constant`), named for the need (`PaymentGateway`), with a fake in `test/fakes/`.
- A dependency list names port classes, imported as values, in the order of the constructor: never an adapter or a fake (`ports/value-import`, `ports/no-concrete-dependency`).
- A job (`scheduling/*.job.ts`) and an integration event handler (`integration/handlers/`) only build one command and send it as a system actor; both are safe to repeat (`scheduling/job-triggers-use-case`, `events/consumer-idempotent`).
- A query never saves, deletes or publishes (`application/command-query-separation`); it hands the access scope of the actor to its read port and never filters after loading.
- Time through `Clock`, identifiers through `IdGenerator`, no `process.env` (`purity/*`). No logging, tracing, retry or audit call: they are applied from outside (`aspects/outside-in`, `tracing/platform-only`).
- A whole feature with `/ddd-ts-kit:use-case`. Create with `npx ddd-ts-kit generate command|query|port|policy|job|event-handler|integration-handler ... --json`, then fill the `TODO(domain)` places.

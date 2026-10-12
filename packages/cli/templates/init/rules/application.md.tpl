---
paths:
  - "{{config.contextsDir}}/*/application/**"
---

# Application layer

- Imports `domain/`, `application/`, published languages, `@ddd-ts-kit/kernel` and `@ddd-ts-kit/auth` only (`layer/application-inward`): never `infrastructure/`, `presentation/`, a framework or a driver.
- One use case per folder, `commands/<use-case>/` or `queries/<use-case>/`: the message, its handler, a `*.result.ts` when the answer has a shape of its own. The handler has one public method, `execute` (`application/handler-shape`): it loads or builds, calls ONE intention method, `await repository.save(aggregate)`, and returns at most an identifier.
- Events leave with the save: never `pullEvents()`, never a `DomainEventDispatcher` here (`domain-events/dispatched-on-save`). A reaction is a class of `event-handlers/` or a publisher of `integration/publishers/`. It runs at the end of the unit of work, before the commit, and depends only on what the transaction covers (`domain-events/transactional-before-commit`): repositories, the integration event publisher, the command bus. An effect outside the database is a handler of the `after-commit` phase (`generate event-handler ... --phase after-commit`: at most once, never saves, sends a command) or, when it must not be lost, the handler of an integration event.
{{#if style.declared}}
- Every command and query carries `@Requires(permission)` or `@Public()` (`authz/declared`), and the actor is in the message (`authz/actor-explicit`). Permissions live in `authorization/<context>.permissions.ts`, rules that need loaded state in `authorization/*.policy.ts`.
- The decorator is the registration (`declarations/role-declared`): `@CommandHandler(Message)`, `@QueryHandler(Message)`, `@DomainEventHandler(Event, { name })`, `@IntegrationEventHandler(definition, { consumer })`, `@Scheduled('<context>.<job>', schedule)`, `@Projection('<context>.<name>')`, `@Policy(permission, { name })`. Names are string literals.
- The constructor is the one statement of what a class depends on (`declarations/constructor-injection`): each parameter is typed by one port class, with no `?`, default value, rest or destructuring, and no list repeats it in the decorator. To add a dependency, add the parameter: `npx ddd-ts-kit docs` reads the signature into the generated file of the context (`npm run dev` does it on every change), never edit that file.
{{/if}}
{{#if style.explicit}}
- Every command and query is registered in `<context>.module.ts` with the permission it requires, or as public (`authz/declared`), and the actor is in the message (`authz/actor-explicit`). Permissions live in `authorization/<context>.permissions.ts`, rules that need loaded state in `authorization/*.policy.ts`.
- A class here carries no registration of its own: `<context>.module.ts` binds it and lists what its constructor receives. A job is registered as `@Scheduled('<context>.<job>', schedule)` would say: one name, one schedule, and the command bus as its only dependency.
{{/if}}
- A port is an abstract class in `ports/<name>.port.ts` and its own injection token (`ports/abstract-class`, `ports/no-token-constant`), named for the need (`PaymentGateway`), with a fake in `test/fakes/`.
{{#if style.declared}}
- A constructor parameter is typed by a port, never by an adapter or a fake (`ports/no-concrete-dependency`); a port that only types a parameter is imported with `import type`.
{{/if}}
{{#if style.explicit}}
- A dependency list names port classes, imported as values, in the order of the constructor: never an adapter or a fake (`ports/value-import`, `ports/no-concrete-dependency`).
{{/if}}
- A job (`scheduling/*.job.ts`) and an integration event handler (`integration/handlers/`) only build one command and send it as a system actor; both are safe to repeat (`scheduling/job-triggers-use-case`, `events/consumer-idempotent`).
- A query never saves, deletes or publishes (`application/command-query-separation`); it hands the access scope of the actor to its read port and never filters after loading.
- A read that takes criteria, a scope or a page is a search, never a list (`naming/search-not-list`): `Search<Things>Query` in `queries/search-<things>/` (`generate query ... --search`), `search...` on the port, its adapters and its fakes; one element or none stays `findById` or `findBy...`.
- Time through `Clock`, identifiers through `IdGenerator`, no `process.env` (`purity/*`). No logging, tracing, retry or audit call: they are applied from outside (`aspects/outside-in`, `tracing/platform-only`).
- A whole feature with `/ddd-ts-kit:use-case`. Create with `npx ddd-ts-kit generate command|query|port|policy|job|event-handler|integration-handler ... --json`, then fill the `TODO(domain)` places.

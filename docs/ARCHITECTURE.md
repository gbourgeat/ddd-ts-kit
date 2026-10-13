**English** · [Français](ARCHITECTURE.fr.md)

# Architecture reference

The single normative document. The CLI (`ddd-ts-kit check`), the templates, the skills and the
hook all implement what is written here. When they disagree, this file is right and the tool is
to be fixed.

## 1. Strategic design

A system is a set of **bounded contexts**. Each one owns a model, a vocabulary and its data.

- Every context has a `CONTEXT.md`: purpose, classification, ubiquitous language (glossary),
  aggregates, published events, relationships.
  It ends with a generated `## Reference`: use cases with their permission, routes, consumed
  and published events, ports with their adapters, policies, gateways and a dependencies
  line. `ddd-ts-kit docs` writes it, `docs --check` detects its drift, and
  `ddd-ts-kit describe <context> --json` gives the same facts as data.
- Every context is classified: `core` (differentiating, gets the best design effort),
  `supporting` (needed, not differentiating) or `generic` (buy or keep trivial).
- Relationships are declared in `ddd-ts-kit.config.json`, never implied by an import. A
  downstream context names its upstream and the pattern: `published-language` (default),
  `customer-supplier`, `conformist`, `anti-corruption-layer`, `open-host-service`,
  `shared-kernel`.
- The only code another context may import is the upstream's `published-language/` folder:
  event types, payload types, read contracts. Everything else goes through integration events.
- A downstream that does not want the upstream's model translates it in
  `infrastructure/anti-corruption/`.
- No shared database tables. A context reads another context's data through a published
  contract or its own projection fed by integration events.
- The shared kernel holds only what at least two contexts use. A file read by one context
  belongs to that context.

![Two bounded contexts that collaborate: the downstream imports only the published language of its upstream, and reacts to its integration events, which leave through the outbox and a relay](assets/diagrams/architecture-contexts-collaboration.svg)

The relationship is written down before the first import. In the example application,
`notification` reacts to what `scheduling` and `identity` publish, and its entry in
`ddd-ts-kit.config.json` says so:

```json
"notification": {
  "classification": "supporting",
  "upstreams": [
    { "context": "scheduling", "relationship": "published-language" },
    { "context": "identity", "relationship": "published-language" }
  ]
}
```

A file of `notification` then reaches `scheduling` through its published language, and nowhere
else:

```ts
// Instead of: the model of another context (context/published-language-only)
import { Appointment } from '@/contexts/scheduling/domain/aggregates/appointment.aggregate';

// Write: the contract the upstream designed for the others, and react to its events
import { appointmentCancelledV1, type AppointmentCancelledV1 } from '@/contexts/scheduling/published-language/index';
```

## 2. Canonical tree

```
src/
  main.ts                        composition root: tracing first, then wiring
  shared-kernel/                 optional: value objects used by two contexts or more
    presentation/                schemas of the HTTP contract several contexts answer with (*.schema.ts)
  platform/                      technical capabilities: config, database, events, auth, tracing, http server
  apps/<context>/main.ts         optional: one context run alone as a service
  apps/worker/main.ts            optional: the scheduled jobs in a process of their own
  contexts/<context>/
    CONTEXT.md
    <context>.declarations.ts    generated: the barrel of the context's declared classes, and what each constructor is injected
    <context>.dependencies.ts    generated, under discovery only: what each constructor is injected
    <context>.module.ts          explicit style only: binds ports to adapters by hand
    published-language/          contracts designed for other contexts
    domain/
      aggregates/                *.aggregate.ts
      entities/                  *.entity.ts
      value-objects/             *.vo.ts
      vocabularies/              *.vocabulary.ts   (closed vocabularies: an object `as const` and its union type)
      events/                    *.event.ts
      errors/                    *.error.ts        (one class per concept; each refusal is a static factory)
      repositories/              *.repository.ts   (ports: abstract classes)
      services/                  *.service.ts      (stateless domain logic over several aggregates)
      state-machines/            *.state-machine.ts (the lifecycle of an aggregate: states, transitions, refusals)
    application/
      commands/<use-case>/       *.command.ts, *.handler.ts
      queries/<use-case>/        *.query.ts, *.result.ts, *.handler.ts
      ports/                     *.port.ts         (ports to the outside world: abstract classes)
      authorization/             <context>.permissions.ts, *.policy.ts (who may do what, here)
      event-handlers/            *.event-handler.ts (reactions to this context's domain events)
      scheduling/                *.job.ts          (jobs run by time: schedule to command)
      background/                *.background-job.ts (work enqueued by a use case, run by a worker)
      processes/                 *.process.ts      (process managers: state, decisions, timeouts)
      projections/               *.projection.ts   (projectors: events to one read model)
      integration/
        publishers/              *.publisher.ts    (domain event to integration event)
        handlers/                *.integration-handler.ts (integration event to command)
    infrastructure/
      persistence/               *.repository.ts adapters, *.mapper.ts, *.reader.ts, *.schema.ts
      external/                  adapters of outside systems
      anti-corruption/           translators of another context's or system's model
    presentation/
      http/                      <name>.routes.ts  (a route group: prefix, tags, guards)
        <resource>/<use-case>/   *.controller.ts, its schemas (*.params.ts, *.query.ts, *.headers.ts, *.body.ts,
                                 *.accepted.ts, *.answer.ts, *.line.ts), *.mapper.ts, *.serializer.ts
        guards/                  *.guard.ts        (guards of the project: declared classes)
        shared/                  schemas (*.schema.ts, `generate schema`) and serializers several routes use
                                 function routes stay flat: *.route.ts, *.dto.ts, <context>.routes.ts (their list)
      cli/
    test/
      unit/  integration/
      fakes/                     in-memory implementations of ports and repositories
      builders/                  *.builder.ts      (test data builders, one per aggregate)
```

Under `presentation/http/` one route is one folder. `"stack.routes": "controllers"` (the form of
a new project) writes each route as a class carrying `@Controller` of `@ddd-ts-kit/http`, in
`<resource>/<use-case>/` with the schemas of its request and of its answer; the resource is the
first segment of its path, and the group of that resource, `<resource>.routes.ts`, gives the
prefix, the tag and the guards. A schema file is named after its class, which is the name of the
schema in the published contract: `book-appointment.accepted.ts` holds `BookAppointmentAccepted`.
`"stack.routes": "functions"` keeps one `defineRoute` function per route, flat, listed in
`<context>.routes.ts`. Both forms run in one project.

**A shape is declared once.** Under `"stack.schemas": "shared"` (the form of a new project), a
shape several routes use, whole or in part, is declared once in `presentation/http/shared/` of
its context (`generate schema <context> <Name>`), or in `presentation/` of the shared kernel when
several contexts answer with it (`generate schema shared-kernel <Name>`), and shared: the OpenAPI
contract holds it once in `components.schemas` and each route points at it. A route derives the
part it needs from it (pick, omit, partial, extend) instead of copying it, and a command answers
an identifier with `acceptedSchema` of `@ddd-ts-kit/http`, the `Accepted` component of the
platform. `schema/no-duplicate-shape` reports a shape declared by hand twice in one context, and
`schema/presentation-only` keeps every schema in a presentation layer: a schema is a type of the
contract, the domain and the use cases never read one.

**Guards and permissions are two things, and each has one place.** A guard is a control at the
edge, over a set of routes: is the caller authenticated, does it hold a role, does the tenant of
its token match the one of the path, is the key of the request known. It reads the caller and
the request, runs before the controller, and answers 401 or 403; a route group or a controller
names it in `guards`. A permission is a business right: it may depend on the element (who owns
this appointment, is this invoice still a draft) and it is declared on the use case, with
`@Requires` on the command or the query, decided by the bus through the `Authorizer` port. A
job, an event handler and another transport send the same command and are held to the same
permission; none of them passes a guard. So a guard never replaces a permission, never loads an
aggregate (`presentation/guard-at-the-edge`), and every use case still says who may send it
(`authz/declared`).

![A request passes the guards of its route group, then the controller sends a command; the command bus asks the Authorizer for the permission the command requires, and the handler asks a policy about the element it loaded. A scheduled job, an integration event handler or another transport sends the same command without any guard, and is held to the same permission](assets/diagrams/architecture-guards-and-permissions.svg)

Each one is written where it belongs: the guard on the route group, the permission on the
command.

<!-- checked sample -->
```ts
import { definePermissions } from '@ddd-ts-kit/auth';
import { Authenticated, RouteGroup } from '@ddd-ts-kit/http';
import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';

// presentation/http/invoices.routes.ts: runs before every controller of the group, answers 401
@RouteGroup({ prefix: '/invoices', tags: ['billing'], guards: [Authenticated], errors: ['FORBIDDEN'] })
export class InvoicesRoutes {}

// application/authorization/billing.permissions.ts: the rights of the context, as data
export const billingPermissions = definePermissions('billing', {
  'invoice.pay': { description: 'Record the payment of an invoice' },
});

// application/commands/pay-invoice/pay-invoice.command.ts: whoever sends it needs the permission
@Requires(billingPermissions['invoice.pay'])
export class PayInvoiceCommand extends AuthorizedCommand<void> {
  constructor(
    actor: Actor,
    readonly invoiceId: string,
  ) {
    super(actor);
  }
}
```

The tree is **closed**: a directory not listed here is a design decision, added to
`extraDirectories` in the config with a reason, not created ad hoc. The levels named
`<use-case>` are open, and so is everything below `test/unit/`, `test/integration/`,
`test/fakes/` and `test/builders/`. End-to-end specs (`test/e2e/`) and the architecture test
(`test/architecture/`) live at the project root, outside the contexts.

## 3. Dependency rules

![The four layers of a bounded context inside the platform: presentation, application and infrastructure point towards the domain, infrastructure implements the ports of the application](assets/diagrams/layers-dependency-rule.svg)

Every source dependency points towards the domain. The one arrow that goes the other way is
not an import: infrastructure implements a port the application or the domain declares, and
the platform binds it at start-up. Why, and what each layer holds:
[Layers and the dependency rule](concepts/layers-and-dependency-rule.md).

| Id | Rule |
|---|---|
| `layer/domain-purity` | `domain/` imports only its own `domain/`, the shared kernel and `@ddd-ts-kit/kernel`. No framework, no ORM, no validation library, no Node built-in doing I/O. |
| `layer/application-inward` | `application/` imports `domain/`, `application/`, published languages, the kernel and `@ddd-ts-kit/auth` (permissions and policies). Never `infrastructure/` or `presentation/`, never a framework or a driver. |
| `layer/presentation-no-infrastructure` | `presentation/` imports `application/` (and domain types for mapping), never `infrastructure/`. |
| `layer/infrastructure-no-presentation` | `infrastructure/` implements ports of `application/` and `domain/`, never imports `presentation/`. |
| `context/published-language-only` | A file imports from another context only through that context's `published-language/`. |
| `context/declared-relationship` | Such an import requires the relationship to be declared in the config. |
| `context/published-language-is-a-contract` | `published-language/` imports only the kernel, `@ddd-ts-kit/events`, `@ddd-ts-kit/validation`, the schema library of the project and other published languages (`publishedLanguageAllowedPackages`). |
| `context/no-cycle` | The declared relationships form no cycle. |
| `tree/closed` | A context holds only the canonical directories, plus its declared `extraDirectories`, and no source file outside a role directory. |
| `tree/context-doc` | Every context has a `CONTEXT.md` with the required sections (`Purpose`, `Classification`, `Ubiquitous language`, `Aggregates`, `Published events`, `Relationships`) and the classification declared in the config. |
| `naming/suffix` | A file in a role directory carries the role's suffix, in kebab-case. |
| `naming/one-concept-per-file` | One exported aggregate, entity, value object, event, handler, job or projection per file, and one declared class per role file. |
| `naming/search-not-list` | A read that takes criteria, a scope or a page is a search. In a context, no method is named `list`, or `list` followed by an upper-case letter (`listByCustomer`), in a port (`domain/repositories/*.repository.ts`, `application/ports/*.port.ts`) nor in a class of `infrastructure/` or `test/fakes/`: it is named `search...`. Under `application/queries/`, no folder or file is named `list` or starts with `list-` or `list.`, and no class is named `List` or starts with `List` followed by an upper-case letter: the query is `Search<Things>Query` in `search-<things>/`. A property is not judged, nor `listAccessible`, which the `Authorizer` port of the kit requires; a read of one element or none stays `findById` or `findBy...`. |
| `test/spec-required` | Every aggregate, value object, domain service, command handler, query handler, domain event handler, integration event handler, job and projection has a `*.spec.ts` in the context's `test/`. |
| `events/name-format` | Domain and integration event names follow `<context>.<aggregate>.<fact-in-past-tense>`: the `static readonly eventName` a domain event declares once (or its `readonly name`, as 0.5 wrote it) and the `type` of an integration event declaration. |
| `events/defined-in-published-language` | An integration event is declared once with `defineIntegrationEvent` in the producer's `published-language/`, with a payload schema. Catalog and AsyncAPI document are generated from these declarations. |
| `test/no-mocks` | No `vi.mock`, `jest.mock`, `vi.fn`, `jest.fn`, `vi.spyOn`, `jest.spyOn` or mocking library in a context's `test/`. Use the fake of the port. Default severity `warn`. |
| `test/builder-required` | An aggregate has a builder in `test/builders/`. Default severity `warn`. |
| `test/coverage-governed` | Coverage cannot be gamed by exclusion. The test runner config reads what it measures and its thresholds from the `coverage` key of `ddd-ts-kit.config.json` through `governedCoverage` (`governedJestCoverage` under jest) of `@ddd-ts-kit/testing/coverage`: the four layers of every context, the files no spec loads included, each context and layer held to its floor from its first source file. Refused: `include`, `exclude`, `thresholds` or `ignoreClassMethods` written by hand in a `coverage` block (`collectCoverageFrom`, `coveragePathIgnorePatterns`, `coverageThreshold` under jest), the same set by a flag in a script of `package.json`, and a `v8 ignore`, `c8 ignore` or `istanbul ignore` comment in a production source that does not end with `-- ADR-NNNN: <reason>` naming an existing decision record. |
| `language/glossary-term` | Every aggregate, entity, value object, domain service, domain event, command and query is named with terms of the `## Ubiquitous language` table of its context's `CONTEXT.md`, and under `"stack.refusals": "factories"` every error class of `domain/errors/` too (`AppointmentError` is named after `Appointment`). The glossary is written before the code. |
| `language/declared-vocabulary` | A value of a closed vocabulary the project declares, an object `as const` exported with the union type of its name (`domain/vocabularies/*.vocabulary.ts`, the `Role` of the platform) or a permission set of `definePermissions`, is read through it (`AppointmentStatus.NoShow`, `billingPermissions['invoice.issue']`), never written again as a string literal outside its declaration, a quoted key included (`[AppointmentStatus.NoShow]: ..`). Under `"stack.literals": "named"`, which `init` writes; a config that does not say keeps free literals. Where: the vocabulary of a context in that context only, the one of the platform in the platform and the route groups `*.routes.ts`, a permission id and a vocabulary of the shared kernel everywhere. Tests, published languages and the relationship schema (`defineSchema`) are not judged. Read as a vocabulary: each entry a key and a string literal, comments, either quote and `as const satisfies ..` allowed, next to `export type X = (typeof X)[keyof typeof X]`; a number, a spread or a computed entry leaves the object unread. |
| `language/no-technical-name` | No `Manager`, `Helper`, `Util`, `Utils`, `Data`, `Info`, `Processor`, `Wrapper`, `Impl`, `Base`, `Abstract`, `Dto`, `Entity`, `Model` in a name under `domain/` or in a use case name. |
| `purity/no-system-clock` | No `new Date()` without argument, `Date.now()` or `performance.now()` in `domain/` or `application/`: time comes from the `Clock` port. |
| `purity/no-ambient-randomness` | No `Math.random`, `crypto.randomUUID` or id library in `domain/` or `application/`: identifiers come from the `IdGenerator` port. |
| `purity/no-environment` | No `process.env`, `console`, file system or network access in `domain/` or `application/`. |
| `clean/stepdown` | A file reads top to bottom: static factories, public members, then protected and private ones, and a function above the functions it calls. |
| `clean/function-size` | A function has at most 3 parameters and 30 lines (configurable, never above 100); a longer one is doing more than one thing. Default severity `warn`. No function is longer than 100 lines of code, `describe` callbacks included: that ceiling is an `error`. |
| `clean/no-commented-out-code` | No code in comments. Version control remembers. |
| `clean/no-noise-comment` | No comment that restates the code, no banner, no journal, no closing-brace comment, no `@param` without description. Default severity `warn`. |
| `clean/no-escape-hatch` | No `any`, no non-null assertion, no type assertion outside mappers and infrastructure, no `@ts-ignore`, no `@ts-expect-error` without a reason, no `eslint-disable` without a reason. |
| `clean/no-flag-argument` | No boolean parameter on a public method of the domain or a use case: two intentions are two methods. Default severity `warn`. |
| `clean/no-magic-number` | Under `"stack.literals": "named"`, no number literal in `domain/` and `application/` but 0, 1, -1 (the `allow` option of the ESLint rule changes the list), an index and a type: a duration, a limit or a rate is named where it is decided, a constant of the module or a `static readonly` (`const MINUTES_PER_HOUR = 60`), or a value object of the business. Held by the ESLint plugin. |
| `domain/aggregate-encapsulation` | An aggregate or entity has a private or protected constructor, no public mutable property and no setter. |
| `domain/value-object-immutability` | A value object has only readonly properties and never assigns to itself outside its constructor. |
| `domain/no-generic-error` | `domain/` and `application/` never `throw new Error(...)`: a business failure is a `DomainError` subclass. |
| `errors/through-factory` | Under `"stack.refusals": "factories"`, a domain error is built by a static factory of the error class of its concept: `throw AppointmentError.slotTaken(calendar.id, slot.startsAt)`. No `new` of a class imported from `domain/errors/`, in any file of a context, tests included. The errors of the kit, each one refusal under a fixed code (`NotFoundError`, `InvariantViolation`, `ValidationError`), are not concerned. |
| `errors/constructor-not-public` | Under `"stack.refusals": "factories"`, the constructor of an error class of `domain/errors/` is not public: the class extends `ConceptError` of the kernel, whose constructor is protected, and declares none; a constructor it declares is private or protected. Refused: a public constructor, and a class that extends `DomainError` without a constructor, which inherits a public one. An abstract class is not judged. |
| `errors/factory-name` | Under `"stack.refusals": "factories"`, a factory (a public static method of an error class that calls `refusal(..)`) is named after the refusal, in the words of the business: never `create`, `make`, `of`, `from`, `build`, `new`, `error`, `failure`, `fail`, `refusal`, `refuse`, nor a name holding a digit. Its code is a string literal in constant case, and is the name of the factory in constant case, alone or with the name of the concept before or after it: `AppointmentError.notFound` sets `NOT_FOUND`, `APPOINTMENT_NOT_FOUND` or `NOT_FOUND_APPOINTMENT`; `slotTaken` setting `BOOKING_FAILED` is reported. |
| `errors/code-unique` | Under `"stack.refusals": "factories"`, a code names one refusal of a context: no two factories, and no two error classes, of the `domain/errors/` of one context set the same code, whichever form writes it (the first argument of `refusal(..)`, a `readonly code` field). The same code in two contexts is allowed: each context owns its language, and the error mapper gives a code one status. |
| `schema/presentation-only` | Under `"stack.schemas": "shared"`, a schema of the HTTP contract lives in `presentation/`: of its context, or of the shared kernel when several contexts answer with it. In the shared kernel outside `presentation/`, no import of a validation library (zod, class-validator, class-transformer, class-validator-jsonschema, valibot, arktype, TypeBox, `@ddd-ts-kit/validation`); in `domain/`, `application/`, `infrastructure/` and `published-language/` of a context, and in the shared kernel outside `presentation/`, no import of a file of `presentation/` of the shared kernel. Specs are not judged. |
| `schema/no-duplicate-shape` | Under `"stack.schemas": "shared"`, one shape of the contract is declared once in its context: in the presentation layer of one context, or in it and `presentation/` of the shared kernel, no two DTO classes (of the module, extending nothing, without method, every property decorated) with the same properties, decorators and optionality, and no two object schemas (`z.object`, `v.object`, `Type.Object`) with the same entries, whatever their order and layout. Request parameters (`*.params.ts`, `*.query.ts`, `*.headers.ts`, objects assigned to `params`, `query` or `headers`) empty shapes and shapes that still carry a `TODO(domain)` of the generator (a search line starts as `{ id }`) are not judged. Two contexts may declare the same shape: an equal structure with two meanings is two concepts, and moving it to the shared kernel would couple contexts that stay extractable. The original is the declaration of the shared kernel, then of `presentation/http/shared/` of the context, then the first in path order; each copy is reported. |
| `errors/known-code` | Under `"stack.refusals": "factories"`, every code a route (`*.route.ts`) or a controller (`*.controller.ts`) declares in `errors` exists: a factory or an error class of the context of the route sets it, a class outside the contexts (the platform, the shared kernel) does, or it is a code of the kit (`VALIDATION_FAILED`, `NOT_FOUND`, `CONFLICT`, `INVARIANT_VIOLATION`, `UNAUTHORIZED`, `FORBIDDEN`, `CONCURRENCY_CONFLICT`, `INVALID_CRITERIA`, `INVALID_PAGE_REQUEST`, `TIMEOUT`, `CIRCUIT_OPEN`, `BULKHEAD_FULL`, `ATTEMPTS_EXHAUSTED`, the conditions of a write, `PRECONDITION_FAILED`, `PRECONDITION_REQUIRED`, and the refusals of a file, `FILE_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `FILE_NOT_FOUND`, `FILE_REJECTED`, `INVALID_FILE_KEY`). A code another context sets does not count. |
| `persistence/migration-history` | Every migration of the migration tool the config names (drizzle-kit `migrations/*.sql`, knex and TypeORM `migrations/*`, Prisma `prisma/migrations/*/`) starts with the number that orders it, then what it does (`20261012093000_add-invoices`, written by `npm run db:generate <what-it-does>`), and no two share a number. Under drizzle-kit, `meta/_journal.json` and the `.sql` files match one for one, the entries keep the order they were generated in (`idx` and `when` ascending: the migrator skips an entry older than the last one a database applied) and each snapshot was generated from the one of the entry before it (two snapshots with one parent are two branches merged without regenerating). |
| `persistence/no-file-content` | No column of file content in a persistence schema or a migration (the persistence sources of the contexts and of the platform database, `migrations/`, `drizzle/`, `prisma/`): no binary type (`bytea`, `blob` and its sizes, `varbinary`, knex `.binary()`, a drizzle `customType` of `Buffer` or `Uint8Array`, a Prisma `Bytes` field) and no column of base64 text (a text column whose name says base64; the word in a cursor, an ETag, a comment or a URL is not a column). Files live in the `FileStorage` port of the kernel; a row keeps the `StoredFile` reference (key, size, media type, checksum). A small binary value that is not a file (a hash, a key) is a recorded deviation. |
| `files/port-not-connector` | `domain/` and `application/` name the `FileStorage` port of the kernel (or `FileStaging` and `FileKeys`), never one of its connectors (`InMemoryFileStorage`, `LocalFileStorage`, `SelfSignedFileStorage`); `@ddd-ts-kit/s3` is refused there whatever the allow-lists say. The platform binds the connector of each environment. |
| `application/handler-shape` | A `*.handler.ts` file exports one class with a single public method, `execute`. |
| `presentation/controller-shape` | A `*.controller.ts` file whose class carries `@Controller` of `@ddd-ts-kit/http` exports that one class, with a single public method, `handle`: one class per route. |
| `presentation/controller-delegates` | A controller decides nothing: its constructor takes the bus of its method (`CommandBus` for `POST`, `PUT`, `PATCH` and `DELETE`, `QueryBus` for `GET` and `HEAD`), a request mapper (`*Mapper`) and a serializer (`*Serializer`), and nothing else. |
| `presentation/guard-at-the-edge` | A guard controls the caller at the edge: a `*.guard.ts` file imports nothing from `domain/` or `infrastructure/`, no repository, no unit of work and no command bus. A right that depends on an element of the model is a permission of the use case. |
| `presentation/shared-cache-varies` | A cache policy of `@ddd-ts-kit/http` whose `scope` is `public` (kept by shared caches: Varnish, a CDN), on a route, a controller or a route group that knows its caller (a guard other than `Public`, a function route with `security`), names in `vary` the request headers its answer depends on: a shared cache files an answer by its URL and would hand the answer of one caller to the next. Held by `@ddd-ts-kit/http` when the routes are built (`DeclarationError`), and in the editor by the ESLint plugin for what one file shows. |
| `application/command-query-separation` | A query handler never saves, deletes or publishes. Default severity `warn`. |
| `events/outbox-required` | With a database, integration events are published through the transactional outbox, never straight to a broker or a bus from a handler. `stack.events` is `outbox` whenever `stack.orm` is set. |
| `events/consumer-idempotent` | Every integration event handler is declared (`@IntegrationEventHandler(definition, { consumer })`) or registered with a stable consumer name, unique in the project, and deduplicates through a processed-event store (bound once for the application, or given to the subscription). Never a bare `subscribe`. |
| `context/extractable` | A context can run alone: its module and its declared classes wire nothing of another context, it reads no table or schema of another context, imports no repository nor port of one, and exports no mutable state. It calls another context only through a port of its own whose adapter could be remote. |
| `authz/declared` | Every command, query and route declares the permission it requires, or declares itself public. Nothing is reachable by default: a function route declares its `security`, a controller names its route group or its own `guards`, `[Public]` when anybody may call it. |
| `authz/in-application` | The permission is decided in the application layer through the `Authorizer` port. No role or ownership test in `presentation/`, no authorization in `infrastructure/`, no knowledge of the acting user's rights in `domain/` (a context whose model is access itself may hold roles as its own state). |
| `authz/actor-explicit` | Use cases receive the actor in the command or query. `domain/` and `application/` never read the ambient `ExecutionScope` or `ActorContext`; only infrastructure and the platform may, for audit columns, tenant scoping and correlation. |
| `governance/recorded-deviation` | A suppression, a lowered severity, a coverage threshold lowered under the reference, an extra directory or an extra allowed package carries a reason and points to a decision record in `docs/adr/`. Raising a threshold is free. |
| `aspects/outside-in` | Aspects are applied from outside. The decorators of `@ddd-ts-kit/aspects/decorators` are imported only by an adapter in `infrastructure/` or by the platform; everywhere else an aspect is a wrapper given to a binding or to a declaration (`.with(...)`, `aspects` of `@Adapter`), put around every binding of a kind by the platform (`builder.around(...)`), or a bus middleware. |
| `standard/no-parallel-interface` | No home-made copy of a standard interface of the kernel: no declared `ILogger`, `AppLogger`, `UserContext`, `CurrentUser`, `UserSession`, `PaginatedResult`, `AuditLog` and the like. Use the kernel interface and extend it by declaration merging; the list is `standardInterfaces` in the config. Default severity `warn`. |
| `declarations/role-declared` | In the declared style, a role file exports a class carrying the decorator of its role, and a declared class lives in a role file. Consumer, policy and domain event names are non-empty string literals, or, for a domain event handler, the name its event class declares once, `{ name: InvoiceIssued.eventName }`; a literal is compared with that name. No class under `domain/` carries a declaration. |
| `declarations/barrel-current` | In the declared style, the generated file of a context is what its tree says. With a barrel, `<context>.declarations.ts` holds exactly one `export *` per role file of its context, sorted by path, then one `injected(Class, [Tokens])` per declared class whose constructor takes something and whose decorator lists nothing, with the imports they need: a role file cannot be silently left unregistered, and a constructor cannot change without its list. Under discovery `<context>.dependencies.ts` holds the `injected` statements alone, may be absent while it would hold none, and a barrel left behind is reported. The message names the role file that is missing or the class whose list is stale; `ddd-ts-kit docs` rewrites the file. |
| `declarations/constructor-injection` | In the declared style, the constructor of a declared class is the one statement of what it depends on. A class whose decorator lists no dependency (every decorator but `@Requires` and `@Public`, which declare messages) types each constructor parameter by exactly one class, type arguments aside (`Cache<Session>` names `Cache`): a port, a port of the kernel, another declared class, or an abstract class that types a value bound in the platform. Refused: a parameter that is optional, has a default value, is a rest parameter or is destructured; a parameter without a type, or typed by a union, an intersection, an array, a function, a literal, an object type, a qualified name or a type of the language; a parameter typed by an interface, a type alias, an enum or a class its file does not export, in the file or in the file of the project it is imported from (a name imported from a package is trusted: the compiler judges the generated file, which imports it as a value); a class that inherits its constructor from a class the project cannot read, a class of a package (a constructor inherited from a class of the project is followed and read there). Under `"stack.dependencies": "signature"`, what `init` writes, a decorator carries no dependency list when the constructor can be read: a list that repeats the constructor is reported and ESLint removes it; a list that differs is reported, since it wins at run time. Under `"stack.dependencies": "listed"`, what a config without the key means, lists are never reported, and a class that inherits a constructor nothing can read and lists nothing takes nothing, as it always did. |
| `ports/abstract-class` | A port (`domain/repositories/*.repository.ts`, `application/ports/*.port.ts`) is an abstract class with abstract members only: no constructor, no private or protected member, no body, no initializer, `static readonly tokenKey` excepted. Never an interface. |
| `ports/implements-never-extends` | An adapter implements its port and never extends it: the class declared with `@Repository`, `@Gateway` or `@Adapter`, the class given to `bind(Port).toClass(..)`, and any class of `infrastructure/`. |
| `ports/no-token-constant` | A dependency is named by the class of its port: no `token(..)`, no symbol or string given to `bind`, `rebind`, `resolve`, `fake` or `override`, no UPPER_SNAKE constant in a dependency list, no `*.ports.ts` or `tokens.ts` file. |
| `ports/no-concrete-dependency` | A dependency is named by its port: nothing imported from `infrastructure/` or from `test/fakes/` in a dependency list (of a decorator, of `.toClass(C, [..])`, of `.handledBy(H, [..])`), nor as the type of a constructor parameter of a declared class whose decorator lists nothing. |
| `ports/value-import` | A port named in a dependency list or given to `bind` is imported as a value, never with `import type`. A port that only types a constructor parameter is not concerned: the generated file of the context imports the value. |
| `clean/no-hash-private` | A class member is `private`, never `#name`. |
| `clean/blank-lines` | A blank line before every `return` that is not alone in its block and between the logical blocks of a function (after a group of declarations, around `if`, `for`, `try`, around a multiline statement, around a method); no blank line at the edges of a block, never two in a row. Consecutive declarations and fields may stay together. |
| `clean/braces` | Every `if`, `else`, `for`, `while` and `do` has braces, and its body is on its own lines; `else` follows the closing brace on the same line. A ternary, an arrow function returning an expression and a one-line object literal are not judged. |
| `clean/formatted` | Every TypeScript, JavaScript and JSON file is laid out by the formatter of the project, Biome, at a line width of 120: `npm run format:check` reports nothing to change. Markdown and YAML are not formatted. |
| `clean/one-export-per-file` | A source file exports one class, interface or function and is named after it in kebab-case. Its companions are the types of its own signature, a derived form it calls, or a closed family (a type with its constructors or combinators, the accessors of one private state); anything else is listed in `onePerFile.allow` with its reason. Entry files (`index.ts`, subpath entries) only re-export. The generated files of a declared context (`<context>.declarations.ts`, `<context>.dependencies.ts`) are not judged here: `declarations/barrel-current` holds every line of them. |
| `clean/file-size` | A file is at most 350 lines, tests included, and the limit is not configurable; files under a directory named `generated` and `.d.ts` files are exempt. |
| `scheduling/job-triggers-use-case` | A job lives in `application/scheduling/*.job.ts`, implements `ScheduledJob` and only sends commands: no repository among its dependencies, no import of aggregates, entities, domain services or `infrastructure/`. |
| `scheduling/job-name` | A job is named `<context>.<job-name>` by a string literal in lower-case kebab-case, the context being its own; its `systemActor` carries the same name; the name is unique in the project. |
| `lifecycle/status-through-machine` | The status of an aggregate that has a state machine changes only through it: an aggregate of `domain/aggregates/<name>.aggregate.ts` whose `domain/state-machines/<name>.state-machine.ts` exists imports it as soon as it writes a status (a machine just generated waits for the field), and inside the members of its classes every `status: <value>` of an object, every `<target>.status = <value>` and every shorthand `{ ...this.state, status }` (the value of its local `const status = ..`) takes its value from `<machine>.next(..)` or `<machine>.start(..)` of an imported machine, or copies a status already read (`state.status`, a parameter `status`, `const { status } = ..`). |
| `process/sends-commands-only` | A process manager of `application/processes/*.process.ts` changes the world only through the commands its steps decide: it imports no aggregate, entity, repository or domain service (`domain/aggregates/`, `domain/entities/`, `domain/repositories/`, `domain/services/`), no port (`application/ports/`) and nothing of `infrastructure/`, of its context or another. |
| `domain-events/dispatched-on-save` | Domain events leave with the save: no `pullEvents()` call in `application/` or `infrastructure/` of a context, and no `DomainEventDispatcher` imported, named in a dependency list or received by a constructor in `application/commands/`, `application/queries/` or a repository adapter. A handler writes `await repository.save(aggregate)` and nothing else; a removal that announces an event takes the aggregate. |
| `domain-events/transactional-before-commit` | A domain event handler that runs before the commit has only transactional effects: the commit can still fail after the handlers ran (a deferred constraint, a serialization failure, a lost connection), so a before-commit handler may only have effects the rollback undoes. Judged: every production domain event handler of a context, that is a class of `application/event-handlers/*.event-handler.ts` or `application/integration/publishers/*.publisher.ts`, and any class carrying `@DomainEventHandler`. Its phase is `after-commit` when the options of its `@DomainEventHandler` write `phase: 'after-commit'`, or, for a class without the decorator, when every `.on(` registration of `<context>.module.ts` whose callback mentions it (the class name, or the variable assigned from `new <Class>(`) has a third argument holding `phase: 'after-commit'`; otherwise it is `before-commit`. Its dependencies are the names of the dependency list of its decorator, the types of its constructor parameters and the list of `.toClass(Handler, [..])`, each resolved through the imports of the file that writes it. A before-commit handler may depend on a repository port and anything else of the `domain/` layer of its context; on the ports of `@ddd-ts-kit/kernel` except `Cache`, `CachePurger`, `Lock`, `RateLimiter`, `JobScheduler` and `EventBus`; on `@ddd-ts-kit/auth`; on the files of its context outside `infrastructure/` and `application/ports/`; and on a port of `application/ports/` of its context only when it is a persistence port: at least one production class of the context implements it under `infrastructure/persistence/` and none anywhere else under `infrastructure/`. Refused before the commit: those six kernel ports, any other port of `application/ports/`, anything imported from `infrastructure/`, from another context, from the platform or from a package other than `@ddd-ts-kit/kernel` and `@ddd-ts-kit/auth`. An after-commit handler is refused `IntegrationEventPublisher` alone (after the commit nothing makes the outbox row atomic with a state change: it sends a command through `CommandBus`). |
| `event-sourcing/state-in-apply` | An event-sourced aggregate (a class of `domain/aggregates/` that extends `EventSourcedAggregate`) changes its state only in its apply methods, `apply<Fact>` for each event and `restore` for a snapshot: outside them, the constructor and static methods, no assignment, increment or mutating call writes something of `this`. An apply method records no event, which a replay would record again. |
| `event-sourcing/past-tense` | The events an event-sourced aggregate imports from `domain/events/` are named in the past tense. The fact is judged, the words after the name of the aggregate (`InvoiceIssued` of `Invoice`: `Issued`), or the whole name when it does not start with it: one word is a past participle (a word ending in `-ed`, or a common irregular one: `paid`, `held`, `taken`, `withdrawn`, `set`...), and a participle spelled like its imperative (`set`, `put`, `read`, `run`, `cut`...) does not count at the head of the fact, where it reads as a command (`SetPrice`). The same words `generate domain-event` accepts; a test holds the lists of the CLI and of the ESLint plugin equal. |
| `event-sourcing/store-behind-repository` | `domain/` and `application/` never name `EventStore`, `SnapshotStore`, `CheckpointStore`, `EventSourcedRepository`, `EventSerializer`, `CatchUpSubscription` nor `InMemoryEventStore`: an event-sourced aggregate is loaded and saved through its repository port, whose adapter in `infrastructure/persistence/` delegates to `EventSourcedRepository`. |
| `event-sourcing/projection-never-appends` | A projection (`application/projections/`, or a class carrying `@Projection`) never appends to a stream: it names neither `EventStore` nor `EventSourcedRepository`, and a projection declared `@Projection(name, { feed: 'event-store' })`, replayed from position zero at every rebuild, names nothing of `domain/repositories/` either. A projection fed by the dispatcher keeps the imports it had before event sourcing. |
| `event-sourcing/upcaster-required` | Stored events are never rewritten. Each `defineStoredEvent(Event, { version, encode, decode, upcasters })` names the type of its data in the signature of `encode`, declared in the same codec file with every named type it reaches (the kit's own `PersonalValue` aside); a `version` above 1 has an upcaster from each version below it; and the fingerprint of that type and of the types it reaches (their members, layout and order aside) recorded for a version in `stored-events.lock.json` never changes. `ddd-ts-kit docs --stored-events`, run once the shape of a version is final, records each new version and never rewrites one; until then a shape is free to change. `ddd-ts-kit docs --check`, which the generated pipeline runs, fails while a declared version is not recorded, so no version reaches the main branch unrecorded. A version below the last recorded is refused. |
| `tracing/platform-only` | `@ddd-ts-kit/tracing` (every entry) and `@opentelemetry/*` are imported only by the platform directory, `main.ts` and `apps/`. |
| `tenancy/scoped-statement` | In a project whose `stack.tenancy` is not `none`, the infrastructure of a context confines every statement on tenant data to the tenant of the work through the helpers of its ORM package: on Knex the executor is never used straight (called, chained, held in a variable) but handed to a helper, tables are reached through `tenantTable` (reads) and `ownTenantTable` (writes), and no raw SQL is written; on Drizzle each statement on the executor carries `tenantCondition` or `ownTenantCondition` in its where (inline or in the local it is given), each insert spreads `tenantScopeOf` into its row, and no relational query (`executor().query`) nor raw `execute` is written; a read model store (`KnexReadModelStore`, `KnexReadModelTable`, `DrizzleReadModelStore`, `DrizzleReadModelTable`) is built with its `tenant` option. Judged by text: a where built by another function, or SQL reached other than through the executor, is not seen. A table that holds no tenant data is a recorded deviation. See [Multitenancy](concepts/multitenancy.md). |
| `composition/only-in-module` | Adapters are instantiated or bound, and declared classes assembled (`contextModule`, `discoverContext`, `include`), only in `<context>.module.ts`, `main.ts`, `apps/` and the platform directory. In the declared style an adapter is bound by its own declaration and nothing instantiates it. |
| `imports/alias-only` | A file of the project is imported by its alias (`@/...`, `$test/...`, `$scripts/...`), never by a relative path, the same directory included: `import`, `export ... from` and `import()`, under the source root, `test/` and `scripts/`. An alias path holds no `.` or `..` segment. ESLint fixes it. |
| `imports/extension` | An import of a file of the project ends as `importExtension` of the config says: with no extension under `none` (the default of a new project), where it names a file and never a directory (`.../published-language/index`); with `.js` under `js` (what a config without the key means). A package is never judged, whatever its subpath ends with. ESLint fixes it. |
| `imports/alias-declared` | The alias has one source and every tool follows it: `importAlias` is `@/` or `$<name>/`, two forms no package can be named by; `paths` in `tsconfig.json` is exactly what it gives, with no other entry under an alias and no `baseUrl`, and `tsconfig.build.json` does not differ; vitest and dependency-cruiser are told to read tsconfig, jest repeats the same mapping, knip adds none; a script that compiles runs `ddd-ts-kit build-aliases` afterwards, and tsx runs under `tsconfig.json`. The ending of an import has one source too, `importExtension`, and what derives from it follows: `module` and `moduleResolution` of `tsconfig.json` (`ESNext` and `Bundler` with the `node` condition under `none`, a Node resolution under `js`), the pattern of each jest mapping, and the build step, which writes the `.js` Node needs. |
| `config/valid` | `ddd-ts-kit.config.json` is consistent: known contexts, classifications, relationships, rule ids, guard mode and import extension, the same contexts as on disk, a function limit within the ceiling, complete `onePerFile.allow` entries, positive commit limits, coverage thresholds that are percentages, known extra pipeline jobs (`ci.extras`), a known contract format and contract documents that each have a file-safe name of their own and name what they hold, known contexts included (`openapi`). |
| `config/suppression-needs-reason` | An inline suppression names its rule and gives a reason after `--`. |

### Imports

A file of the project is named by its alias, from the root of the project, never by a relative
path: `@/contexts/billing/domain/aggregates/invoice.aggregate`, whatever the file that
imports it, the same directory included. `@/` is `importAlias` of the config and names the
source root; `$test/` names `test/`, `$scripts/` names `scripts/`, and with Prisma
`$generated/` names the generated client: none of these can be the name of a package. The alias
is declared once, under `paths` in `tsconfig.json`, which the compiler, the runners, knip and
dependency-cruiser read; they always load the sources. Node reads no alias, so the build ends
with `ddd-ts-kit build-aliases`, which rewrites each alias of the compiled output into a
relative path: production is plain `node`, with no loader and no runtime dependency. Every rule
of this section reads an alias exactly as a relative path. The mechanism, what each tool reads,
what the build step does and what was measured:
[tools/import-aliases.md](tools/import-aliases.md).

```ts
// src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts
import { IssueInvoiceCommand } from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.command';
import { Invoice } from '@/contexts/billing/domain/aggregates/invoice.aggregate';
```

Only the composition root (`main.ts`, `apps/`, the platform directory) and what assembles a
context (its generated `<context>.declarations.ts`, or its `<context>.module.ts` in the
explicit style) are allowed to know every layer.

### Who checks what

Three analyzers and a formatter hold the rules, each where it is exact, and each at the moment
it is cheap enough to run:

![When each analyzer runs: the checker at every file write; the checker, ESLint and Biome on the staged files of a commit; the compiler and the unit tests before a push; all of them in the pipeline, with dependency-cruiser and knip](assets/diagrams/architecture-who-checks-what.svg)

| Analyzer | Holds | When |
|---|---|---|
| `ddd-ts-kit check` (zero dependency, text level) | alone, structure and project-wide facts: `tree/*`, `naming/*`, `language/*`, `config/*`, `persistence/migration-history`, `tenancy/scoped-statement`, `context/no-cycle`, `test/spec-required`, `test/builder-required`, `test/coverage-governed`, `events/defined-in-published-language`, `composition/only-in-module`, `declarations/barrel-current`, `imports/alias-declared`, `imports/alias-only` and `imports/extension` in `test/` and `scripts/` as under the source root, the import that names a directory, the config side of `events/outbox-required` and of `governance/recorded-deviation` (decision records exist), and what must be unique in the project (consumer names, job names) or in a context (error codes, `errors/code-unique`), `errors/known-code` and `schema/no-duplicate-shape`, the lock of `event-sourcing/upcaster-required`. It also holds a fast approximation of every code rule below except `domain/*`, `application/*` and the three code rules of `errors/*`; of `clean/blank-lines` it holds the `return` and the padded block only, and it holds nothing of `clean/formatted` | at every file write (editor hook), on staged files, in CI |
| `@ddd-ts-kit/eslint-plugin` (syntax tree) | code: `layer/*`, the imports of `context/*` and `context/extractable`, `purity/*`, `clean/*` but `clean/formatted` (`clean/blank-lines` through two rules of `@stylistic/eslint-plugin` and `clean/braces` through `curly`, which its presets enable), `domain/*`, `application/*`, `errors/through-factory`, `errors/constructor-not-public`, `errors/factory-name`, `authz/*`, `events/name-format`, `events/outbox-required`, `events/consumer-idempotent`, `aspects/*`, `tracing/*`, `domain-events/*`, `event-sourcing/*` but the lock of `event-sourcing/upcaster-required`, `schema/presentation-only`, `standard/*`, `ports/*`, `scheduling/*`, `lifecycle/*` (of `lifecycle/status-through-machine`, the writes one file shows; the machine left unimported is read by `ddd-ts-kit check` alone), `process/*`, `declarations/role-declared`, `declarations/constructor-injection` (which it also fixes, removing a redundant list), `test/no-mocks`, `imports/alias-only` and `imports/extension` (which it also fixes), and the comment side of `governance/recorded-deviation`. `domain/*`, `application/*` and those three rules of `errors/*` are held by it alone. Of `declarations/constructor-injection` and of the constructor side of `ports/no-concrete-dependency` it holds what one file shows: an interface or a type alias declared in another file and a constructor inherited from another class are read by `ddd-ts-kit check`. Of `domain-events/transactional-before-commit` it holds what one declared class shows; where the adapters of an `application/ports/` port live and the phase an explicit-style module file registers a handler in are held by `ddd-ts-kit check` alone. Authoritative when the two disagree | on staged files, in CI |
| Biome (formatter only: its linter and its import organiser are off) | `clean/formatted`: where every token goes, at a line width of 120, with the `biome.json` that `init` writes; it also removes the padding of a block and never leaves a body on the line of its braces, which completes `clean/blank-lines` and `clean/braces`. ESLint enables no rule that decides the same thing | on staged files, in CI |
| dependency-cruiser (resolved import graph) | the same boundaries through barrels and re-exports, cycles between files, orphans, undeclared dependencies; its configuration is generated from the config by `ddd-ts-kit depcruise-config` | in CI |

knip (dead code and unused dependencies) and the TypeScript compiler in `strict` mode complete the gate;
the compiler and the unit tests also run before every push.

## 4. Tactical rules

**Aggregates.** Private constructor, a `create` factory for birth and a `rehydrate` factory for
loading. State changes through methods named after the business intention, never setters. One
aggregate per transaction; another aggregate is referenced by id. Invariants are checked inside,
and a violated one raises a `DomainError` with a stable `code`, built by a factory of the error
class of its concept: `throw AppointmentError.slotTaken(calendar.id, slot.startsAt)`.

```ts
// Instead of: a setter, and the rule lives in every caller that remembers it
invoice.paidAt = new Date();

// Write: an intention of the business, which guards the rule and records the fact
invoice.pay(clock.now());
```

<!-- checked sample -->
```ts
import { AggregateRoot, ConceptError, type DomainEvent } from '@ddd-ts-kit/kernel';

// domain/errors/invoice.error.ts: one class per concept, one factory per refusal
export class InvoiceError extends ConceptError {
  static alreadyPaid(invoiceId: string) {
    return InvoiceError.refusal('INVOICE_ALREADY_PAID', `Invoice ${invoiceId} is already paid.`, { invoiceId });
  }
}

// domain/events/invoice-paid.event.ts: a fact, in the past tense
export class InvoicePaid implements DomainEvent {
  static readonly eventName = 'billing.invoice.paid';

  readonly name = InvoicePaid.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
  ) {}
}

// domain/aggregates/invoice.aggregate.ts
export interface InvoiceState {
  readonly customerId: string;
  readonly paidAt: Date | null;
}

export class Invoice extends AggregateRoot<string> {
  private constructor(
    id: string,
    private state: InvoiceState,
  ) {
    super(id);
  }

  /** Birth: the only way to a new invoice. */
  static create(id: string, customerId: string): Invoice {
    return new Invoice(id, { customerId, paidAt: null });
  }

  /** Loading: what the mapper of the repository adapter calls. */
  static rehydrate(id: string, state: InvoiceState): Invoice {
    return new Invoice(id, state);
  }

  pay(at: Date): void {
    if (this.state.paidAt !== null) {
      throw InvoiceError.alreadyPaid(this.id);
    }

    this.state = { ...this.state, paidAt: at };
    this.record(new InvoicePaid(this.id, at));
  }

  get isPaid(): boolean {
    return this.state.paidAt !== null;
  }
}
```

**Value objects.** Immutable, validated in `create`, compared with `equals`. Primitive obsession
is a defect: an email, an amount, a period are types.

<!-- checked sample -->
```ts
import { ConceptError, ValueObject } from '@ddd-ts-kit/kernel';

export class PersonError extends ConceptError {
  static invalidEmail(raw: string) {
    return PersonError.refusal('INVALID_EMAIL', `"${raw}" is not an email address.`, { raw });
  }
}

export class Email extends ValueObject<{ readonly address: string }> {
  private constructor(address: string) {
    super({ address });
  }

  static create(raw: string): Email {
    const address = raw.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+$/.test(address)) {
      throw PersonError.invalidEmail(raw);
    }

    return new Email(address);
  }

  get address(): string {
    return this.props.address;
  }
}

Email.create(' Ada@Example.org ').equals(Email.create('ada@example.org')); // true: compared by value
```

**Domain events.** Past tense, immutable, recorded by the aggregate. A handler writes
`await this.orders.save(order)` and nothing else: no `pullEvents()`, no dispatcher. A
repository adapter only persists.

```ts
// Instead of: dispatching by hand (domain-events/dispatched-on-save)
await this.invoices.save(invoice);
await this.dispatcher.dispatch(invoice.pullEvents());

// Write: the save hands the recorded events to the unit of work
await this.invoices.save(invoice);
```

**An effect of a domain event exists only if the state change that recorded it is committed.**
A `before-commit` handler commits with it, an `after-commit` handler runs only after it, an
integration event is published only after it.

![The timeline of a unit of work: the handler saves and each save queues events; the before-commit handlers run on the queue inside the transaction; the transaction commits; the after-commit handlers run, then the command answers; later the relay publishes the outbox rows to the consumers. Any failure before or at the commit rolls everything back](assets/diagrams/architecture-unit-of-work.svg)

- **Timing.** Inside a unit of work a save only queues the events its aggregates recorded, in
  recording order across all the saves. Once the work (the command handler) has returned, still
  inside the transaction, the queue is dispatched: every handler sees every save. A handler may
  save an aggregate, whose events join the queue behind those waiting (same order, no
  recursion), and may append to the outbox. Then the transaction commits.
- **`before-commit`, the default phase.** The handler runs in that dispatch. What it writes
  commits or rolls back with the state change, and its failure fails the command.
- **`after-commit`.** Declared with `phase: 'after-commit'` (`@DomainEventHandler` options, or
  `dispatcher.on(name, callback, { phase: 'after-commit' })`). The handler runs once the
  transaction has committed, never when it rolled back, in the order the events were dispatched,
  and is awaited before the command answers. Its failure cannot fail the command: it is logged
  and handed to the `ErrorReporter`, and the other handlers still run. The phase is at most
  once: a crash between the commit and the run loses it. What must not be lost is an
  integration event, through the outbox.
- **Failure.** When the work throws, a save rejects, a `before-commit` handler fails or the
  commit itself fails, everything rolls back and the events still queued are dropped: no
  `after-commit` handler runs, nothing is stored, no outbox row remains. A save that rejects
  pulls nothing: its events stay on the aggregate. Events pulled by a save of a unit of work
  that rolled back are never put back on the aggregate: a retry runs the command again on
  reloaded aggregates, and an aggregate instance of a failed command is not reused.
- **Why `before-commit` is restricted.** The commit can fail after the `before-commit`
  handlers ran (a deferred constraint, a serialization failure, a lost connection). The
  guarantee holds only because such a handler has transactional effects alone, which
  `domain-events/transactional-before-commit` enforces: repository ports and the domain of its
  context, kernel ports other than `Cache`, `CachePurger`, `Lock`, `RateLimiter`, `JobScheduler` and
  `EventBus` (`CacheInvalidation` is one: its purge request commits with the work), and ports of `application/ports/` whose adapters are all under
  `infrastructure/persistence/`. A gateway, an external port or an adapter of
  `infrastructure/external/` requires `phase: 'after-commit'` (the effect may be lost) or an
  integration event (it must not be). An `after-commit` handler does not depend on
  `IntegrationEventPublisher`.
- **After the commit, no save.** An `after-commit` handler that hands an aggregate to a
  repository (`save`, `saveAll`, `remove(aggregate)`) is refused before the write with
  `SaveAfterCommitError`: the unit of work is over, nothing would dispatch its events nor roll
  it back. It sends a command through the `CommandBus`, which opens a unit of work of its own.
- **One scope per unit of work.** Every `UnitOfWork.run` is built on `withinUnitOfWork` of the
  kernel, so a `run` called directly (a consumer, a script) has the timing of a command. A
  nested `run`, or a command sent from inside a unit of work, joins the one in progress: one
  dispatch, at the end of the outermost. Two concurrent commands never share a scope. A
  project's own `UnitOfWork` builds `run` on `withinUnitOfWork` and passes `unitOfWorkContract`.
- **Outside any unit of work** (a domain test, a repository used alone, a script) the save
  dispatches before it resolves, `before-commit` handlers then `after-commit` ones, and nothing
  is atomic.

Two reactions to the same fact, one in each phase. The publisher only writes an outbox row, so
it commits with the payment; the receipt goes to a mail provider no transaction covers, so it
waits for the commit:

<!-- checked sample -->
```ts
import type { IntegrationEventDefinition } from '@ddd-ts-kit/events';
import { IdGenerator, IntegrationEventPublisher, type DomainEvent } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';

declare class InvoicePaid implements DomainEvent {
  static readonly eventName: 'billing.invoice.paid';
  readonly name: string;
  readonly aggregateId: string;
  readonly occurredAt: Date;
}

declare const invoicePaidV1: IntegrationEventDefinition<{ readonly invoiceId: string; readonly paidAt: string }>;

// application/ports/receipt-mailer.port.ts: an effect outside the database
export abstract class ReceiptMailer {
  abstract sendFor(invoiceId: string): Promise<void>;
}

// application/integration/publishers/invoice-paid.publisher.ts: before-commit, the default
@DomainEventHandler(InvoicePaid, { name: InvoicePaid.eventName })
export class InvoicePaidPublisher implements DomainEventHandler<InvoicePaid> {
  constructor(
    private readonly publisher: IntegrationEventPublisher,
    private readonly ids: IdGenerator,
  ) {}

  async handle(event: InvoicePaid): Promise<void> {
    const published = invoicePaidV1.create(
      { invoiceId: event.aggregateId, paidAt: event.occurredAt.toISOString() },
      { id: this.ids.next(), occurredAt: event.occurredAt },
    );

    // With a database, the publisher bound here is the outbox: a row in the transaction of the command.
    await this.publisher.publish([published]);
  }
}

// application/event-handlers/invoice-paid-receipt.event-handler.ts: after the commit, at most once
@DomainEventHandler(InvoicePaid, { name: InvoicePaid.eventName, phase: 'after-commit' })
export class InvoicePaidReceiptEventHandler implements DomainEventHandler<InvoicePaid> {
  constructor(private readonly receipts: ReceiptMailer) {}

  async handle(event: InvoicePaid): Promise<void> {
    await this.receipts.sendFor(event.aggregateId);
  }
}
```

A receipt that must never be lost is not sent from an `after-commit` handler: it is the
reaction of a consumer to the integration event, which the outbox delivers at least once.

**Event-sourced aggregates.** Chosen per aggregate, never per project: the other aggregates of
the context keep their state in tables. The aggregate extends `EventSourcedAggregate`; a
command checks its invariants on the state, then records the event of what it decided, and the
apply method `appliers()` names for that event changes the state
(`event-sourcing/state-in-apply`). `rehydrate(id, history)` replays the stream, from a
snapshot when one was taken. Its events are named in the past tense
(`event-sourcing/past-tense`). Its repository port is the same as any other's; the adapter
delegates to `EventSourcedRepository`, which appends at the version the aggregate was loaded at
in the transaction of the unit of work (a `ConcurrencyError` otherwise). Nothing in `domain/`
or `application/` reads the store (`event-sourcing/store-behind-repository`). The integration
events of such an aggregate are published by a before-commit handler of its domain events, to
the outbox: the stream and the outbox commit together. Each stored event is declared in the
codec of its aggregate, `infrastructure/persistence/<aggregate>-events.mapper.ts`, with the
named type of its data; a change of that type is a new version with its upcaster
(`event-sourcing/upcaster-required`). Personal data is stored sealed with the key of its data
subject (`personalData(subject, value)`), and erasing the subject destroys the key. A
projection fed by the store (`@Projection(name, { feed: 'event-store' })`) is applied by a
catch-up subscription and rebuilt from position zero; no projection appends to a stream
(`event-sourcing/projection-never-appends`). When to choose it and what it costs:
[concepts/event-sourcing.md](concepts/event-sourcing.md).

**Use cases.** One command or query per folder, one handler per command. A command returns at
most an identifier. A query never changes state and may bypass aggregates to read a projection
through a port. Handlers orchestrate; business decisions live in the domain.

**Buses.** Presentation and integration event handlers talk to the application through `CommandBus` and
`QueryBus`, never to a handler class. Both are ports of `@ddd-ts-kit/kernel` with in-process
implementations; another transport is an adapter chosen in the composition root. Cross-cutting
behaviour (unit of work, authorization, logging, metrics, audit) is a bus middleware, not
code repeated in handlers. A command is a class extending `Command<Result>`, a query a class extending
`Query<Result>`. In the declared style, the default, a handler is registered by its own
declaration (`@CommandHandler`, `@QueryHandler`) and the context has no module file; in the
explicit style it is registered in `<context>.module.ts`.

**Ports.** A port is an abstract class with abstract members only: no constructor, no
field, no body. The class is the contract and the injection token at once, so there is no
constant and no token file. An adapter implements its port and never extends it; a fake or a
plain object fits as well, the type being structural. A repository port extends the kernel
`Repository<Aggregate>`. A value that is not a port (settings, a database handle) is carried
the same way, by an abstract class with readonly members bound to a plain object.

```ts
// Instead of: an interface, which leaves nothing at run time, and a token beside it
// (ports/abstract-class, ports/no-token-constant)
export interface PaymentGateway {
  charge(invoiceId: string, amountInCents: number): Promise<void>;
}
export const PAYMENT_GATEWAY = Symbol('PaymentGateway');
```

<!-- checked sample -->
```ts
import { Gateway } from '@ddd-ts-kit/kernel/declarations';

// application/ports/payment-gateway.port.ts: the contract and the token at once
export abstract class PaymentGateway {
  abstract charge(invoiceId: string, amountInCents: number): Promise<void>;
}

// infrastructure/external/payment-settings.ts: a value, bound to a plain object by the platform
export abstract class PaymentSettings {
  abstract readonly apiUrl: string;
  abstract readonly secretKey: string;
}

// infrastructure/external/http-payment.gateway.ts: implements the port, never extends it
@Gateway(PaymentGateway)
export class HttpPaymentGateway implements PaymentGateway {
  constructor(private readonly settings: PaymentSettings) {}

  async charge(invoiceId: string, amountInCents: number): Promise<void> {
    const response = await fetch(`${this.settings.apiUrl}/charges`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.settings.secretKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ reference: invoiceId, amount: amountInCents, currency: 'EUR' }),
    });

    if (!response.ok) {
      throw new Error(`The payment provider answered ${response.status}.`);
    }
  }
}

// test/fakes/payment-gateway.fake.ts: fits the same port, the type being structural
export class PaymentGatewayFake implements PaymentGateway {
  readonly charges: { readonly invoiceId: string; readonly amountInCents: number }[] = [];

  async charge(invoiceId: string, amountInCents: number): Promise<void> {
    this.charges.push({ invoiceId, amountInCents });
  }
}
```

**Declarations.** A class says what it is where it is written, and that is its
registration: a command or a query carries `@Requires(permission)` or `@Public()`, its
handler `@CommandHandler(Message)` or `@QueryHandler(Message)`, a reaction to an event
`@DomainEventHandler` or `@IntegrationEventHandler(definition, { consumer })`, a job
`@Scheduled`, a projector `@Projection`, an adapter `@Repository`, `@Gateway` or `@Adapter`
with the port it implements, a policy `@Policy`. Declarations are metadata of the kernel:
they instantiate nothing and import no container. The composition root turns a context's
declarations into its module, from the generated barrel or by discovery, so a context has no
hand-maintained registration file.

**Constructor injection.** The constructor signature of a declared class is the single
statement of what it depends on: `constructor(private readonly orders: OrderRepository,
private readonly clock: Clock) {}`, each parameter typed by one class, which is its
injection token (`declarations/constructor-injection`). Nothing repeats it in the decorator.
`ddd-ts-kit docs` (and every `generate`, and every start of `npm run dev`) reads the
signatures from the sources and writes `injected(Class, [Tokens])` statements in the
generated file of each context, `<context>.declarations.ts` or, under discovery,
`<context>.dependencies.ts`; the composition root reads the lists from there, and the
compiler checks each one against its constructor. The types are never asked of the compiler
at run time: `emitDecoratorMetadata` exists only with legacy decorators compiled by `tsc` or
swc, so it is absent with standard decorators and under `tsx` or esbuild, and it records
`Object` for a port imported with `import type`. Three things keep the generated lists
honest: `declarations/barrel-current` and `ddd-ts-kit docs --check` fail, naming the class,
when a constructor changed without regeneration; `npm run dev` regenerates before every
start and reload; and the composition root refuses, by name and before anything is built,
a class that takes parameters and has no list, or a list of another length
(`WiringError` `MISSING_DEPENDENCIES`, `DEPENDENCY_ARITY`). A list written as the last
argument of a decorator, `@CommandHandler(PlaceOrder, [OrderRepository, Clock])`, is the
form of a 0.1 project (`"stack.dependencies": "listed"`): it is still read, checked by the
compiler against the constructor, and wins over the signature. The explicit style stays
explicit: `.toClass(Adapter, [Ports])` and `.handledBy(Handler, [Ports])` list what a class
is given, which is what a module file is for. The domain declares
nothing: aggregates, entities, value objects and domain events carry no decorator. Decorators
work in both decorator modes of TypeScript, so a project bound to the legacy mode by
class-validator or NestJS uses the same ones. The explicit style (`<context>.module.ts`
listing the bindings) remains available and can be mixed in.

The handler of the `PayInvoiceCommand` of [section 2](#2-canonical-tree): its decorator is its
registration, its constructor is the list of what it is given, and it ends with the save.

<!-- checked sample -->
```ts
import { AggregateRoot, AuthorizedCommand, Clock, ConceptError, Repository } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';

declare class Invoice extends AggregateRoot<string> {
  pay(at: Date): void;
}

declare class PayInvoiceCommand extends AuthorizedCommand<void> {
  readonly invoiceId: string;
}

declare class InvoiceError extends ConceptError {
  static notFound(invoiceId: string): InvoiceError;
}

// domain/repositories/invoice.repository.ts: the port is the injection token
export abstract class InvoiceRepository extends Repository<Invoice> {}

// application/commands/pay-invoice/pay-invoice.handler.ts
@CommandHandler(PayInvoiceCommand)
export class PayInvoiceHandler implements CommandHandler<PayInvoiceCommand> {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: PayInvoiceCommand): Promise<void> {
    const invoice = await this.invoices.findById(command.invoiceId);

    if (invoice === undefined) {
      throw InvoiceError.notFound(command.invoiceId);
    }

    invoice.pay(this.clock.now());

    await this.invoices.save(invoice);
  }
}
```

`ddd-ts-kit docs` reads that constructor and writes, in the generated file of the context,
`injected(PayInvoiceHandler, [InvoiceRepository, Clock])`: nothing else repeats it.

**Error reporting.** Unexpected failures go to the `ErrorReporter` port, from outside the
use cases: a response answered 5xx, a command failing on something that is not a business
refusal, an integration event buried after its retries, a failed job, a crash of the process.
A `DomainError` is an answer, not an incident, and is not reported. One failure is one
report, by the first boundary that sees it, carrying the correlation id and the trace id and
nothing personal beyond the actor's identifier.

**Scheduled jobs.** A job run by time is declared with
`@Scheduled('<context>.<job>', { every } or { cron, timeZone })` in
`application/scheduling/` and does one thing: it sends a command. It runs in its own
execution scope (origin `schedule`, a system actor named after the job, a fresh correlation
id), so it is logged, measured and audited like any other unit of work. Across several
instances a lock keeps an occurrence to one run, best effort: an occurrence may run twice or
not at all, so the job or its command is idempotent, and `execution.scheduledAt`, never the
clock, says which period the work is for. Jobs can run in the API process or in a dedicated
worker, and a context extracted as a service takes its jobs with it.

The job of the example application that sends the reminders falling due, every 15 minutes:

<!-- checked sample -->
```ts
import { AuthorizedCommand, systemActor, type Actor, type CommandBus } from '@ddd-ts-kit/kernel';
import { Scheduled, type JobExecution, type ScheduledJob } from '@ddd-ts-kit/kernel/declarations';

declare class SendDueRemindersCommand extends AuthorizedCommand<void> {
  constructor(actor: Actor, asOf: Date);
}

// application/scheduling/send-due-reminders.job.ts
@Scheduled('notification.send-due-reminders', { every: '15m' })
export class SendDueRemindersJob implements ScheduledJob {
  constructor(private readonly commands: CommandBus) {}

  async run(execution: JobExecution): Promise<void> {
    // The occurrence the run is for, never the clock: a late or repeated run sends the same reminders.
    await this.commands.execute(
      new SendDueRemindersCommand(systemActor('notification.send-due-reminders'), execution.scheduledAt),
    );
  }
}
```

**Background jobs.** Work a use case hands to a worker, to run later and outside of its
request, is a background job: a class with a static `jobName` (`<context>.<job>`), declared
with `@Background({ maxAttempts, timeout, lease })`, that triggers use cases like a scheduled
job. A use case enqueues it on the `JobQueue` port of the kernel, in its unit of work: with a
database the job is a row of the jobs table of its context, written by the transaction of the
command, so a command that rolls back leaves no job and one that commits loses none. The queue
of a job is its context, and a worker consumes the queues of the contexts it is given. Delivery
is at least once (a lease that the worker extends by heartbeats brings back the job of a worker
that died), so the job is idempotent and a long one saves a checkpoint to resume from. The run
continues the correlation, the actor, the tenant and the trace of the work that enqueued it.
See [Background jobs](concepts/background-jobs.md).

**State machines.** The lifecycle of an aggregate with a status is declared once, in
`domain/state-machines/<aggregate>.state-machine.ts`, with `defineStateMachine` of the kernel:
its states (the values of a closed vocabulary), the states it is created in, the transitions
named after the intention methods, their guards, and the refusal of a forbidden transition from
a static factory of the concept error. The aggregate asks it the next status
(`lifecycle.next(this.state.status, 'confirm')`) instead of testing its status by hand
(`lifecycle/status-through-machine`), and `CONTEXT.md` shows the diagram drawn from it.
See [State machines](concepts/state-machines.md).

**Process managers.** A long-running process that reacts to events, keeps a state of its own
and sends commands is a class of `application/processes/<name>.process.ts` with a static
`processName` and `isState`: each step is a function of its state and of what happened that
answers a decision (the next state, the commands, the timeouts armed or disarmed, its end). The
`ProcessRunner` port runs a step in one unit of work: it loads the instance the event correlates,
saves its state with optimistic concurrency (`ProcessStore`), arms each timeout as a delayed
background job of the context, and sends the commands. Event handlers of the context call it;
the timeout job of the process calls it with the job id, so a disarmed or replaced timeout never
runs. A process never writes an aggregate itself (`process/sends-commands-only`).
See [Sagas and process managers](concepts/sagas-and-process-managers.md).

**Ports and adapters.** A port is named for what the application needs
(`PaymentGateway`), not for the technology (`StripeClient`). Each port has a fake in `test/fakes/`.

**Errors.** Expected business failures are `DomainError`s with codes; presentation maps codes to
transport statuses in one place. Infrastructure faults are plain errors and become a 5xx.
Messages of caught errors never go into logs or spans (they quote data).

A context has one error class per concept of its language (`AppointmentError`, `CalendarError`),
which extends `ConceptError` of the kernel, and each refusal is a static factory of that class,
named in the words of the business: the code that refuses reads as a sentence, and the refusals
of a concept are read in one file. The refusal is about the concept the caller asked for, not
the class that detects it: a calendar that finds no free slot refuses with
`AppointmentError.slotTaken`. The refusals of a value object are factories of the concept it
describes (`PersonError.invalidEmail(raw)`), thrown by its `create` as an aggregate throws its own
(`"stack.valueObjects": "throwing"`, what `init` writes), or returned in a `Result` that the
caller unwraps under `"result"`, the form of a config without the key. A
factory takes the facts of the refusal as typed parameters, more than three as one typed object,
writes the message, and sets one code.

- **The code is the contract.** It is a closed vocabulary: `CodeOf<typeof AppointmentError>` is
  the union of the codes its factories set, `AppointmentError.is(error)` narrows to a union a
  `switch` on `error.code` exhausts, and `isRefusal(error, 'SLOT_TAKEN')` knows a refusal
  whatever its class. The HTTP mapper, the OpenAPI document, the audit trail, the spans, the logs
  and the tests key on the code alone; nothing downstream names the class or the factory of one
  refusal.
- **The facts travel with the error, and are private.** `error.facts` holds what the factory was
  given, as plain data (text, numbers, booleans, dates, lists of them), for the code that catches
  it and for the tests. A fact leaves the process only when its factory names it,
  `.exposing('startsAt')`: the problem document then carries it under `facts`. Nothing is exposed
  by default, and nothing that identifies a person is. The audit trail and the spans record the
  code alone, and no logger writes the facts. The message is answered as `detail`: it says
  nothing the caller did not send.
- **A class that grows is a concept to split.** A file holds at most 350 lines, some twenty
  factories. An error class that nears it serves two concepts: split it along a term of the
  glossary (`BookingError` for the refusals of taking a slot, `AppointmentError` for the life of
  the appointment), never along a technical line (`AppointmentValidationError`, `AppointmentError2`).
- **Two forms.** `"stack.refusals": "factories"` is what `init` writes, and what the `errors/*`
  rules judge. A config without the key was written when an error was a class built with `new`
  (`class SlotTakenError extends DomainError { readonly code = 'SLOT_TAKEN' }`): it is read as
  `classes`, nothing new is reported, and both forms run in either. `ddd-ts-kit error-factories`
  moves a project: `--plan` proposes a concept for each class, `--apply` writes the factories,
  merges the specs, rewrites every usage and sets the key.

<!-- checked sample -->
```ts
import { ConceptError, type CodeOf } from '@ddd-ts-kit/kernel';

// domain/errors/appointment.error.ts
export class AppointmentError extends ConceptError {
  static slotTaken(calendarId: string, startsAt: Date) {
    return AppointmentError.refusal(
      'SLOT_TAKEN',
      `The slot starting at ${startsAt.toISOString()} is already held.`,
      { calendarId, startsAt },
    ).exposing('startsAt');
  }

  static ended(appointmentId: string, status: string) {
    return AppointmentError.refusal(
      'APPOINTMENT_ENDED',
      `Appointment ${appointmentId} is ${status} and does not change any more.`,
      { appointmentId, status },
    ).exposing('status');
  }
}

// The closed vocabulary of the concept: 'SLOT_TAKEN' | 'APPOINTMENT_ENDED'
export type AppointmentCode = CodeOf<typeof AppointmentError>;

// Code that catches a refusal keys on its code: the switch is exhaustive, each case knows its facts.
export function nextStep(error: unknown): string | undefined {
  if (!AppointmentError.is(error)) {
    return undefined;
  }

  switch (error.code) {
    case 'SLOT_TAKEN':
      return `Choose a slot other than ${error.facts.startsAt.toISOString()}.`;
    case 'APPOINTMENT_ENDED':
      return `Book again: this appointment is ${error.facts.status}.`;
  }
}
```

Answered over HTTP, the refusal is a problem document that carries the code and the facts its
factory exposed, and nothing else: `calendarId` stays in the process.

**Integration events.** The only way two contexts communicate. Each event is declared once in
the producer's `published-language/` with `defineIntegrationEvent({ type, version, payload })`:
the declaration gives the payload type, validates what is published and consumed, and feeds
the generated event catalog and AsyncAPI document. Versioned envelope (`IntegrationEvent`),
additive changes only inside a version, at-least-once delivery, idempotent consumers. The
provider is technology-agnostic: any `EventBus` (`IntegrationEventPublisher` and
`IntegrationEventSubscriber`), in-memory by default, a broker or queue service through an
adapter that passes the provider contract suite, chosen in the composition root. With a
database, events leave through a transactional outbox: stored in the transaction of the
command, relayed afterwards.

<!-- checked sample -->
```ts
import { defineIntegrationEvent, type PayloadOf } from '@ddd-ts-kit/events';
import { AuthorizedCommand, systemActor, type Actor, type CommandBus, type IntegrationEvent } from '@ddd-ts-kit/kernel';
import { IntegrationEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { z } from 'zod';

// billing/published-language/invoice-paid.v1.integration-event.ts: declared once, by the producer
export const invoicePaidV1 = defineIntegrationEvent({
  type: 'billing.invoice.paid',
  version: 1,
  description: 'An invoice was paid in full.',
  payload: zodSchema(z.object({ invoiceId: z.string(), orderId: z.string(), paidAt: z.iso.datetime() })),
});

export type InvoicePaidV1 = PayloadOf<typeof invoicePaidV1>;

declare class ReleaseShipmentCommand extends AuthorizedCommand<void> {
  constructor(actor: Actor, orderId: string, cause: string);
}

// shipping/application/integration/handlers/billing-invoice-paid.integration-handler.ts
@IntegrationEventHandler(invoicePaidV1, { consumer: 'shipping.billing-invoice-paid' })
export class BillingInvoicePaidIntegrationHandler {
  // Read by the generated event catalog: who consumes what.
  static readonly eventType = invoicePaidV1.type;

  readonly actor = systemActor('shipping.billing-invoice-paid');

  constructor(private readonly commands: CommandBus) {}

  async handle(event: IntegrationEvent<InvoicePaidV1>): Promise<void> {
    // Delivered at least once: the consumer name scopes the deduplication, the event id makes the command idempotent.
    await this.commands.execute(new ReleaseShipmentCommand(this.actor, event.payload.orderId, event.id));
  }
}
```

**Outbox, by transport.** Publishing an integration event and committing the state change it
describes must succeed or fail together. The rule is one: the handler writes the event to the
outbox in the transaction of the command, a relay publishes it afterwards, the consumer
deduplicates. What varies with the tools is the relay and the consumer side:

| Transport | Relay | Consumer side |
|---|---|---|
| same process, no broker | polling relay to the in-memory bus (or woken by the database: PostgreSQL `LISTEN/NOTIFY`) | processed-event store in the consumer's transaction |
| RabbitMQ and other queue brokers | polling relay publishing with publisher confirms, mark published on confirm | durable queue per consumer, manual ack after commit, dead-letter exchange after bounded retries |
| Kafka and other logs | polling relay, or change data capture reading the outbox table (Debezium outbox router); key = aggregate id for per-aggregate order | consumer group per consumer, offset committed after the handler's transaction, bounded retries in place then a dead-letter topic, processed-event store for redelivery |
| NATS JetStream, Redis Streams | polling relay publishing with an acknowledgement (on JetStream the event id is the message id, so the stream drops a relay retry) | one durable consumer (JetStream) or consumer group (Redis) per consumer and event type, explicit acknowledgement after commit, bounded delayed redeliveries then a dead-letter stream |
| cloud queues and topics (SQS/SNS, Pub/Sub) | polling relay, batch publish | visibility timeout above the handler's worst case, redrive policy to a dead-letter queue |

Without a database there is nothing to be atomic with, and the in-memory bus alone is enough.
Change data capture is a relay strategy, not a way around the outbox table.

**Extractable contexts.** A bounded context is a deployable unit in waiting. Moving one to its
own service must be a change of composition root and adapters, never of domain or application
code. Hence: one database schema per context and no cross-context foreign key, join or
transaction; collaboration through integration events, and for a synchronous need a port in
the caller (`kind: gateway`) whose adapter is in-process today and an HTTP or RPC client
tomorrow; configuration read through the platform, namespaced by context; no shared mutable
state. `src/apps/<context>/main.ts` composes one context with the kernel and the platform, and
a generated architecture test boots every context alone to prove it stays true.

**Authentication and authorization.** Three separate responsibilities, three places:

- *Authentication* (who is calling) is a platform concern at the boundary: an adapter of the
  `Authenticator` port verifies the credential and produces a `Session` holding the `Actor`
  (subject, tenant, roles or attributes, never the raw token) and how it authenticated.
  Routes and integration event handlers put the actor in the command or query. Every route declares its
  `security`; the type refuses a route that does not.
- *Authorization* (may this actor do this, on this) is an application concern: each context
  declares its permissions in `application/authorization/<context>.permissions.ts`, each
  command and query names the permission it requires, and a bus middleware asks the
  `Authorizer` port before the handler runs. Deny by default. Rules that need the state of the
  aggregate (only the author may edit, not after closing) are policies in
  `application/authorization/*.policy.ts`; the handler asks them, once the aggregate is
  loaded, through the `Access` port of `@ddd-ts-kit/auth`
  (`access.authorize(command.actor, permission, element)`).
- *Invariants* stay in the domain: "an invoice cannot be paid twice" is not a permission.

The authorization model is the project's choice, behind the one port: roles (RBAC), policies
over attributes (ABAC), or relationships in the manner of Google Zanzibar (ReBAC: tuples
`object#relation@subject`, permissions derived by rewriting, check and list operations), in
process or delegated to a dedicated service. Changing model changes an adapter and the
permission definitions, not the handlers.

*The current actor.* Use cases get it explicitly, as data of the command or query. Searches are
filtered by passing the access scope of the actor (`access.scope(actor, permission, type)`)
to the read port, never by filtering in memory after loading. Every unit of work (a request, a consumed event, a
scheduled job) runs inside an `ExecutionScope` opened at the boundary, holding the
`ExecutionContext`: correlation and causation ids, actor, session, tenant, origin.
Infrastructure that needs any of it without being handed it (audit columns, tenant scoping of
every query, log fields, the correlation id stamped on published events) reads the scope;
`ActorContext` is a view of it. Domain and application code never read it.

**Standard interfaces.** The kernel defines the shapes every project shares, so adapters and
tooling interoperate: `Actor`, `Session`, `ExecutionContext`, `Logger`, `Metrics`, `Cache`,
`Lock`, `RateLimiter`, `JobScheduler`, `JobQueue`, `ErrorReporter`, `CacheInvalidation` and `CachePurger`, `Page` and `PageRequest`, `AuditStamp`, `TenantScoped`, the audit
ports `AuditTrail` and `AuditReader` with their `AuditEntry`, next to `Clock`, `IdGenerator`
and `UnitOfWork`. A project extends them without forking, by augmenting the extension interfaces
the kernel leaves open (`SessionExtensions`, `ExecutionContextExtensions`, ...). A project
that needs a concept of this kind uses the standard one; a parallel home-made `UserContext`
or `ILogger` is a defect.

**Cross-cutting behaviour.** Logging, metrics, tracing, retry, timeout, circuit breaking and
caching are never written inside domain or application code. They are applied from outside,
in this order of preference: wrappers given from outside, for every binding of a kind by the
platform (`builder.around(['external', 'gateway'], ...)`), or for one adapter on its
declaration or its binding (`aspects` of `@Adapter`, `.with(retry(...), timeout(...))`);
bus middlewares for what concerns every use case; and, for an adapter whose policy is part of
its definition, a standard decorator on the adapter class in `infrastructure/` or `platform/`.
None of the three is allowed in `domain/` or `application/`. Tracing is one more layer of
the same kind, wired once by the platform: `kernelModule({ instrumentation: traceApplication() })`
puts the spans around the buses, the bindings, the domain events, the publications, the
consumers and the jobs, `tracedRoutes()` around the routes and `tracedPublisher(bus)` around
what the outbox relay delivers with. What an aspect records follows
the tracing rule: class, method, context, duration, error code; never arguments, results or
error messages.

**Deviations.** The architecture is not negotiable case by case, but it can be changed
deliberately. Choosing among supported options (ORM, broker, authorization model, framework)
is the project owner's call. Bypassing a rule is different: it is either refused, or recorded
as a decision (`docs/adr/`), with the reason, the scope and the condition for removing it,
and referenced from the suppression or the config entry. A shortcut that is not written down
is a defect, whoever asked for it.

**Standard persistence shapes.** Audit columns are named `created_at`, `created_by`,
`updated_at`, `updated_by` and the tenant column `tenant_id` in every project, written from
the execution scope by the repository adapter through the kernel helpers. Searches use the
kernel `Page` and `PageRequest`; a cursor always ends on a unique tie-breaker so paging is
stable.

**Persistence.** Repositories are ports of the domain. Drizzle on PostgreSQL is the
default adapter family, one database schema per context; Knex, Prisma and TypeORM have
adapter packages too, and any other mature ORM or database is an adapter of the same interfaces and passes the same repository contract suite. Rows never
leave `infrastructure/persistence/`: a mapper translates to and from the aggregate.

**Validation.** Two different things. Input shape is validated at the boundary (presentation)
with the schema library of the project, behind the `Schema` port. Business rules are enforced
in the domain and never depend on a validation library.

**Contract.** The OpenAPI document is generated from route definitions and committed. CI
regenerates it and fails on a diff. It is never edited by hand.

**Tracing.** Non-invasive: no tracing import in `domain/` or `application/`; the platform
wires it once. One action is one trace: the request, the use case, each call to a repository,
a gateway or an outside system, the domain events dispatched at the end of the unit of work
and their handlers (before the commit, then after it), the outbox append, then, later and in
the same trace, the publication by the relay and each consuming
context with the commands it sends. A scheduled job is a trace of its own; a background job
continues the trace of the work that enqueued it, one `job <name>` span per attempt. Span names are
stable and low in cardinality (`command BookAppointment`, `repository
AppointmentRepository.save`, `process notification.appointment-booked`: `<kind> <Name>` for a
use case, `<kind> <Port>.<method>` for a binding, `process <consumer>` for a consumed event); health, readiness
and documentation routes and plumbing produce none. A span carries class, method, context,
outcome and an error code, the root also the correlation id and the origin, never arguments,
results, error messages or anything about the actor. The same correlation id is on log
lines, audit entries and error reports.

## 5. Tests

| Kind | Target | Doubles |
|---|---|---|
| unit | aggregates, value objects, domain services | none |
| unit | handlers | fakes of ports and repositories (no mocking library needed) |
| integration | adapters against the real dependency | none |
| contract | each fake and each adapter pass the same port contract suite | |
| architecture | `ddd-ts-kit check` | |

Tests name behaviour in business language, with Vitest by default.

**Fakes, not mocks.** A fake is a working in-memory implementation of a port, kept in
`test/fakes/` and held to the same contract suite as the real adapter. Mocks, spies and module
mocking are avoided: they assert calls instead of outcomes and break on refactoring. Assert
the state of the fake, the events on the in-memory bus, the returned value.

```ts
// Instead of: a mock, which checks that a call was made, and breaks when the call changes
const charge = vi.fn();
await new ChargeInvoiceHandler({ charge }).execute(command);
expect(charge).toHaveBeenCalledWith('invoice-1', 12000); // test/no-mocks
```

<!-- checked sample -->
```ts
import { expect, it } from 'vitest';

declare abstract class PaymentGateway {
  abstract charge(invoiceId: string, amountInCents: number): Promise<void>;
}

declare class ChargeInvoiceHandler {
  constructor(payments: PaymentGateway);
  execute(command: { readonly invoiceId: string; readonly amountInCents: number }): Promise<void>;
}

// test/fakes/payment-gateway.fake.ts: a working implementation, held to the contract suite of the port
class PaymentGatewayFake implements PaymentGateway {
  readonly charges: { readonly invoiceId: string; readonly amountInCents: number }[] = [];

  async charge(invoiceId: string, amountInCents: number): Promise<void> {
    this.charges.push({ invoiceId, amountInCents });
  }
}

// Write: assert the outcome, what the provider was left with
it('charges the amount of the invoice', async () => {
  const payments = new PaymentGatewayFake();

  await new ChargeInvoiceHandler(payments).execute({ invoiceId: 'invoice-1', amountInCents: 12000 });

  expect(payments.charges).toEqual([{ invoiceId: 'invoice-1', amountInCents: 12000 }]);
});
```

**Builders.** Test data comes from builders in `test/builders/`: `anOrder().paid().withLine(aLine().of('sku-1')).build()`.
A builder has valid defaults, intention-revealing methods in the ubiquitous language, and
builds through the aggregate's public API so a test can never start from an invalid state.
A test states only what matters to the rule it checks.

**Scenarios.** Aggregate specs read given / when / then: past events or a built state, one
intention, then the recorded events or the raised error.

<!-- checked sample -->
```ts
import { AggregateRoot } from '@ddd-ts-kit/kernel';
import { Builder, given, sequence, type Defaults } from '@ddd-ts-kit/testing';
import { it } from 'vitest';

declare class Invoice extends AggregateRoot<string> {
  static create(id: string, customerId: string): Invoice;
  pay(at: Date): void;
}

interface InvoiceIngredients {
  readonly id: string;
  readonly customerId: string;
  readonly paidAt: Date | undefined;
}

// test/builders/invoice.builder.ts: valid defaults, methods in the words of the business
export class InvoiceBuilder extends Builder<InvoiceIngredients, Invoice> {
  ofCustomer(customerId: string): this {
    return this.with('customerId', customerId);
  }

  paid(at: Date = new Date('2026-01-05T10:00:00.000Z')): this {
    return this.with('paidAt', at);
  }

  protected defaults(): Defaults<InvoiceIngredients> {
    return { id: sequence('invoice'), customerId: 'customer-1', paidAt: undefined };
  }

  // Through the public API of the aggregate: a test cannot start from a state the model refuses.
  protected construct({ id, customerId, paidAt }: InvoiceIngredients): Invoice {
    const invoice = Invoice.create(id, customerId);

    if (paidAt !== undefined) {
      invoice.pay(paidAt);
    }

    return invoice;
  }
}

export function anInvoice(): InvoiceBuilder {
  return new InvoiceBuilder();
}

// test/unit/invoice.aggregate.spec.ts: the events recorded while building are not asserted
it('records the payment of an invoice', () => {
  given(anInvoice())
    .when((invoice) => invoice.pay(new Date('2026-01-05T10:00:00.000Z')))
    .thenEventNames(['billing.invoice.paid']);
});

it('refuses to pay an invoice twice', () => {
  given(anInvoice().paid())
    .when((invoice) => invoice.pay(new Date('2026-01-06T10:00:00.000Z')))
    .thenError('INVOICE_ALREADY_PAID');
});
```

## 6. Clean code

After Robert C. Martin's *Clean Code*, applied to TypeScript.

**Names.** From the ubiquitous language, pronounceable, searchable, one word per concept
across a context. A class is a noun of the domain, a method a verb of the domain, a boolean a
predicate (`isOverdue`). No encoding, no technical suffix in the domain.

**Functions.** Small, one thing, one level of abstraction. At most three parameters; beyond
that the parameters are a concept that deserves a type. No flag argument, no output argument.
Command or query, never both: a function changes state or answers, not both.

**Files.** One exported class, interface or function per file, named after it; the only
companions are the types of its own signature. A file never exceeds 350 lines: past that it
holds more than one responsibility. Index files only re-export.

**Layout.** A blank line before every `return` unless it is alone in its block, and between
the logical blocks of a function: after a group of declarations, around `if`, `for`, `try`.
Every `if`, `else`, `for`, `while` and `do` has braces and its body on its own lines: a branch
is visible at a glance, and a statement added to it later cannot silently fall outside it.
Where everything else goes is not a matter of taste: the formatter lays out every file, at a
line width of 120. Class members are `private`, not `#`.

**Size.** A function does one thing and stays short: 30 lines by default, never more than 100.

**Order (the stepdown rule).** A file reads like a newspaper: the high-level intention at the
top, details below. In a class: static factories, then public methods, then private methods,
each private method placed after its first caller. In a module: the exported function first,
its helpers after it in the order they are called.

**Comments.** The code says what; a comment is kept only for what the code cannot say: why a
non-obvious decision was taken, a warning about a consequence, the reference of an external
rule (law, RFC, vendor quirk), a public API contract. No comment that paraphrases a name, no
commented-out code, no banner, no history, no author. A comment that explains what a block
does is a function name waiting to be extracted.

**Errors.** Exceptions or `Result`, never error codes mixed with return values, never `null`
for "failed". One error class per concept, a named factory per refusal, the facts as data.

**Types.** `strict` TypeScript. No `any`, no non-null assertion, no type assertion outside
mappers, no suppressed diagnostics without a written reason.

**Testability by construction.** Domain and application are pure with respect to the outside
world: time through `Clock`, identifiers through `IdGenerator`, every I/O through a port,
dependencies received by constructor. A class that needs a mock of a module to be tested is
breaking one of these rules.

## 7. Test levels

| Level | What runs | Data | Speed |
|---|---|---|---|
| domain | aggregates, value objects, services, no double at all | builders | milliseconds |
| application | real handlers through the in-memory buses, fakes for every port, `FixedClock` | builders | milliseconds |
| adapter | one real adapter against its real dependency, plus the contract suite | builders | seconds |
| end to end | the whole application with real adapters, driven through HTTP and the event bus | builders with generated data (seeded faker), created through the public API | seconds |

The same builders serve every level. End-to-end tests use generated, realistic data with a
fixed seed that is printed on failure, so a failing run can be replayed exactly. They assert
what a client observes (responses, published events), never the database directly.

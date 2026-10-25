---
paths:
  - "{{config.contextsDir}}/*/presentation/**"
  - "{{config.contextsDir}}/*/*/presentation/**"
  - "openapi/**"
  - "scripts/openapi.ts"
{{#if sdk.on}}
  - "clients/**"
{{/if}}
---

# Presentation layer

{{#if routes.controllers}}
- A route is one class with one method: `<use-case>.controller.ts` in `presentation/http/<resource>/<use-case>/`, carrying `@Controller` of `@ddd-ts-kit/http`. The decorator is the single statement of the route (method, path after the prefix of its group, schemas, response, error codes); `handle` receives what the schemas produce and returns the declared body, and the compiler refuses anything else (`presentation/controller-shape`).
- A controller decides nothing: it is given the bus of its method (`CommandBus` for POST, PUT, PATCH, DELETE; `QueryBus` for GET), a request mapper and a serializer, nothing else (`presentation/controller-delegates`). `<use-case>.mapper.ts` turns the request and its actor into the command or the query; `<use-case>.serializer.ts` turns the result into the body. Both are optional.
- A route group (`<resource>.routes.ts`, `@RouteGroup`) gives its controllers a prefix, a tag and guards. A controller names its group, or says `guards: [Public]`: nothing is open by omission (`authz/declared`).
- A guard is a control at the edge (authenticated, a role, the tenant of the path); a permission stays on the use case (`@Requires`), where a job and an event handler meet it too. A guard of the project is a declared class in `presentation/http/guards/*.guard.ts` and never imports `domain/`, `infrastructure/`, a repository or the command bus (`presentation/guard-at-the-edge`).
{{/if}}
{{#if routes.nest}}
- A route is a Nest controller the kit serves: `<use-case>.controller.ts` in `presentation/http/<resource>/<use-case>/`, `@Controller()` and `@KitRoutes({ group: <Resource>Routes })` on the class, `@Post`, `@Get`... of Nest on its method, which names the route (its `operationId`) after the method, and `@KitRoute({ request, response, errors })` of `@ddd-ts-kit/http/nest` for what Nest does not say. The method reads `@Param()`, `@Query()`, `@Headers()`, `@Body()` typed by the DTO classes beside it, and the caller with `@CurrentActor()`; it builds the command or the query and sends it through the bus the constructor injects (`@Inject(CommandBus)`), nothing else: the buses are the only providers the platform gives Nest for the controllers. Nest builds the controller (the module of the context lists it under `controllers`), the kit serves it: guards of the group, validation by `request`, problem documents, the contract.
- A method takes and answers what its signature says: a part of the request taken whole by a DTO class (`@Body() body: <UseCase>Body`), an answer that is a DTO class (`Promise<<UseCase>Answer>`), `Accepted` or `void`, which `ddd-ts-kit` reads into the generated `<context>.controllers.ts` the module lists (`nest/controllers-current` keeps it current); any other type is given in `request` or `response` of `@KitRoute`. The raw request and answer of Nest (`@Req`, `@Res`, `@Header`), its guards, pipes, interceptors and filters are refused (`nest/no-parallel-pipeline`): the kit would not run them.
{{/if}}
{{#if routes.functions}}
- A route validates the shape of the input, builds a command or a query with the actor, executes it through `CommandBus` or `QueryBus` (never a handler class) and maps the answer. Nothing else.
{{/if}}
{{#if http.nest}}
- Nothing of Nest's request pipeline in a context: no controller Nest serves, guard, pipe, exception filter, interceptor, raw request or `HttpException` of Nest, no `@nestjs/swagger`, `@nestjs/cqrs` or `@nestjs/passport` (`nest/no-parallel-pipeline`). The routes of the kit do not go through that pipeline, and a Nest controller is a route the kit does not see: no declared security, no problem codes, missing from the contract. A route is the kit's, a right is the permission of the use case, a refusal comes from the code list; each finding names the tool of the kit to use. A Nest controller stays a Nest controller once the kit serves it: `@KitRoute` of `@ddd-ts-kit/http/nest` on each method (its `operationId`, `summary`, `guards`, `errors`), `@CurrentActor()` for the caller, served by `createControllersModule`. Nest stays in the platform, for what reaches no use case.
{{/if}}
- Imports `application/` (and domain types for mapping), never `infrastructure/` (`layer/presentation-no-infrastructure`).
- Input shape is validated here with the schema library of the project, behind the `Schema` port. Business rules are not validated here.
{{#if refusals.named}}
- Every route says who may call it (its group or its guards for a controller, `security` for a function) and the codes of the refusals it can answer in `errors`, as the code list of its context, `<context>.codes.ts`, lists them (`errors/known-code`); the mapping from code to status lives in one place, the error mapper. A client reads the `code`, under `facts` only what a factory exposed, and the message of the refusal as `detail` unless it quotes a fact that is not exposed.
{{/if}}
{{#if refusals.factories}}
- Every route says who may call it (its group or its guards for a controller, `security` for a function) and the codes of the refusals it can answer in `errors`, as their factories set them (`errors/known-code`); the mapping from code to status lives in one place, the error mapper. A client reads the `code`, under `facts` only what a factory exposed, and the message of the refusal as `detail` unless it quotes a fact that is not exposed.
{{/if}}
{{#if refusals.classes}}
- Every route says who may call it (its group or its guards for a controller, `security` for a function) and the `DomainError` codes it can answer in `errors`; the mapping from code to status lives in one place, the error mapper.
{{/if}}
- No role or ownership test in a controller or a route (`authz/in-application`): a guard of the group asks for a role at the edge, the bus asks for the permission, a policy decides on loaded state. A field reserved to some callers is marked on its schema, `withFieldAccess(schema, { field: { read, write } })`, never by an `if` on a role (`authz/fields-by-schema`).{{#if presentation.negotiated}} Other media types are `produces` and `consumes` of the declaration (`generate representation`), from the same schema. A streamed export is `everyPage` over the search query of one page, sent through the bus page by page, never a query handler that answers a lazy list.{{/if}}{{#if presentation.forms}} A form is `defineForm` hints next to the body (`generate form`): shape and presentation, never a business rule; it `requires` the permission of its use case, asked as its `@Requires` asks it.{{/if}}
- Request and response types are presentation types, one class or schema per file next to the controller (`*.body.ts`, `*.params.ts`, `*.answer.ts`...; `*.dto.ts` for function routes and under `shared/`): never an aggregate, never a row.
{{#if schemas.shared}}
- A shape several routes use is declared once, in `presentation/http/shared/<name>.schema.ts` (`npx ddd-ts-kit generate schema <context> <Name>`), or in `presentation/` of the shared kernel when several contexts answer with it (`generate schema shared-kernel <Name>`), and shared: the contract documents it once and every route refers to it. A route takes the part it needs from it (pick, omit, partial, extend) instead of copying it, and answers an identifier with `acceptedSchema` of `@ddd-ts-kit/http` (`schema/no-duplicate-shape`). Only presentation layers import a schema (`schema/presentation-only`).
{{/if}}
- A read declares how caches may keep its answer in `cache` (its controller, its route group, or the spec of a function route): `private` for what a caller reads again, with `etag`; `public` only for what is the same for everybody, with `tags` naming the resources it shows. A route that knows its caller is `no-store` unless it says otherwise, and a `public` answer of such a route is refused unless `vary` names who calls (`Authorization`, `Cookie`) or the header its tenant is read from (`presentation/shared-cache-varies`, then the mount): never cache a decision of authorization across actors. A group policy reaches the reads of the group only. A write that must not overwrite a newer version declares `ifMatch` and hands `context.expectedVersion` to its command; the handler calls `expectVersion` (412). A change purges the answers it makes stale from a `before-commit` handler of its domain event, `CacheInvalidation.invalidate([cacheTag(...)])` (`platform.cacheInvalidation` on a platform wired by hand): the purge then runs after the commit, through the outbox. Every event that changes what a kept answer shows, its version included, purges it, not only the one the route is about.
- Never put the message of an unexpected failure in a response or a log.
- Files: the canonical tree of `presentation/http/` (`naming/suffix`, `tree/closed`): a folder per controller, `*.routes.ts` for the groups, `guards/`, `shared/`; function routes stay flat (`*.route.ts`, `*.dto.ts`).
- After a change, `npm run docs:generate` regenerates the contract, `openapi/openapi.yaml` (one file per document when `openapi.documents` of `ddd-ts-kit.config.json` splits it; JSON under `openapi.format: json`), committed with the route; CI fails on a difference. Never edit it by hand.{{#if sdk.on}} It regenerates the typed clients under `clients/` too (`npx ddd-ts-kit sdk`), committed with it.{{/if}}
- Contract with `/ddd-ts-kit:document`. Create with `npx ddd-ts-kit generate route <context> <UseCase> --method <M> --path <p> [--group <Name>] [--mapper] [--serializer] [--cache public|private|no-store] --json`, then `generate e2e <context> <UseCase>`; `generate route-group` and `generate guard` write a group and a guard.

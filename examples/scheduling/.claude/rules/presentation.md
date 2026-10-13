---
paths:
  - "src/contexts/*/presentation/**"
  - "openapi/**"
  - "scripts/openapi.ts"
---

# Presentation layer

- A route is one class with one method: `<use-case>.controller.ts` in `presentation/http/<resource>/<use-case>/`, carrying `@Controller` of `@ddd-ts-kit/http`. The decorator is the single statement of the route (method, path after the prefix of its group, schemas, response, error codes); `handle` receives what the schemas produce and returns the declared body, and the compiler refuses anything else (`presentation/controller-shape`).
- A controller decides nothing: it is given the bus of its method (`CommandBus` for POST, PUT, PATCH, DELETE; `QueryBus` for GET), a request mapper and a serializer, nothing else (`presentation/controller-delegates`). `<use-case>.mapper.ts` turns the request and its actor into the command or the query; `<use-case>.serializer.ts` turns the result into the body. Both are optional.
- A route group (`<resource>.routes.ts`, `@RouteGroup`) gives its controllers a prefix, a tag and guards. A controller names its group, or says `guards: [Public]`: nothing is open by omission (`authz/declared`).
- A guard is a control at the edge (authenticated, a role, the tenant of the path); a permission stays on the use case (`@Requires`), where a job and an event handler meet it too. A guard of the project is a declared class in `presentation/http/guards/*.guard.ts` and never imports `domain/`, `infrastructure/`, a repository or the command bus (`presentation/guard-at-the-edge`).
- Imports `application/` (and domain types for mapping), never `infrastructure/` (`layer/presentation-no-infrastructure`).
- Input shape is validated here with the schema library of the project, behind the `Schema` port. Business rules are not validated here.
- Every route says who may call it (its group or its guards for a controller, `security` for a function) and the codes of the refusals it can answer in `errors`, as their factories set them (`errors/known-code`); the mapping from code to status lives in one place, the error mapper. A client reads the `code`, under `facts` only what a factory exposed, and the message of the refusal as `detail` unless it quotes a fact that is not exposed.
- No role or ownership test in a controller or a route (`authz/in-application`): a guard of the group asks for a role at the edge, the bus asks for the permission, a policy decides on loaded state.
- Request and response types are presentation types, one class or schema per file next to the controller (`*.body.ts`, `*.params.ts`, `*.answer.ts`...; `*.dto.ts` for function routes and under `shared/`): never an aggregate, never a row.
- A read declares how caches may keep its answer in `cache` (its controller, its route group, or the spec of a function route): `private` for what a caller reads again, with `etag`; `public` only for what is the same for everybody, with `tags` naming the resources it shows. A route that knows its caller is `no-store` unless it says otherwise, and a `public` answer of such a route is refused unless `vary` names what it depends on (`presentation/shared-cache-varies`): never cache a decision of authorization across actors. A write that must not overwrite a newer version declares `ifMatch` and hands `context.expectedVersion` to its command; the handler calls `expectVersion` (412). A change purges the answers it makes stale from a `before-commit` handler of its domain event, `CacheInvalidation.invalidate([cacheTag(...)])`: the purge then runs after the commit, through the outbox.
- Never put the message of an unexpected failure in a response or a log.
- Files: the canonical tree of `presentation/http/` (`naming/suffix`, `tree/closed`): a folder per controller, `*.routes.ts` for the groups, `guards/`, `shared/`; function routes stay flat (`*.route.ts`, `*.dto.ts`).
- After a change, `npm run docs:generate` regenerates the contract, `openapi/openapi.yaml` (one file per document when `openapi.documents` of `ddd-ts-kit.config.json` splits it; JSON under `openapi.format: json`), committed with the route; CI fails on a difference. Never edit it by hand.
- Contract with `/ddd-ts-kit:document`. Create with `npx ddd-ts-kit generate route <context> <UseCase> --method <M> --path <p> [--group <Name>] [--mapper] [--serializer] [--cache public|private|no-store] --json`, then `generate e2e <context> <UseCase>`; `generate route-group` and `generate guard` write a group and a guard.

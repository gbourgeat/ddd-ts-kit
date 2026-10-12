# The OpenAPI contract

`openapi/openapi.json` is an output of the code: generated from the route definitions
(`@ddd-ts-kit/http`), whatever the HTTP framework and the validation library, and committed.
The API documentation is served on `/docs` (off in production unless `API_DOCS=true`).

## Change a route

1. Edit the declaration of the route (or create it: `npx ddd-ts-kit generate route <ctx>
   <UseCase> --method <M> --path <p>`). For a controller, the `@Controller({ .. })` decorator:
   a `summary`, the request schemas, the one `response` with its status, `errors` listing every
   domain error code the use case can raise; the `operationId` is the class name without
   `Controller`, and the security, the tags and the 401 and 403 responses come from its route
   group and its guards (`guards: [Public]` for an open route). For a function route, the
   `defineRoute` spec: `operationId`, one entry per response status, and `security` (the
   scheme of the project, or `false` for a public route).
2. Schemas describe shape and format only. Business rules stay in the domain.
3. Response schemas are presentation types. Never return an aggregate or an application
   object as is: map it, so the contract does not move when the model does.
4. A field with a fixed set of values is an enum in the schema, so clients get a type.
5. `npm run openapi:generate`, read `git diff -- openapi/`, commit code and contract
   together. The pipeline runs `npm run openapi:check` and fails on drift.

## Breaking or not

| Change | Breaking |
|---|---|
| new optional request field, new response field, new route | no |
| new required request field, stricter validation, removed or renamed field, changed type | yes |
| new error code or status on an existing route | yes for clients that enumerate errors |
| new enum value in a response | yes for clients with exhaustive switches |

A breaking change needs a new route version or a deprecation period (`deprecated: true` on
the old route) and a look at every known consumer before merging. Tightening validation on a
deployed API breaks clients that sent what used to be tolerated.

## Clients

Generate clients from the committed file with the tool of your choice
(`openapi-typescript`, `orval`, `openapi-generator`): generation is deterministic, so the
file is a stable input.

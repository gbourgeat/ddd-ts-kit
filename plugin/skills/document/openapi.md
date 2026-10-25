# The OpenAPI contract

`openapi/openapi.yaml` is an output of the code: generated from the route definitions
(`@ddd-ts-kit/http`), whatever the HTTP framework and the validation library, and committed.
The API documentation is served on `/docs` (off in production unless `API_DOCS=true`).
`openapi.format: "json"` in `ddd-ts-kit.config.json` writes JSON instead.

## Split the contract

When one document has too many routes, `openapi.documents` of the config splits it:
`[{ "name": "public", "title": "Public API", "groups": ["PeopleRoutes"], "contexts":
["scheduling"], "tags": ["audit"] }]`. A route belongs to a document when its route group (or a
group above it), its context or one of its tags is listed; a route may be in several on
purpose; a route in none stops `docs:generate` with its name. Each document is a file of its
own, `openapi/<name>.yaml`, self-contained (the schemas it uses are copied into it), and the
documentation page offers a selector between them. `npx ddd-ts-kit docs` writes the split into
`<platform>/http/openapi-documents.ts`, which the script and the page read: never edit it.

## Change a route

1. Edit the declaration of the route (or create it: `npx ddd-ts-kit generate route <ctx>
   <UseCase> --method <M> --path <p>`). For a controller, the `@Controller({ .. })` decorator:
   a `summary`, the request schemas, the one `response` with its status, `errors` listing every
   domain error code the use case can raise; the `operationId` is the class name without
   `Controller`, and the security, the tags and the 401 and 403 responses come from its route
   group and its guards (`guards: [Public]` for an open route). For a function route, the
   `defineRoute` spec: `operationId`, one entry per response status, and `security` (the
   scheme of the project, or `false` for a public route).
2. Schemas describe shape and format only. Business rules stay in the domain. A shape two
   routes use is declared once and shared (`npx ddd-ts-kit generate schema <ctx> <Name>`):
   the contract holds it once in `components.schemas` and each route points at it with `$ref`;
   a route derives the part it needs (pick, omit, partial, extend) instead of copying it. Under
   `"stack.schemas": "shared"`, `schema/no-duplicate-shape` reports a shape declared twice in one context.
3. Response schemas are presentation types. Never return an aggregate or an application
   object as is: map it, so the contract does not move when the model does.
4. A field with a fixed set of values is an enum in the schema, so clients get a type.
5. `npm run docs:generate`, read `git diff -- openapi/`, commit code and contract
   together. The pipeline runs `npm run docs:check` and fails on drift.

## Breaking or not

| Change | Breaking |
|---|---|
| new optional request field, new response field, new route | no |
| new required request field, stricter validation, removed or renamed field, changed type | yes |
| new error code or status on an existing route | yes for clients that enumerate errors |
| new enum value in a response | yes for clients with exhaustive switches |
| renamed `operationId` | yes: with `stack.rpc` `orpc` or `trpc`, a deployed client calls a procedure that answers 404; for the HTTP client, the function it calls is renamed at its next build |
| a `GET` route given another method | yes for a tRPC client: its query becomes a mutation |
| a route that now receives a file or a raw body | yes for an oRPC or tRPC client: the route no longer has a procedure |

A breaking change needs a new route version or a deprecation period (`deprecated: true` on
the old route) and a look at every known consumer before merging. A procedure has no deprecation
period: its name is the `operationId`, which one route holds at a time, so rename it only when
every oRPC or tRPC consumer is rebuilt and deployed with the change. Tightening validation on a
deployed API breaks clients that sent what used to be tolerated.

## Clients

`npx ddd-ts-kit sdk` (or `init --sdk`) generates a typed client per document of the contract,
a workspace package under `clients/<document>` with no runtime dependency: each operation
answers `{ ok, status, data | problem }`, `problem.code` typed as the codes `x-error-codes`
declares for that status, credentials given per security scheme. It records `"sdk"` in
`ddd-ts-kit.config.json` and wires the scripts: `docs:generate` regenerates the clients after
the contract, `docs:check` fails while one differs from it, `ci:build` builds them.

- After a route, a schema or an error code changes: `npm run docs:generate`, and commit the
  contract and `clients/` together. Never edit `clients/*/src` or a client README.
- An end-to-end spec may call the API through the client, by its package name, as a consumer
  does; the HTTP helpers stay for requests the contract does not describe.
- A new error code on a route changes the type of its outcome: a consumer with an exhaustive
  `switch` on `problem.code` fails to compile, which is the signal the table above calls breaking.
- With `stack.rpc` set to `orpc` (`init --rpc orpc`) or `trpc` (`init --rpc trpc`), the server
  also serves every route as a procedure named by its `operationId`, under `/rpc` or `/trpc`, and
  each client gains `./orpc` (the oRPC contract) or `./trpc` (the type of the tRPC router),
  written from the same OpenAPI document. Nothing more to declare: a route is still the one
  declaration, and a new `operationId` renames its procedure, which is breaking for an oRPC or
  tRPC consumer. What only HTTP carries (answer headers, uploads, files, streamed lists, XML and
  CSV) has no procedure answer: keep the HTTP client for it.
- Publishing is manual (`npm publish --workspace clients/<document>` after raising its
  version); set `sdk.name` and `sdk.access` first. The comparison with openapi-typescript, hey-api
  and orval, and the limits: https://github.com/gbourgeat/ddd-ts-kit/blob/main/docs/tools/client-sdk.md.

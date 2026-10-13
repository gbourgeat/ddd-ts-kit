# Contract pairs: an HTTP framework and a validation library

**Summary.** A project of this kit declares each route once, as a controller class with one
`handle` method, its schemas, its response and its error codes; an adapter mounts it on a
framework and the OpenAPI contract is generated from the same declaration. The framework and the
validation library are therefore two choices made at `init` and changed later without touching a
route's behaviour. Four pairs are generated and run end to end by the kit: Express and zod,
Fastify and TypeBox, Hono on Node and zod, NestJS and class-validator. oRPC was evaluated and is
not one of them. What separates the pairs is less speed than the team: what it already knows,
how it writes types, and how much of a framework it is ready to leave unused.

## What every pair keeps

Whatever the pair, these hold the same way, through one pipeline (`executeRoute`) and one suite
of behaviour tests run on every adapter:

| Invariant | How |
|---|---|
| one route, one class | `@Controller` on a class with one `handle`; the route group gives the prefix, the tags and the guards |
| guards at the edge, permissions on the use case | `guards` of the group or the controller; `@Requires` on the command, decided by the bus |
| refusals as problem documents | RFC 9457 `application/problem+json`, the stable `code` of the static factory, 422 with one issue per path for a refused input |
| error codes in the contract | `errors` of the controller, one problem response per status in the OpenAPI document |
| tracing | the request is the root span named after its route, the command, the repository and the events below it (asserted by the generated end-to-end spec) |
| one contract | OpenAPI 3.1 generated from the declarations, committed, checked for drift in CI; a shape declared once lands once in `components.schemas` ([shared schemas](validation.md)) |
| a typed client | `ddd-ts-kit sdk` writes it from the committed contract, whatever framework produced it ([client SDK](client-sdk.md)): a shared shape is one named type of the client, `Accepted` and `<Item>Page` included |

## The pairs

| Pair | `init` flags | Proven by |
|---|---|---|
| Express and zod 4 | the default (`--http express --validation zod`) | `contract-pairs.spec.ts`, `proven-stacks.spec.ts` |
| Fastify and TypeBox | `--http fastify --validation typebox` | `contract-pairs.spec.ts` |
| Hono on Node and zod | `--http hono` | `contract-pairs.spec.ts` |
| NestJS and class-validator | `--http nest --di nest --validation class-validator` | `contract-pairs.spec.ts` |

The end-to-end spec generates one project per pair, adds two command routes that nest one shape
declared with `generate schema`, installs the kit as published, and holds the project to zero
finding (the checker, ESLint, dependency-cruiser, knip), its unit specs, its end-to-end specs
(401, 403, 201 and the span tree of the request) and a contract regenerated, current, holding
the shared shape once and the `Accepted` answer of the platform. Other combinations are
generated, checked and type-checked by the matrix of `stacks.ts` (Fastify with zod among them,
and two added with this page: Hono with TypeBox and a Redis cache, Fastify with TypeBox on
Knex); only these four are run end to end.

"zod-openapi" in the request that started this page: `zod-openapi` (6.0.2) and
`@asteasolutions/zod-to-openapi` (9.1.0) exist to turn zod schemas into an OpenAPI document. The
kit does not need them: zod 4 writes its own JSON Schema (`z.toJSONSchema`, draft 2020-12, ids
from `.meta({ id })` as `$defs`), which the generator of `@ddd-ts-kit/http` places in the
document. That is the maintained equivalent, built into zod itself.

## Decision table

| | Express + zod | Fastify + TypeBox | Hono + zod | NestJS + class-validator |
|---|---|---|---|---|
| Types of a request | inferred from the schema (`Infer<typeof body>`) | inferred from the schema (`Static`) | inferred from the schema | the DTO class, written by hand |
| Composition of shapes | `.pick`, `.omit`, `.partial`, `.extend`, `.meta({ id })` | `Type.Pick`, `Type.Omit`, `Type.Partial`, `Type.Intersect`, `Type.Interface`, `$id` | as Express + zod | `pickClass`, `omitClass`, `partialClass` of the kit, `extends`, nested classes |
| Contract fidelity | high: zod writes its JSON Schema; transforms and refinements are not described | highest: the schema is JSON Schema | as Express + zod | good, through `class-validator-jsonschema`; custom validators need a converter |
| Issue codes for a client | zod's (`too_small`, `invalid_format`) | the JSON Schema keyword (`minLength`, `format`) | zod's | the constraint name (`isUuid`) |
| Decorators | none | none | none | legacy mode for the whole program |
| Ecosystem | the widest (middlewares, hiring) | plugins, hooks, pino built in | runs on Node, Bun, Deno and edge runtimes; Node only here | modules, DI, GraphQL, queues; the kit's routes bypass its pipes, guards and filters |
| Maintenance seen on npm (2026-10-13) | express 5.3.0, zod 4.6.5 | fastify 5.12.5, typebox 1.3.37 (published the day before) | hono 4.13.13, @hono/node-server 2.1.4 | @nestjs/core 12.1.2, class-validator 0.15.1, class-transformer 0.5.1 (2021) |
| Fits | a new team, a plain JSON API, the default | a team that wants the contract to be the schema itself, and fewer milliseconds of validation per request than class-validator | a team that may move the service to another runtime later, or that likes Web standard `Request` and `Response` | an existing Nest application adopting the kit context by context |

Size of the application does not pick the pair: the tree, the rules and the shared schemas carry
a large application the same way on all four. What grows with it is the number of schemas, so
the composition of shapes and the issue codes clients read matter more than the framework.

## Measured

`node pipeline/monorepo/measure-contract-pairs.mjs`, after `npm run build`. Node 24.21.0,
Linux x64, 20 cores, on a shared machine (load average about 10 during the runs): three runs,
the first of them without the warm-up round of 1,000 requests the script now makes; the range
is given where the runs disagreed. One body: a UUID, an optional text of 500
characters at most, and a nested shared `Slot` of two instants.

| Measure | zod | TypeBox | class-validator |
|---|---|---|---|
| OpenAPI document of 200 routes (ms) | 7.3 to 12.3 | 2.5 to 5.2 | 8.5 to 13.1 |
| One `parse` of a valid body (µs) | 0.49 to 0.68 | 6.2 to 11.2 | 5.3 to 8.6 |
| One request through `executeRoute`, in the process (µs) | 1.4 to 1.6 | 7.3 to 8.9 | 5.8 to 8.6 |

The same request through `executeRoute` without a body costs 1.1 to 1.4 µs: the pipeline of
the kit (principal, execution scope, error mapping, answer) is about a microsecond, the rest is
validation. TypeBox checks in 0.75 µs on its own; the adapter also fills defaults and drops
undeclared properties (`Default`, `Clean`), which is where its time goes.

| Framework, 50 routes | Cold start to the first answer, median of 5 (ms) | Requests per second, kit, 32 concurrent, client in another process |
|---|---|---|
| Express 5 | 167 to 244 | 4,800 to 11,700 |
| Fastify 5 | 188 to 268 | 6,000 to 14,700 |
| Hono 4 on `@hono/node-server` | 152 to 205 | 7,300 to 14,200 |
| NestJS 12 on Express | 301 to 395 | 7,800 to 13,600 |

The request rates are bounded by the client measuring them and by the other work on the
machine: the same framework varied by more than a factor of two between runs, and the rate
through the kit and through a bare handler of the framework were within that noise. Read them
as "all four serve thousands of requests a second through the kit"; the cold start, where Nest
pays for its container, is the one framework difference the runs agree on.

## Limits of each pair

- **Express + zod.** `express.json()` must be installed; a body Express refuses (malformed JSON)
  is answered by Express's own error handler, not as a problem. zod describes the input side by
  default: a schema with defaults used as a response gets a second component (`Slot_2`) unless
  it has its own id.
- **Fastify + TypeBox.** Fastify's own validation and serialization are not used: the routes
  carry no Fastify schema, TypeBox validates in the pipeline. TypeBox 1 (`typebox`) is recent and
  ESM only; `@sinclair/typebox` 0.34 is its predecessor and is not supported by the adapter.
  `Type.Ref` is not resolved: share a schema by nesting the schema built with an `$id`.
- **Hono + zod.** Proven on Node only. The adapter reads the body as JSON itself, up to
  `bodyLimit` (1 MiB by default, Fastify's bound; Express stops at 100 kB): it answers a larger
  body 413 (`BODY_TOO_LARGE`) and a malformed one 400 (`MALFORMED_BODY`), both as problems, where
  Express and Fastify answer them with their own error handler. The raw request is `HonoRaw`, so code that
  read `request.ip` of Express reads `getConnInfo(context)` of `@hono/node-server/conninfo`.
- **NestJS + class-validator.** The legacy decorator mode, two containers' worth of concepts,
  and Nest's pipes, guards, interceptors, filters and `@nestjs/swagger` do not see the routes
  ([HTTP frameworks](http-frameworks.md)). class-transformer has had no release since 2021.

## oRPC: evaluated, not a pair

oRPC 1.15.6 (MIT, first release November 2024) is contract-first: a contract
(`oc.route({ method, path }).input(schema).output(schema).errors({...})`) is implemented by
procedures, served over HTTP by an `OpenAPIHandler`, and turned into an OpenAPI document by an
`OpenAPIGenerator` with a converter per schema library. Checked by running it with zod 4:

| Kit invariant | What oRPC does instead |
|---|---|
| a controller class with one `handle` | a procedure is a function (`os.book.handler(({ input, context, errors }) => ...)`); a class would only be called from it |
| guards | middlewares on the procedure or the router, with their own context |
| problem documents with the code of the factory | its own error body, `application/json`: `{"defined":true,"code":"SLOT_TAKEN","status":409,"message":"..."}`; a refused input is a 400 `BAD_REQUEST` with the issues under `data`, not a 422 problem |
| a shape declared once in the contract | a zod schema with `.meta({ id })` was inlined twice; it is referenced only when also listed in the `commonSchemas` option of the generator, a second registry |
| one contract generator | oRPC generates its own document from its contract, next to the kit's |

Integrating it as a pair would give a project two ways to declare a route, two error formats and
two contract generators, which is what the kit exists to avoid. What oRPC offers that a team may
want, an end-to-end typed client, the kit gets from the contract it already generates: `ddd-ts-kit sdk`
writes a typed client from `openapi/*.yaml` ([client SDK](client-sdk.md)). Use oRPC on its own, outside the bounded contexts, for an
internal RPC between a front end and its backend-for-frontend; use the kit's controllers for
the API of the contexts.

## Sources

- npm registry, read on 2026-10-13: express, fastify, hono, @hono/node-server, @nestjs/core,
  zod, typebox, @sinclair/typebox, class-validator, class-transformer, zod-openapi,
  @asteasolutions/zod-to-openapi, @orpc/server, @orpc/contract, @orpc/openapi, @orpc/zod.
- zod, JSON Schema and metadata: https://zod.dev/json-schema
- TypeBox: https://github.com/sinclairzx81/typebox
- Hono on Node: https://hono.dev/docs/getting-started/nodejs
- oRPC: https://orpc.dev (contract-first, OpenAPI handler and generator)
- The probe of oRPC was run in a throwaway directory with `@orpc/server`, `@orpc/contract`,
  `@orpc/openapi` and `@orpc/zod` 1.15.6 and zod 4.6.5; its code is summarised in the table above.
- Not verified: Hono on Bun, Deno or an edge runtime; TypeBox through `Type.Ref` and a context.

## See also

- [HTTP frameworks](http-frameworks.md) and [validation libraries](validation.md)
- [Architecture reference](../ARCHITECTURE.md), shared schemas under section 2
- [Configuration](../CONFIG.md): `stack.http`, `stack.validation`, `stack.schemas`

# @ddd-ts-kit/http

Declare a route once, without a framework. Mount it on Express 5, Fastify 5 or NestJS, and
generate the OpenAPI 3.1 contract from the same declaration.

Every adapter goes through one pipeline (`executeRoute`): validation, handler, error mapping.
The behaviour is therefore the same on the three frameworks, and one test suite proves it.

## Declare

```ts
import { z } from 'zod';
import { defineRoute, defineRoutes } from '@ddd-ts-kit/http';
import { zodSchema } from '@ddd-ts-kit/validation/zod';

const order = zodSchema(z.object({ id: z.string(), total: z.number() }), { io: 'output' });

export const orderRoutes = (orders: OrderQueries) =>
  defineRoutes(
    defineRoute(
      {
        method: 'GET',
        path: '/orders/:orderId',
        operationId: 'getOrder',
        summary: 'Read an order',
        tags: ['orders'],
        request: { params: zodSchema(z.object({ orderId: z.string().uuid() })) },
        responses: { 200: { description: 'The order.', body: order } },
        errors: ['NOT_FOUND'],
        security: ['bearer'],
      },
      async ({ params, context }) => ({
        status: 200, // must be a declared status, and the body must match its schema
        body: await orders.byId(params.orderId, context.principal),
      }),
    ),
  );
```

- `params`, `query`, `headers` and `body` are typed from the schemas. Any `Schema` of
  `@ddd-ts-kit/validation` works (zod, class-validator, Standard Schema).
- Paths are literal segments and `:name` parameters, the form Express and Fastify share.
- Frameworks hand query values over as strings: coerce in the schema (`z.coerce.number()`).
- `context` is `{ requestId, execution, principal?, raw }`. `execution` is the kernel
  `ExecutionContext` of the request (see "The execution context of a request"); `raw` is the
  framework's request object.
- `security` is required: the names of the security schemes that apply, or `false` for a route
  anybody may call. A route is never public by omission: leaving it out does not compile, and
  `defineRoute` refuses an empty list, which would say the same as `false` without saying it.
- `defineRoutes` and every mount refuse a duplicate `operationId` or method and path.
- `prefixRoutes('/api', routes)` moves routes under a prefix, for the server and the contract.

## Errors

A handler throws a `DomainError`; its `code` is mapped to a status in one place and answered as
`application/problem+json` (RFC 9457):

```json
{ "type": "urn:problem:not-found", "title": "Not Found", "status": 404, "code": "NOT_FOUND",
  "detail": "Order 7 does not exist.", "requestId": "..." }
```

Defaults: `VALIDATION_FAILED` 422 (with `issues`, paths prefixed by the part:
`body.items.0.sku`), `NOT_FOUND` 404, `CONFLICT` 409, `INVARIANT_VIOLATION` 422, `UNAUTHORIZED`
401, `FORBIDDEN` 403. A domain code that is not mapped answers 422.

```ts
import { createErrorMapper } from '@ddd-ts-kit/http';

const errorMapper = createErrorMapper({ ORDER_ALREADY_SHIPPED: 409, QUOTA_EXCEEDED: 429 });
```

Anything that is not a `DomainError` answers 500 `Internal Server Error` with no detail: the
message of an unexpected error never leaves the process. Log it from the `onError` hook, and
report it to the error tracker with `onError: reportHttpErrors(errorReporter)`: every request
answered 5xx goes to the kernel `ErrorReporter`, once, with the correlation, actor and tenant
ids of its execution context (`context.execution`, present once the request got that far); a
4xx never does.

## Options shared by the adapters

```ts
import type { ExecuteOptions } from '@ddd-ts-kit/http';

const options: ExecuteOptions = {
  errorMapper,
  resolvePrincipal: (raw) => authenticate(raw), // throw UnauthorizedError to refuse
  onError: (error, { requestId, correlationId, operationId, problem }) => {
    if (problem.status >= 500) logger.error({ requestId, correlationId, operationId, error });
  },
  validateResponses: process.env.NODE_ENV === 'test', // checks answers against the declaration
  around: tracedRoutes(), // of @ddd-ts-kit/tracing: the span of the request, named by its route template
};
```

`around(route, respond)` wraps the whole handling of a request, from authentication to the
answer, refusals included, and is told the route that was matched (`method`, `path` as
declared, `operationId`). It is where a tracer names a request `POST /orders/:id/lines` instead
of by its URL; this package depends on no tracing library.

The request id is the incoming `x-request-id` when well formed, else a UUID; it is echoed in
the `x-request-id` response header and in every problem.

## The execution context of a request

`executeRoute` builds a kernel `ExecutionContext` for every request and hands it to the handler
as `context.execution`:

| Field | Value |
|---|---|
| `correlationId` | the incoming `x-correlation-id` when well formed (letters, digits, `._:-`, at most 128), else the request id; echoed in the `x-correlation-id` response header, on problems too, and given to `onError` |
| `origin` | `http` |
| `actor`, `session` | from what `resolvePrincipal` answered, read structurally: a `Session` gives both, an `Actor` gives the actor, anything else is the anonymous actor |
| `tenantId` | the tenant of the actor |
| `locale` | the locale of the session, else the preferred language of `Accept-Language` |
| `deadline` | arrival plus `requestTimeoutMs`, when the option is set |

```ts
import { Clock, ExecutionScope } from '@ddd-ts-kit/kernel';

const options: ExecuteOptions = {
  resolvePrincipal: principalResolver(authenticator), // of @ddd-ts-kit/auth: answers a Session
  executionScope: app.resolve(ExecutionScope), // the scope the application runs its use cases in
  clock: app.resolve(Clock),
  requestTimeoutMs: 10_000,
};
```

With `executionScope`, every handler runs inside `scope.run(context.execution, ...)`: loggers,
audit columns, tenant scoping and outgoing headers read the context of the request with no
wrapper around the handler, and no route can forget it. `withPrincipal` stays, for a scope of
your own; it runs inside the execution scope. The pipeline does not interrupt a handler at its
deadline: a timeout wrapper or an outgoing call reads `deadline` and honours it. `clock` is the
option that says when a request arrived, the system clock by default.

Use cases still receive the actor explicitly: `new PlaceOrder(context.execution.actor, body)`,
or `actorOf(context.principal)` of `@ddd-ts-kit/auth`, which reads the same actor.

## In the composition root

The package binds and resolves nothing: routes are a plain list and `ExecuteOptions` a plain
object, both built where the server starts. What it takes from the application are ports,
resolved by their class:

```ts
import { createApplication, defineContextModule, kernelModule } from '@ddd-ts-kit/di';
import { ErrorMapper, createErrorMapper, type ExecuteOptions } from '@ddd-ts-kit/http';
import { Clock, ExecutionScope } from '@ddd-ts-kit/kernel';

const httpModule = defineContextModule({
  name: 'http',
  register(builder) {
    builder.bind(ErrorMapper).toValue(createErrorMapper({ ORDER_ALREADY_SHIPPED: 409 }));
  },
});

const app = createApplication({ modules: [kernelModule(), httpModule, orderingModule] });

const options: ExecuteOptions = {
  errorMapper: app.resolve(ErrorMapper),
  executionScope: app.resolve(ExecutionScope),
  clock: app.resolve(Clock),
};
```

| What | Is | Why |
|---|---|---|
| `ErrorMapper` | a port: an abstract class, the class is the token | one per application, and the server and the contract generator must be given the same one; binding it is optional, `createErrorMapper(...)` in a constant works as well |
| `ExecutionScope`, `Clock` | ports of the kernel | resolved from the application and handed over in the options |
| `resolvePrincipal`, `withPrincipal`, `onError`, `requestId` | functions of `ExecuteOptions` | hooks of one server, written where it starts; the injectable side of authentication is the `Authenticator` of `@ddd-ts-kit/auth`, which `principalResolver` turns into `resolvePrincipal` |
| the route list | a value, `readonly Route[]` | the result of `defineRoutes(...)`, passed to the mount and to `generateOpenApi` |
| `Schema` | an interface of `@ddd-ts-kit/validation` | one value per request part, declared in the route |

## Pagination

One query vocabulary and one answer for every list, on top of the kernel `PageRequest` and
`Page`: `limit`, `offset` or `cursor`, and `sort` (`placedAt,-total`: comma-separated fields, a
leading `-` for descending).

```ts
import { defineRoute, pageQuerySchema, pageResponse, pageSchemaOf } from '@ddd-ts-kit/http';

const listOrders = defineRoute(
  {
    method: 'GET',
    path: '/orders',
    operationId: 'listOrders',
    summary: 'List orders',
    request: { query: pageQuerySchema({ sortable: ['placedAt', 'total'], maxSize: 50 }) },
    responses: { 200: { description: 'A page of orders.', body: pageSchemaOf(order) } },
    security: ['bearer'],
  },
  async ({ query }) => ({
    status: 200, // query is a PageRequest<'placedAt' | 'total'>
    body: pageResponse(await orders.list(query), toOrderDto),
  }),
);
```

| Helper | Does |
|---|---|
| `pageRequestFrom(query, options?)` | reads the four parameters, as strings or already coerced, into a `PageRequest`; throws the `ValidationError` of the pipeline, so a wrong parameter answers 422 with one issue per parameter (`query.limit`, `query.sort`...). For a route whose query schema also has filters: declare the four parameters in that schema and call it in the handler |
| `pageQuerySchema(options?)` | the same reading as a `Schema`, for a route whose whole query is the page |
| `pageResponse(page, map)` | the JSON body `{ items, total?, nextCursor? }`, each item through `map` |
| `pageRequestParameters(options?)` | the JSON Schema of the query (one OpenAPI parameter per property); `properties` merges into a wider schema |
| `pageSchemaOf(itemSchema)` | the `Schema` of a page of items: validates the envelope and each item, describes both in the contract |

`options` are the `PageLimits` of the kernel (`defaultSize` 20, `maxSize` 100) plus `sortable`,
the closed list of fields a client may sort by, and `kind`, the variant of a query that names
neither `offset` nor `cursor` (`offset` by default). Without `sortable`, a `sort` parameter is
refused: a client never chooses a column the read port did not offer. `offset` and `cursor`
together are refused. These helpers depend on no validation library; `pageQuerySchema` and
`pageSchemaOf` are plain `Schema`s and sit next to zod or class-validator schemas.

## Filters and sorting

One query grammar for every list route, on top of the kernel `Criteria`: the read port declares
what it accepts with `defineCriteria`, and the route reads the query into a criteria that
definition accepts, or answers 422.

```ts
import { criteriaQuerySchema, defineRoute, pageResponse, pageSchemaOf } from '@ddd-ts-kit/http';

const listAppointments = defineRoute(
  {
    method: 'GET',
    path: '/appointments',
    operationId: 'listAppointments',
    summary: 'List appointments',
    request: { query: criteriaQuerySchema(appointmentCriteria) },
    responses: { 200: { description: 'A page of appointments.', body: pageSchemaOf(appointment) } },
    security: ['bearer'],
  },
  async ({ query, context }) => ({
    status: 200, // query is a Criteria<AppointmentRow>
    body: pageResponse(await queries.execute(new ListAppointments(context.execution.actor, query)), toAppointmentDto),
  }),
);
```

```
GET /appointments?filter[status]=in:booked,confirmed&filter[startsAt]=gte:2026-10-01T00:00:00Z
                 &filter[or][practitionerId]=eq:p-7&filter[or][remote]=true
                 &sort=-startsAt,id&limit=20&cursor=eyJzdGFydHNBdCI6...
```

| Written | Means |
|---|---|
| `filter[<field>]=<operator>:<value>` | one condition. The operators are those of the kernel: `eq`, `ne`, `in`, `gt`, `gte`, `lt`, `lte`, `contains`, `startsWith`, `isNull`, `between` |
| `filter[<field>]=<value>` | `eq`. The text before the first colon is an operator only when it is the name of one: `filter[title]=10:30 review` is an `eq`, and a value that starts like an operator is written `eq:in:the morning` |
| several `filter[...]` | joined by AND; the same field may be repeated: `filter[seats]=gte:2&filter[seats]=lte:4` |
| `in:<a>,<b>,<c>` | a list, separated by commas. A comma inside a value is written `\,`, a backslash `\\`; a colon needs nothing |
| `between:<from>,<to>` | two values, both bounds included |
| `isNull:true`, `isNull:false`, `isNull` | without a value, or with one; `isNull` alone means `true` |
| `contains:<text>`, `startsWith:<text>` | the text as it is, commas included; case sensitive |
| `filter[or][<field>]=...` | the conditions written under `or` are alternatives; under `not`, the rows that satisfy them all are refused; `and` exists for symmetry |
| `filter[or][0][<field>]=...&filter[or][0][<other>]=...&filter[or][1][<field>]=...` | an index holds several conditions together inside a group: `or(and(...), ...)`. It counts as one more level of depth, which the definition allows or not (`maxDepth`, 1 by default) |
| `sort=-startsAt,id` | comma-separated or repeated, a leading `-` for descending, among the fields declared sortable and the tie-breaker |
| `limit`, `offset`, `cursor` | the page, read by the helpers of "Pagination" with the limits of the definition |

A value is read by the type its field declares: a number in plain digits (no exponent), `true`
or `false`, a decimal kept as written, an instant in ISO 8601 with its zone
(`2026-10-01T08:00:00Z`, `2026-10-01T10:00:00+02:00`) or a date alone, taken at midnight UTC.
Percent-encoding is the transport's: `+` in a zone is sent `%2B`. `and`, `or`, `not` and
numbers are reserved names: a field called so cannot be filtered. Both ways a framework hands
a query are read: the keys as written (`'filter[status]'`, Express 5 and Fastify by default)
and already nested (`filter: { status }`, a `qs` parser).

Anything the definition does not declare is refused with the 422 problem of the pipeline, one
issue per mistake, none quoting a value:

| `path` | `code` |
|---|---|
| `query.filter.<field>` | `unknown_field`, `operator_not_allowed`, `invalid_value`, `in_list_too_long`, `invalid_filter` (not written `filter[<field>]=<operator>:<value>`) |
| `query.filter` | `too_deep`, `empty_group`, `too_many_filters`, `invalid_filter` |
| `query.sort` | `unsortable_field`, `invalid_sort` |
| `query.limit`, `query.offset`, `query.cursor` | `invalid_limit`, `invalid_offset`, `invalid_cursor`, `offset_with_cursor` |

| Helper | Does |
|---|---|
| `criteriaQuerySchema(definition, { kind? })` | the reading as a `Schema`, for a route whose whole query is the criteria |
| `criteriaFrom(query, definition, { kind? })` | the same reading in a handler, for a route whose query schema holds other parameters too; throws the `ValidationError` of the pipeline |
| `criteriaParameters(definition)` | the JSON Schema of the query, one OpenAPI parameter per property: `filter[<field>]` for each field with an operator, with the operators in its description and in `x-filter-operators`, its type in `x-filter-type`; `sort` as the list of the values it accepts; `limit`, `offset` and `cursor` |

The scope of the actor is not a parameter: the handler of the query joins it with `scoped`,
and nothing in a query string can remove it.

## Express 5

```ts
import express from 'express';
import { mountExpress } from '@ddd-ts-kit/http/express';

const app = express();
app.use(express.json()); // required: the adapter does not parse bodies
mountExpress(app, orderRoutes(orders), options); // an express.Router() works too
```

## Fastify 5

```ts
import Fastify from 'fastify';
import { fastifyRoutes, mountFastify } from '@ddd-ts-kit/http/fastify';

const app = Fastify();
mountFastify(app, orderRoutes(orders), options);
// or, as a plugin:
await app.register(fastifyRoutes(orderRoutes(orders), options), { prefix: '/api' });
```

## NestJS

No decorator per route: a module mounts the routes on the underlying HTTP server at module
init, whether Nest runs on Express or on Fastify. Handlers get their dependencies by closure.

```ts
import { Module } from '@nestjs/common';
import { createRoutesModule } from '@ddd-ts-kit/http/nest';

@Module({
  imports: [
    createRoutesModule(
      { inject: [OrderQueries], useFactory: (orders: OrderQueries) => orderRoutes(orders) },
      { ...options, imports: [OrdersModule] }, // the modules exporting the injected tokens
    ),
  ],
})
export class AppModule {}
```

A plain array works as well: `createRoutesModule(routes, options)`. These routes bypass Nest's
pipes, guards, interceptors, exception filters and global prefix: validation and error mapping
are those described above. Use `prefixRoutes` for a prefix.

## OpenAPI 3.1

```ts
import { readFileSync, writeFileSync } from 'node:fs';
import { checkOpenApiDrift, generateOpenApi, stringifyOpenApi } from '@ddd-ts-kit/http/openapi';

const document = generateOpenApi({
  info: { title: 'Orders', version: '1.0.0' },
  servers: [{ url: 'https://api.example.com' }],
  routes: orderRoutes(orders),
  securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } },
  errorMapper, // the one the server runs with
});

writeFileSync('openapi.json', stringifyOpenApi(document));

// In CI: regenerate and fail on a difference.
if (checkOpenApiDrift(document, readFileSync('openapi.json', 'utf8')).drift) process.exit(1);
```

What is generated: `{param}` paths, one parameter per property of the params, query and headers
schemas, the request body, the declared responses, the `security` of every operation (an empty
list for a public route), one `application/problem+json` response per
status of the declared `errors` (codes listed in the description and in `x-error-codes`), 422
whenever the route validates input, a shared `Problem` schema. Local `$defs` of the schemas are
moved to `components.schemas`. Paths, statuses and component keys are sorted: the output does
not depend on the order of the routes, so the committed file diffs cleanly.

## Serving the contract and its page

```ts
import { openApiDocsRoutes } from '@ddd-ts-kit/http/docs';

const routes = [...orderRoutes(orders), ...openApiDocsRoutes(document, { ui: 'scalar' })];
```

Two public routes (`security: false`), mounted next to the application routes and absent
from the contract they display:
the JSON document (`jsonPath`, default `/openapi.json`) and an interactive page (`uiPath`,
default `/docs`) rendered by `ui`: `swagger` (default), `scalar` or `redoc`. The page loads the
assets of the UI from a public CDN pinned to a major version; `assetsUrl` points it at
self-hosted files when it must work offline or under a strict content security policy. A
project generated by the CLI mounts them in `src/platform/http/with-documentation.ts`, with
the UI chosen by `--docs-ui`, unless documentation is switched off by its configuration.

## Limits

- A body the framework itself refuses (malformed JSON, payload too large) is answered by the
  framework's own error handler, before the pipeline runs.
- Routes are JSON first. A handler may answer a string or bytes by setting its own
  `content-type` header; streaming is out of scope.

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
- `context` is `{ requestId, principal?, raw }`. `raw` is the framework's request object.
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
message of an unexpected error never leaves the process. Log it from the `onError` hook.

## Options shared by the adapters

```ts
const options = {
  errorMapper,
  resolvePrincipal: (raw) => authenticate(raw), // throw UnauthorizedError to refuse
  onError: (error, { requestId, operationId, problem }) => {
    if (problem.status >= 500) logger.error({ requestId, operationId, error });
  },
  validateResponses: process.env.NODE_ENV === 'test', // checks answers against the declaration
};
```

The request id is the incoming `x-request-id` when well formed, else a UUID; it is echoed in
the `x-request-id` response header and in every problem.

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
schemas, the request body, the declared responses, one `application/problem+json` response per
status of the declared `errors` (codes listed in the description and in `x-error-codes`), 422
whenever the route validates input, a shared `Problem` schema. Local `$defs` of the schemas are
moved to `components.schemas`. Paths, statuses and component keys are sorted: the output does
not depend on the order of the routes, so the committed file diffs cleanly.

## Limits

- A body the framework itself refuses (malformed JSON, payload too large) is answered by the
  framework's own error handler, before the pipeline runs.
- Routes are JSON first. A handler may answer a string or bytes by setting its own
  `content-type` header; streaming is out of scope.

**English** · [Français](http-frameworks.fr.md)

# HTTP frameworks: Express, Fastify, Hono, NestJS

**Summary.** In this kit a route is declared once, as data plus a handler, and mounted on
Express 5, Fastify 5, Hono 4 (on Node) or NestJS by an adapter of `@ddd-ts-kit/http`. All four
go through the same pipeline (validation, handler, error mapping), so the framework decides how
the server is operated, not how a use case is reached. Which framework goes with which
validation library, with measured numbers, is in [contract pairs](contract-pairs.md). The choice therefore rests on the team's habits, the
ecosystem it needs and how much of the framework it is ready to leave unused. With NestJS the
price of framework-agnostic routes is the highest: they bypass most of what makes a Nest
controller a Nest controller.

## What the framework is asked to do here

The presentation layer is thin by rule (`layer/presentation-no-infrastructure`,
`authz/in-application` in [ARCHITECTURE.md](../ARCHITECTURE.md)): a route validates the shape of
its input, builds a command or a query carrying the actor, sends it on a bus and maps the
answer. In the running domain:

![Four adapters, one pipeline: Express, Fastify, Hono and NestJS each hand the raw request to executeRoute, which resolves the principal, validates the parts of the request, builds the execution context, runs the handler that sends the command on the bus, and answers; a refusal at any step goes through the error mapper and is answered as an RFC 9457 problem](../assets/diagrams/http-frameworks-one-pipeline.svg)

The route is written once, as data plus a handler, and knows no framework:

<!-- checked sample -->
```ts
// contexts/scheduling/presentation/http/book-appointment.route.ts
import { z } from 'zod';
import { acceptedSchema, defineRoute, defineRoutes } from '@ddd-ts-kit/http';
import { AuthorizedCommand, type Actor, type CommandBus } from '@ddd-ts-kit/kernel';
import { zodSchema } from '@ddd-ts-kit/validation/zod';

// application/commands/book-appointment/book-appointment.command.ts (declared here for the sample)
declare class BookAppointment extends AuthorizedCommand<string> {
  constructor(actor: Actor, practitionerId: string, startsAt: Date);
}

const body = zodSchema(z.object({ practitionerId: z.uuid(), startsAt: z.iso.datetime() }));

export const appointmentRoutes = (commands: CommandBus) =>
  defineRoutes(
    defineRoute(
      {
        method: 'POST',
        path: '/appointments',
        operationId: 'bookAppointment',
        summary: 'Book an appointment',
        tags: ['scheduling'],
        request: { body },
        responses: { 201: { description: 'Booked; the body carries its identifier.', body: acceptedSchema } },
        errors: ['SLOT_TAKEN'],
        security: ['bearer'],
      },
      // body is typed from its schema: { practitionerId: string; startsAt: string }
      async ({ body: { practitionerId, startsAt }, context }) => {
        const id = await commands.execute(new BookAppointment(context.execution.actor, practitionerId, new Date(startsAt)));

        return { status: 201, body: { id } };
      },
    ),
  );
```

The framework only mounts that list. Each adapter is a subpath of `@ddd-ts-kit/http`, and the
three mounts below serve the same routes with the same behaviour:

<!-- checked sample -->
```ts
// platform/http/start-http-server.ts: one of these, chosen by `stack.http`
import { serve } from '@hono/node-server';
import express from 'express';
import Fastify from 'fastify';
import { Hono } from 'hono';
import type { ExecuteOptions, Route } from '@ddd-ts-kit/http';
import { mountExpress } from '@ddd-ts-kit/http/express';
import { fastifyRoutes } from '@ddd-ts-kit/http/fastify';
import { mountHono } from '@ddd-ts-kit/http/hono';

declare const routes: readonly Route[]; // appointmentRoutes(commands), and the routes of the other contexts
declare const options: ExecuteOptions; // resolvePrincipal, executionScope, errorMapper...

export function onExpress(): void {
  const app = express();
  app.use(express.json()); // the adapter does not parse bodies
  mountExpress(app, routes, options);
  app.listen(3000);
}

export async function onFastify(): Promise<void> {
  const app = Fastify();
  await app.register(fastifyRoutes(routes, options));
  await app.listen({ port: 3000 });
}

export function onHono(): void {
  const app = new Hono();
  mountHono(app, routes, options); // reads the JSON body itself, up to bodyLimit
  serve({ fetch: app.fetch, port: 3000 });
}
```

What a route of the kit replaces is a handler written against the framework. Instead of:

```ts
// presentation/http/book-appointment.ts: an Express handler of its own
app.post('/appointments', async (req, res) => {
  if (typeof req.body.startsAt !== 'string') {
    return res.status(400).json({ error: 'startsAt is required' }); // a format of its own, absent from the contract
  }
  try {
    const id = await commands.execute(new BookAppointment(req.user, req.body.practitionerId, new Date(req.body.startsAt)));
    res.status(201).json({ id });
  } catch (error) {
    res.status(409).json({ message: (error as Error).message }); // every failure is a 409, and its message leaks
  }
});
```

write the declaration above: the schema validates and documents the body, the handler only
maps the request to a command, and a refusal of the use case (`SLOT_TAKEN`) is answered as a
problem with the status the error mapper gives its code, on every framework alike.

What stays the framework's: listening, body parsing, plugins or middlewares in front of the
routes (compression, CORS, rate limiting), and its own answer to a body it refuses before the
pipeline runs (on Hono the adapter reads the body, and answers those refusals as problems).

## Comparison

Versions and figures checked on 2026-10-10 against the npm registry.

| | Express | Fastify | Hono | NestJS |
|---|---|---|---|---|
| Current major | 5 (5.3.0; 4.x still published under `latest-4`) | 5 (5.12.5) | 4 (4.13.13, with `@hono/node-server` 2.1.4 on Node) | 12 (12.1.2; 11.x under `legacy`) |
| Licence | MIT | MIT | MIT | MIT |
| Node required by the package | 18 or later | not checked | 16.9 or later (`hono`) | 20 or later |
| Weekly downloads | about 141 million | about 15 million | not checked | about 16 million (`@nestjs/core`) |
| Nature | minimal router and middleware chain | router with schemas, hooks, encapsulated plugins, a logger (pino) | router on Web standard `Request` and `Response`, for Node, Bun, Deno and edge runtimes | application framework: modules, DI container, decorators, on top of Express or Fastify |
| Own validation | none | JSON Schema per route | validator middlewares | pipes, usually class-validator |
| Own DI | none | none (decorators on the instance) | none | yes, central to the framework |
| Decorators | none | none | none | everywhere; legacy decorator mode in the generated projects of this kit |
| What the kit's routes use of it | the router | the router, as routes or as a plugin with a prefix | the router; the adapter reads the JSON body itself | the underlying HTTP server only |

The download figures say how widely each is installed, nothing about fitness. Performance is
measured in [contract pairs](contract-pairs.md): the pipeline of the kit costs about a
microsecond per request plus validation, the request rates of the four frameworks were within
the noise of a shared machine, and only the cold start of Nest stood apart. In a service that
talks to a database the framework is rarely where the time goes.

## Selection criteria

1. **What the team already runs.** Operational knowledge (middlewares, plugins, error
   handling, graceful shutdown) is the real cost of a framework.
2. **What surrounds the routes.** Server-side rendering, WebSockets, GraphQL: these live outside
   `@ddd-ts-kit/http` and come from the framework's ecosystem. File uploads do not: a controller
   declares its upload, read the same way on the three frameworks (see
   [file storage](file-storage.md)).
3. **The logger.** Fastify speaks pino; the kit has a pino adapter of its `Logger` port
   ([observability tools](observability.md)).
4. **Whether a second container is acceptable.** NestJS brings its own; see
   [dependency injection](dependency-injection.md).
5. **Decorator mode.** NestJS and class-validator impose the legacy mode on the whole program.
   The kit's own decorators work in both modes, so this constrains other libraries, not the kit.

## What "framework-agnostic routes" costs with Nest

`createRoutesModule` mounts the routes on the HTTP server underneath Nest at module init,
whether Nest runs on Express or on Fastify. No decorator per route; handlers get their
dependencies by closure:

<!-- checked sample: legacy-decorators -->
```ts
// platform/http/app.module.ts
import { Module } from '@nestjs/common';
import type { ExecuteOptions, Route } from '@ddd-ts-kit/http';
import { createRoutesModule } from '@ddd-ts-kit/http/nest';

declare const routes: readonly Route[]; // the same list Express, Fastify or Hono would mount
declare const options: ExecuteOptions;

@Module({ imports: [createRoutesModule(routes, options)] })
export class AppModule {}
```

The package README is explicit about the consequence: these routes
**bypass Nest's pipes, guards, interceptors, exception filters and global prefix**. In
practice:

![The request lifecycle of a native Nest controller (guards, interceptors, pipes, controller method, exception filters) above, and below what takes the place of each for a route of the kit: the principal resolver and the authorization middleware of the bus, the bus middlewares and aspects, the schema of the route, the route handler, and the error mapper](../assets/diagrams/http-frameworks-nest-bypass.svg)

| Nest feature | For a route of the kit |
|---|---|
| `ValidationPipe` and other pipes | not run; validation is the `Schema` of the route |
| guards (`@UseGuards`, Passport strategies) | not run; authentication is `resolvePrincipal`, authorization the bus middleware |
| interceptors (logging, caching, transformation) | not run; use bus middlewares and aspects |
| exception filters | not run; errors become RFC 9457 problems through the error mapper |
| `setGlobalPrefix` | ignored; use `prefixRoutes` |
| `@nestjs/swagger` | does not see these routes; the contract is generated by the kit |

Three further costs follow from choosing Nest in this kit:

- **Wiring is Nest's.** `--http nest` and `--di nest` go together: the CLI refuses one
  without the other, and refuses the declared style with `--di nest`. Contexts are written in
  the explicit style, as a `<context>.module.ts` that is a function of the platform, and
  `@Injectable()` is kept out of `domain/` and `application/`.
- **Legacy decorators.** The generated `tsconfig.json` sets `experimentalDecorators` (and
  `emitDecoratorMetadata`) for Nest.
- **One pipeline for the use cases.** A controller Nest serves would give two validation paths,
  two error formats and two contracts to keep coherent, and routes whose security nothing
  declares: `ddd-ts-kit check` refuses it in a context, and anywhere else once it reaches a use
  case (`nest/no-parallel-pipeline`). A Nest controller the kit serves keeps the decorators of
  Nest: `@KitRoute` on each method, `createControllersModule` to serve it ([the package
  README](../../packages/http/README.md), "Nest controllers served by the kit"). Nest stays free
  in the platform for what reaches no use case.

What Nest still gives: its module system for the parts that are not use cases (health,
WebSocket gateways, GraphQL, queues), its CLI and its hiring pool. If those are the reason for
Nest, the cost is fair. If Nest was chosen for its controllers, guards and pipes, the kit's
routes remove exactly that, and Express or Fastify does the same job with less machinery.

## Where each tool of Nest goes

What a Nest developer reaches for, and where it is in a project of the kit. The kit's tool is
not a translation for its own sake: each one holds a guarantee the Nest tool would not, often
because the use case is called through more than one door (HTTP, `/rpc`, `/trpc`, a job, an
event handler) and only the bus sees all of them. In a context, `ddd-ts-kit check` refuses the
Nest tool and names the kit's (`nest/no-parallel-pipeline`); in the platform Nest stays free.

| You would write, in Nest | In the kit | What it keeps |
|---|---|---|
| `@Controller`, `@Get`, `@Post`, `@Body`, `@Param` | the same Nest controller, `@KitRoute` on each method, served by `createControllersModule`; or a route of the kit (`generate route`) | a security declared on every route, the problem codes the clients read, the route in the contract |
| a `ValidationPipe`, a DTO class with class-validator | the schemas of the route, written with the validation library of the project (class-validator in the Nest stacks the kit proves) | the validation the contract documents, nothing transformed before it |
| `@UseGuards(AuthGuard('jwt'))`, a Passport strategy | the authentication of the platform, read by `resolvePrincipal`; a guard of a route group for a control at the edge (`generate guard`) | an anonymous call refused the same way on every door |
| `@Roles('admin')`, a `RolesGuard`, CASL | the permission of the use case (`requires` in the module file, `@Requires`), a policy for a rule on loaded state, an access scope for a search | the right checked on HTTP, `/rpc`, `/trpc`, a job and an event alike, the refusals audited when the audit trail is on, the lists narrowed (`authz/*`) |
| an exception filter, `throw new NotFoundException()` | a refusal from the code list of the context, answered by the error mapper | a problem document with the code the contract declares and the client narrows |
| an interceptor for logs, traces, retries | a bus middleware or an aspect; tracing is wired by the platform | one policy for every use case, read in one place |
| `CacheInterceptor`, `@nestjs/cache-manager` | the `cache` of the route (with `etag`, `tags`) and the `Cache` port of the kernel | answers kept per caller when they must, purged after the commit |
| `@nestjs/swagger` | the contract generated from the routes (`npm run docs:generate`) | a contract that cannot drift from the code, `x-error-codes`, the generated clients |
| `@nestjs/cqrs` | the `CommandBus` and `QueryBus` of the kit | the permission, the unit of work and the outbox around every command |
| `@nestjs/schedule`, `@nestjs/bullmq` | a job of the kit (`generate job`), a background job | a job that sends a command, so through the same checks |
| `@nestjs/event-emitter` | domain events, integration events through the outbox | events that leave with the save, never lost by a crash |
| `@nestjs/config`, `ConfigService` | the configuration of the platform, validated at start and handed to the module | one validated place, no environment read in a context (`purity/no-environment`) |
| `@nestjs/typeorm`, `@InjectRepository` | the repository adapter of the context on the ORM package of the kit | the unit of work, the tenant and audit columns, the contract suite of the port |
| `@nestjs/throttler` | the rate limit of the platform (`rateLimit`) | one limit before authentication costs anything |
| `Logger` of `@nestjs/common` | the `Logger` of the kernel | the request and correlation ids of every line, no personal data logged (`privacy/no-personal-data-in-logs`) |
| `@Injectable()`, `@Inject()` | the module function of the context; an adapter may still be bound as a Nest provider | nothing is lost: this is wiring, which the rule leaves alone outside `domain/` and `application/` |
| `setGlobalPrefix` | `prefixRoutes` | the prefix in the contract as on the server |

WebSocket gateways, GraphQL resolvers and microservice clients of Nest are not judged: the kit
has no tool of its own for them. A resolver or a gateway that calls a use case sends its command
through the bus, which checks its permission as it does for a route.

## What this kit supports and verified

From [`packages/http/README.md`](../../packages/http/README.md) and
[`packages/cli/README.md`](../../packages/cli/README.md):

- Adapters for Express 5, Fastify 5, Hono 4 and NestJS, all through one pipeline
  (`executeRoute`); one test suite proves the behaviour of the routes is the same on the four,
  and uploads and signed file links are proven on Express, Fastify and Hono.
- Errors answered as `application/problem+json` (RFC 9457) from one error mapper; an
  unexpected error answers 500 without detail.
- `security` is mandatory on every route; a route is never public by omission
  (`authz/declared`).
- OpenAPI 3.1 generated from the same declarations, deterministic, with a drift check for CI.
- Content negotiation (JSON, XML, CSV, streamed lists) and XML bodies the same way on the four:
  `mountExpress` puts a text parser on each route that `consumes` another media type,
  `mountFastify` registers a content type parser, `mountHono` reads such a body as text under
  its `bodyLimit`, Nest goes through Express or Fastify; the shared suite of the adapters holds
  it ([representations and forms](representations-and-forms.md)).
- Every request runs inside the execution scope with its correlation id when the scope is
  given in the options.
- The CLI's end-to-end proofs install and run generated projects: `proven-stacks.spec.ts`
  eight of them, seven on Express and one on Fastify (with `--di manual`), and
  `contract-pairs.spec.ts` one per pair of [contract pairs](contract-pairs.md), Express, Fastify,
  Hono on Node and NestJS (with `--di nest` and class-validator), each held to zero finding,
  its specs, its end-to-end specs and a current contract.

## Limits and when not to use it

- A body the framework itself refuses (malformed JSON, payload too large) is answered by the
  framework's own error handler on Express (`express.json()`, 100 kB by default), Fastify (1 MiB)
  and NestJS, before the pipeline: its format is not the problem format unless you configure it.
  On Hono the adapter reads the body: a body beyond `bodyLimit` (1 MiB by default) is answered 413
  `BODY_TOO_LARGE` and malformed JSON 400 `MALFORMED_BODY`, both as problems.
- Routes are JSON first. A handler may answer a string, bytes or a stream with its own
  `content-type`. An upload is declared on its controller and streams to the handler
  (`multipart/form-data`, size and media types in the contract); a large download goes through a
  signed link of the storage. Server-sent events and WebSockets are written natively in the
  framework, outside the generated contract.
- Express needs `express.json()` installed by you: the adapter does not parse bodies.
- Paths are literal segments and `:name` parameters only, the form Express and Fastify share:
  no regular expression routes, no wildcards.
- Query values arrive as strings: coerce in the schema.
- With `stack.http: none` there is no authenticator and no boundary generated: the application
  is driven by events, jobs or a transport of your own.

Do not use the kit's routes for a backend-for-frontend that mostly proxies and streams, or for
a GraphQL API: the route declaration models request and response JSON over REST.

## Recommendation by situation

| Situation | Choice |
|---|---|
| No strong habit, a plain JSON API | Express: the kit's default, the smallest surface, the widest knowledge |
| High request volume, pino already in place, plugin encapsulation wanted | Fastify |
| A service that may move to Bun, Deno or an edge runtime, or a team at home with Web standard requests | Hono (proven on Node only) |
| An existing Nest application adopting the kit context by context | NestJS, explicit style, routes of the kit for the contexts and native Nest for the rest |
| A new project, Nest chosen "because it has structure" | reconsider: the structure here comes from the kit's tree and rules; Express or Fastify with tsyringe keeps the declared style |
| No HTTP at all (worker, consumer) | `none` |

Changing later is a change of mount in the composition root and of the platform's server
file, not of routes, handlers or contract: that is what the declaration buys. Going from
Express to Fastify, for instance, is the difference between `onExpress` and `onFastify` in the
mounting sample above, plus the server's own plugins; `appointmentRoutes` and the OpenAPI
document stay as they are.

## Sources

- Express, release notes and migration guide for version 5: https://expressjs.com
- Hono on Node: https://hono.dev/docs/getting-started/nodejs
- Fastify documentation (hooks, encapsulation, validation): https://fastify.dev/docs/latest/
- NestJS documentation (pipes, guards, interceptors, exception filters, request lifecycle):
  https://docs.nestjs.com/faq/request-lifecycle
- npm registry, `express`, `fastify`, `@nestjs/core`: versions, licences, engines and weekly
  downloads read on 2026-10-10.
- RFC 9457, Problem Details for HTTP APIs: https://www.rfc-editor.org/rfc/rfc9457
- OpenAPI Specification 3.1: https://spec.openapis.org/oas/v3.1.0
- Not verified: whether NestJS 12 can run without the legacy decorator mode. No official
  statement was found; the kit generates the legacy mode for Nest.

## See also

- [Validation libraries](validation.md)
- [Dependency injection](dependency-injection.md)
- [Layers and the dependency rule](../concepts/layers-and-dependency-rule.md)
- [Invariants, permissions and validation](../concepts/invariants-permissions-validation.md)
- [Authentication and authorization](../concepts/authentication-and-authorization.md)
- [Architecture reference](../ARCHITECTURE.md) and [configuration](../CONFIG.md)

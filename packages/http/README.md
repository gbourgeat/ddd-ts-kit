**English** · [Français](README.fr.md)

# @ddd-ts-kit/http

Declare a route once, without a framework. Mount it on Express 5, Fastify 5, Hono 4 (on Node)
or NestJS, and generate the OpenAPI 3.1 contract from the same declaration.

Every adapter goes through one pipeline (`executeRoute`): validation, handler, error mapping.
The behaviour is therefore the same on the four frameworks, and one test suite proves it.

![The place of the package in an application: the adapter of each framework hands every request to the same executeRoute pipeline, which runs the handler of the route, and the handler calls a use case; the same list of routes is mounted on the server and given to generateOpenApi, which writes the contract](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/http-package-overview.svg)

The package lives in the presentation layer: it turns an HTTP request into a call of your
handler, and the answer of the handler (or its refusal) into an HTTP response. It decides
nothing about the business: the handler sends a command or a query to the application, and
the use case decides.

## Declare

<!-- checked sample -->
```ts
import { z } from 'zod';
import type { Actor } from '@ddd-ts-kit/kernel';
import { defineRoute, defineRoutes } from '@ddd-ts-kit/http';
import { zodSchema } from '@ddd-ts-kit/validation/zod';

/** The read side of the application, handed to the routes by the composition root. */
interface OrderQueries {
  byId(orderId: string, actor: Actor): Promise<{ id: string; total: number }>;
}

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
        body: await orders.byId(params.orderId, context.execution.actor),
      }),
    ),
  );
```

- `params`, `query`, `headers` and `body` are typed from the schemas. Any `Schema` of
  `@ddd-ts-kit/validation` works (zod, class-validator, TypeBox, Standard Schema).
- Paths are literal segments and `:name` parameters, the form Express and Fastify share.
- Frameworks hand query values over as strings: coerce in the schema (`z.coerce.number()`).
- `context` is `{ requestId, execution, principal?, rawHeaders?, raw, expectedVersion?, stream? }`.
  `execution` is the kernel `ExecutionContext` of the request (see "The execution context of a
  request"); `raw` is the framework's request object and `rawHeaders` the headers as they
  arrived; `expectedVersion` is read from `If-Match` (see "Conditional requests") and `stream`
  is the unparsed body of a route declared with `rawBody`.
- `security` is required: the names of the security schemes that apply, or `false` for a route
  anybody may call. A route is never public by omission: leaving it out does not compile, and
  `defineRoute` refuses an empty list, which would say the same as `false` without saying it.
- `defineRoutes` and every mount refuse a duplicate `operationId` or method and path.
- `prefixRoutes('/api', routes)` moves routes under a prefix, for the server and the contract.

A refusal is thrown, not returned. The handler answers only the success it declares; what can
go wrong is a code in `errors`, which the contract documents and the pipeline answers:

```ts
// Instead of: a 404 written by hand, a second shape of answer that every route invents again
responses: { 200: { description: 'The order.', body: order }, 404: { description: 'No such order.' } },
async ({ params }) => {
  const found = await orders.find(params.orderId);
  return found === undefined ? { status: 404 } : { status: 200, body: found };
},

// Write: the use case throws a refusal (NotFoundError, or a factory of a ConceptError) and the
// route lists its code; the answer is a problem document, the same on every route (see "Errors")
responses: { 200: { description: 'The order.', body: order } },
errors: ['NOT_FOUND'],
async ({ params, context }) => ({ status: 200, body: await orders.byId(params.orderId, context.execution.actor) }),
```

## Controllers, route groups and guards

A route may also be a class: one class per route, one method, `handle`. Its decorator is the
declaration, and the compiler holds `handle` to it: a part the schemas do not produce, or
another body than the declared response, is an error on the decorator.

<!-- checked sample -->
```ts
import { z } from 'zod';
import { AuthorizedCommand, type Actor, type CommandBus } from '@ddd-ts-kit/kernel';
import { Authenticated, Controller, RouteGroup, controllerRoutes, type HttpRequest } from '@ddd-ts-kit/http';
import type { Infer } from '@ddd-ts-kit/validation';
import { zodSchema } from '@ddd-ts-kit/validation/zod';

/** The command of the use case, in the application layer (its @Requires permission left out here). */
class PlaceOrder extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly customerId: string,
  ) {
    super(actor);
  }
}

const body = zodSchema(z.object({ customerId: z.string().min(1) }));
const placed = zodSchema(z.object({ id: z.string() }), { io: 'output' });

type PlaceOrderBody = Infer<typeof body>; // { customerId: string }
type Placed = Infer<typeof placed>; // { id: string }

@RouteGroup({ prefix: '/orders', tags: ['orders'], guards: [Authenticated], errors: ['FORBIDDEN'] })
export class OrdersRoutes {}

@Controller({
  group: OrdersRoutes,
  method: 'POST',
  path: '/',
  summary: 'Place an order',
  body,
  response: { status: 201, body: placed },
  errors: ['OUT_OF_STOCK'],
})
export class PlaceOrderController {
  constructor(private readonly commands: CommandBus) {}

  async handle({ body, actor }: HttpRequest<{ body: PlaceOrderBody }>): Promise<Placed> {
    return { id: await this.commands.execute(new PlaceOrder(actor, body.customerId)) };
  }
}

declare const application: { resolve<T>(target: abstract new (...args: never) => T): T };

export const routes = controllerRoutes([PlaceOrderController], { resolve: application.resolve });
```

The route of this controller is `POST /orders`: the prefix of its group, then its own path
(`/` is the prefix itself).
It answers 201 with `{ id }`, documents `OUT_OF_STOCK` (its own), `FORBIDDEN` (its group) and
`UNAUTHORIZED` (the `Authenticated` guard), and lets no anonymous caller reach `handle`.

| Export | What it is |
|---|---|
| `Controller(spec)` | the decorator of a controller: `group`, `method`, `path` (after the prefix of the group), `operationId` (the class name without `Controller` by default), `summary`, `description`, `tags`, `params`, `query`, `headers`, `body`, `upload` (see "Uploads and files"), `response: { status, description?, body? }`, `errors`, `guards`, `deprecated`, `cache` and `ifMatch` (see "HTTP caching") |
| `RouteGroup({ parent, prefix, tags, guards, errors, cache })` | names a set of routes on an empty class; a child inherits from its `parent` and adds; the nearest `cache` wins |
| `Guard` | the interface `{ documents?, check(request: GuardRequest) }`, and the decorator of a guard class that takes dependencies |
| `Authenticated`, `Public`, `HasRole(...roles)`, `HasScope(...scopes)`, `TenantMember` | the guards the package ships, over the `Actor` and the `Session` of the request: 401 to the anonymous caller, 403 without one of the roles, without every scope named (`Session.scopes`, typed by the `SessionScopes` of the project) or outside the tenant of the request; `Public` lets everybody in and stands alone. A refusal of a guard is reported to `onGuardRefusal` |
| `RequestMapper<Request, Message>`, `Serializer<Result, Body>` | the interfaces of the two optional translators (`map`, `serialize`), and the decorators that declare them |
| `HttpRequest<{ params, query, headers, body }>` | the request as `handle`, a mapper or a guard names it, with `actor` and `context` |
| `controllerRoutes(controllers, { resolve, security, guards })` | the `Route` of each controller, given as a class (built by `resolve`) or as an instance; `security` names the schemes of the application (`['bearer']` by default); `guards: 'skip'` is for the spec of a controller alone |
| `controllerRoute(controller, options)` | the one route of one controller, for a spec |

A controller with no group and no guard is refused when its class is defined. Guards run in
order, after validation and before `handle`, inside the execution scope of the request, and
what they throw is answered as a problem like any refusal. A guard is a control at the edge;
a permission is declared on the use case (`@Requires`), where a job and an event handler meet
it too. Controllers are declared classes of the edge (`Edge` of
`@ddd-ts-kit/kernel/declarations`): `@ddd-ts-kit/di` binds each one under itself and lists them
in `DeclaredEdges`. A controller has one response and answers its body: a route with several
success statuses, response headers or a raw body stays a `defineRoute` function. The reasons
are on the [presentation layer](../../docs/concepts/presentation-layer.md) page.

## One request, step by step

`executeRoute(route, request, options)` is the whole behaviour of the package: an adapter only
copies the request of its framework into a `RawRequest` (`params`, `query`, `headers`, `body`,
`raw`, and the body `stream`), calls it, and writes back the `RouteResponse` it returns.

![The steps executeRoute takes for one request: the identifiers, then, inside the around hook, authentication, upload, validation, If-Match, execution context and tenant, then guards and handle inside the execution scope, the check of the answer, the headers and the 304; each step that can refuse names its status, and every refusal becomes a problem document](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/http-package-pipeline.svg)

The steps that are not needed are skipped: no upload, no `If-Match`, no guard, no validator.
The first refusal ends the request: a request that is not valid never reaches a guard, and a
caller a guard refuses never reaches `handle`. Guards run after validation, so they read typed
parameters; a credential that `resolvePrincipal` rejects is refused before anything else.

Since `executeRoute` needs no server, a spec of a route calls it directly, as the adapters do:

<!-- checked sample -->
```ts
import { z } from 'zod';
import { NotFoundError } from '@ddd-ts-kit/kernel';
import { defineRoute, executeRoute, type RawRequest } from '@ddd-ts-kit/http';
import { zodSchema } from '@ddd-ts-kit/validation/zod';

const orders = new Map([['7', { id: '7', total: 42 }]]);

const getOrder = defineRoute(
  {
    method: 'GET',
    path: '/orders/:orderId',
    operationId: 'getOrder',
    summary: 'Read an order',
    request: { params: zodSchema(z.object({ orderId: z.string().regex(/^\d+$/) })) },
    responses: {
      200: { description: 'The order.', body: zodSchema(z.object({ id: z.string(), total: z.number() }), { io: 'output' }) },
    },
    errors: ['NOT_FOUND'],
    security: false,
  },
  async ({ params }) => {
    const found = orders.get(params.orderId);

    if (found === undefined) {
      throw new NotFoundError(`Order ${params.orderId} does not exist.`);
    }

    return { status: 200, body: found };
  },
);

const request = (orderId: string): RawRequest => ({ params: { orderId }, query: {}, headers: {}, body: undefined, raw: undefined });

export const found = await executeRoute(getOrder, request('7')); // 200, { id: '7', total: 42 }
export const missing = await executeRoute(getOrder, request('8')); // 404, a problem with the code NOT_FOUND
export const invalid = await executeRoute(getOrder, request('x')); // 422, VALIDATION_FAILED, one issue at params.orderId
```

Pass the options of the application as the third argument (`validateResponses: true` in
tests, `resolvePrincipal` to call as a given actor): the answer is the one the server would
send, headers included.

## HTTP caching

A read says how the caches on the way may keep its answer, on its controller, on its route
group (every read of the group, `GET` and `HEAD`, unless a controller says otherwise: a write of
the group keeps the default of a write) or on a function route (`cache` of the spec):

```ts
import { CacheScope, Public, RouteGroup } from '@ddd-ts-kit/http';

@RouteGroup({
  prefix: '/catalog',
  guards: [Public],
  cache: { scope: CacheScope.public, maxAge: '1m', sMaxAge: '5m', staleWhileRevalidate: '30s', staleIfError: '1d' },
})
export class CatalogRoutes {}
```

| Field | Answers |
|---|---|
| `scope` | `public` (every cache: a CDN, Varnish, the browser), `private` (the browser of the caller only), `no-store` (nobody) |
| `maxAge`, `sMaxAge` | `max-age`, and `s-maxage` read by shared caches instead; whole seconds as text: `'0s'`, `'30s'`, `'5m'`, `'1h'`, `'1d'` |
| `staleWhileRevalidate`, `staleIfError` | how long a stale answer may still be served while the cache asks again, or while the server fails |
| `mustRevalidate` | `must-revalidate`: once stale, never served without asking |
| `vary` | `Vary`: the request headers the answer depends on, besides the URL |

The pipeline sends `Cache-Control` (and `Vary`) on a successful answer, `no-store` on every
refusal of a route that declares a policy, and `no-store` on every answer of a route that knows
its caller and declares none: an authenticated answer is never kept by default. A public route
that declares nothing says nothing, as before. A header the handler of a function route answers
itself wins. The contract documents the headers on the answer they apply to.

A policy that cannot stand is refused when the route is declared, with a `DeclarationError`:

- a policy other than `no-store` on a write (only `GET` and `HEAD` are kept by a cache), the
  validators of a read (`etag`, `lastModified`) on a write, `ifMatch` on a read;
- `public` or `private` without `maxAge` (`'0s'` has the answer revalidated each time), a
  duration that is not whole seconds, a duration on `no-store`, `sMaxAge` on a private answer;
- **a `public` answer of a route that knows its caller** (a guard other than `Public`, a
  function route with `security`) that does not name in `vary` what it depends on. A shared
  cache keys an answer by its URL: without `vary: ['Authorization']` (or the header carrying the
  tenant), it would hand the answer of one caller to the next. `private` is the usual answer.
  The ESLint rule `presentation/shared-cache-varies` reports the same declaration in the editor,
  for what one file shows.

```ts
// Instead of: refused with a DeclarationError; a CDN would hand the agenda of one caller to the next
@RouteGroup({ prefix: '/me', guards: [Authenticated], cache: { scope: CacheScope.public, maxAge: '1m' } })

// Write: kept by the browser of the caller only
@RouteGroup({ prefix: '/me', guards: [Authenticated], cache: { scope: CacheScope.private, maxAge: '1m' } })

// Or, when a shared cache must keep it: one copy per credential
@RouteGroup({
  prefix: '/me',
  guards: [Authenticated],
  cache: { scope: CacheScope.public, maxAge: '1m', vary: ['Authorization'] },
})
```

When the routes are mounted (`mountExpress`, `mountFastify`, `createRoutesModule`), the options of
the application are known, and a public answer is held to them with a `DeclarationError`:

- on a route that knows its caller, `vary` names `Authorization`, `Cookie`, or a header the tenant
  is read from (`resolveTenant`): `vary: ['Accept-Language']` alone is refused;
- behind a cache that ignores `Vary` (`cacheTags.header` of Cloudflare or Bunny), a public answer
  that varies is refused, unless `cacheTags.honoursVary: true` says the cache keys on those
  headers;
- with tags filed per tenant (`cacheTags.perTenant`), a tagged route anybody may call needs
  `resolveTenant`: an anonymous call names no tenant otherwise, and no purge would meet its answer.

Every answer a cache may keep varies on the headers the tenant is read from (`TenantResolver.headers`:
`tenantFromHeader` names its header, `firstTenantOf` the headers of its resolvers), added to `Vary`
by the pipeline. A tagged answer filed per tenant to a request that names no tenant is `no-store`.

Never cache a decision of authorization across actors: what a caller may see is decided by the
use case for that caller, and a shared cache only ever keeps what is the same for everybody
(see [HTTP caching](../../docs/concepts/http-caching.md)).

### Conditional requests

A read that names its version answers `ETag` or `Last-Modified`, and `304 Not Modified`
without a body to a caller that already holds that version:

```ts
@Controller({
  group: CalendarsRoutes,
  method: 'GET',
  path: '/:calendarId/days/:day',
  summary: 'Get calendar day',
  params,
  response: { status: 200, body: answer },
  cache: { scope: CacheScope.private, maxAge: '0s', mustRevalidate: true, etag: 'representation' },
})
```

| Field | Answers |
|---|---|
| `etag: 'representation'` | a strong tag, the SHA-256 of the bytes sent: right for any answer, and the handler still runs (it saves the transfer, not the work) |
| `etag: { version: 'version' }` | a weak tag, `W/"7"`, from the version the body carries under that field (dotted: `calendar.version`): the version of the aggregate or of the read model shown |
| `lastModified: 'changedAt'` | `Last-Modified`, from the instant under that field (a `Date` or ISO 8601 text), compared to `If-Modified-Since` to the second |

`If-None-Match` is read first and compared weakly, `If-Modified-Since` only without it. A body
that lacks the field it names answers 500, as any answer its declaration does not allow. The
contract gains the `If-None-Match` and `If-Modified-Since` parameters, the `ETag` and
`Last-Modified` headers and the `304` answer.

A write made on the version a client read declares `ifMatch` (`IfMatch.optional` or
`IfMatch.required`). The pipeline reads the version named in `If-Match` (the weak tag the read
answered, or its strong form `"7"`) and hands it to the handler as `context.expectedVersion`; the
use case compares it with the version of the aggregate it loaded:

```ts
// the controller: new SetOpeningHoursCommand(request.actor, calendarId, ranges, request.context.expectedVersion)
// the handler of the command:
const calendar = await this.calendars.findById(command.calendarId);
expectVersion(calendar, command.expectedVersion); // PreconditionFailedError, 412, when it changed
```

| Request | Answer |
|---|---|
| `If-Match` names the current version, or `*` | the change runs |
| `If-Match` names another version, or a tag that is no version | `412 PRECONDITION_FAILED` |
| no `If-Match`, `ifMatch: 'optional'` | the change runs unconditionally, as before |
| no `If-Match`, `ifMatch: 'required'` | `428 PRECONDITION_REQUIRED`, before the handler runs |

This is optimistic concurrency at the edge: the version a person saw on the screen, not only the
one the handler loaded a millisecond earlier. Two writes at the same instant still meet the
`ConcurrencyError` of the repository. RFC 9110 compares `If-Match` strongly, under which a weak
tag never matches: the kit compares versions instead, which is what both forms name here, and
documents it. The contract gains the `If-Match` parameter and the `412` (and `428`) problems.

### Cache tags and purge after the commit

A public answer names the resources it shows, so that a shared cache files it under their tags
and drops it when one of them changes, instead of waiting for `maxAge`:

```ts
cache: {
  scope: CacheScope.public,
  maxAge: '1m',
  sMaxAge: '1h',
  tags: [{ resource: 'calendar', param: 'calendarId' }, { resource: 'appointment', field: 'items.id' }],
},
```

| Source | Tag |
|---|---|
| `{ resource, param }` | `<resource>:<value of the path parameter>` |
| `{ resource, field }` | `<resource>:<value>` for each value at that dotted path of the body (a list is walked through) |
| `{ resource }` | `<resource>`: a change of any element of that kind purges the answer (a list, a search) |

Tags are made with `cacheTag(resource, id)` of the kernel, the identifier percent-encoded. A
multi-tenant application files them under the tenant of the request (`acme/calendar:c-1`) with
`cacheTags: { header, perTenant: true }`, and its purges with `perTenant: true` of
`PublishedCacheInvalidation`: both sides or neither, or the purges miss. Tags are sent only
when the application names the header its shared cache reads, `cacheTags: { header }` of the
options: `CacheTagHeader.xkey` (Varnish), `surrogateKey` (Fastly), `cacheTag` (Cloudflare),
`cdnTag` (Bunny); without it, no answer carries tags. The contract lists them as templates in
`x-cache-tags`. Tags on a private answer, or reading a parameter the path does not have, are
refused when the route is declared.

The purge is asked by the use case and done after its commit:

```ts
// application/event-handlers/calendar-opening-hours-set.event-handler.ts: before-commit, the default phase
@DomainEventHandler(CalendarOpeningHoursSet, { name: CalendarOpeningHoursSet.eventName })
export class CalendarOpeningHoursSetEventHandler implements DomainEventHandler<CalendarOpeningHoursSet> {
  constructor(private readonly cacheInvalidation: CacheInvalidation) {}

  async handle(event: CalendarOpeningHoursSet): Promise<void> {
    await this.cacheInvalidation.invalidate([cacheTag('calendar', event.aggregateId)]);
  }
}
```

`CacheInvalidation` of the kernel publishes a purge request on the publisher of the
application, which `kernelModule()` binds by default: behind an outbox, the request is a row of
the transaction of the command. A command that rolls back purges nothing; one that commits
purges even when the process stops right after the commit, since the row waits for the next
relay. The relay hands the requests to a `CachePurger` and every other event to the broker:

<!-- checked sample -->
```ts
import { OutboxRelay, type OutboxStore } from '@ddd-ts-kit/events';
import { PurgingPublisher, type Clock, type IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { VarnishCachePurger } from '@ddd-ts-kit/http/purgers';

declare const store: OutboxStore;
declare const broker: IntegrationEventPublisher;
declare const clock: Clock;
declare const varnishUrl: string;
declare const varnishPurgeKey: string;

export const relay = new OutboxRelay({
  store,
  publisher: new PurgingPublisher(new VarnishCachePurger({ url: varnishUrl, key: varnishPurgeKey }), broker),
  clock,
});
```

A purge that fails throws: the relay retries it as it retries a publication, and a request
delivered twice purges twice, which changes nothing. A read that loaded the previous state just
before the commit can still reach the cache after the purge and stay for its `s-maxage`:
`RepeatedCachePurger` of the kernel purges once more a little later (`new
RepeatedCachePurger(varnish, { againAfterMs: 2_000 })`), best effort. Without an outbox (`events: in-memory`) the
request reaches the in-memory bus, where nothing purges: pass `cacheInvalidation` to
`kernelModule` to purge otherwise.

`@ddd-ts-kit/http/purgers` holds the adapters of the `CachePurger` port; they need no
dependency (the `fetch` of Node) and are held to `cachePurgerContract` of
`@ddd-ts-kit/testing/contracts`, which the in-memory one (`InMemoryCachePurger` of the kernel)
passes too:

| Adapter | Purges | Tag header | Verified |
|---|---|---|---|
| `VarnishCachePurger({ url, key?, mode?, soft? })` | `PURGE` with `xkey-purge` (vmod_xkey), or `xkey-softpurge` with `soft`; `mode: 'ban'` sends one `x-ban-tag` per tag, its pattern characters escaped, which the VCL turns into a ban; `key` goes in `x-purge-key`, which the VCL asks of a purge from another machine | `xkey` | the contract suite on Varnish 9.1.0 with the VCL `init --http-cache varnish` writes, in CI |
| `FastlyCachePurger({ serviceId, token, soft? })` | `POST /service/<id>/purge`, 256 surrogate keys a request | `surrogate-key` | the contract suite on a fake of the documented purge API, and the requests it sends; never run against Fastly |
| `CloudflareCachePurger({ zoneId, token })` | `POST /zones/<id>/purge_cache` with `tags`, 100 a request, on every plan | `cache-tag` | the contract suite on a fake of the documented purge API, and the requests it sends; never run against Cloudflare |

A purge that the cache does not confirm with a 2xx is a `CachePurgeError`. Bunny and the other
caches are compared on the [HTTP caches](../../docs/tools/http-caches.md) page.

## Errors

A handler throws a `DomainError`; its `code` is mapped to a status in one place and answered as
`application/problem+json` (RFC 9457):

```json
{ "type": "urn:problem:not-found", "title": "Not Found", "status": 404, "code": "NOT_FOUND",
  "detail": "Order 7 does not exist.", "requestId": "..." }
```

![How the answer to an error is chosen: an error that is not a DomainError answers 500 with no detail; a DomainError gets the status its code maps to, from the defaults, the codes of the application, else 422; a 5xx answers its status and code only, a 4xx a problem document with its detail, its exposed facts and its issues](https://raw.githubusercontent.com/gbourgeat/ddd-ts-kit/main/docs/assets/diagrams/http-package-error-answer.svg)

A refusal built by a factory of a `ConceptError` carries facts, and they are private: the
document holds, under `facts`, only the ones its factory exposed by name, and no `facts` member
when it exposed none.

<!-- checked sample -->
```ts
import { ConceptError } from '@ddd-ts-kit/kernel';

export class AppointmentError extends ConceptError {
  static slotTaken(calendarId: string, startsAt: Date) {
    return AppointmentError.refusal('SLOT_TAKEN', 'The slot is already held.', { calendarId, startsAt }).exposing('startsAt');
  }
}
```

With `SLOT_TAKEN` mapped to 409 (`createErrorMapper({ SLOT_TAKEN: 409 })`, below), a handler
that throws `AppointmentError.slotTaken('c-1', startsAt)` answers:

```json
{ "type": "urn:problem:slot-taken", "title": "Conflict", "status": 409, "code": "SLOT_TAKEN",
  "detail": "The slot is already held.", "facts": { "startsAt": "2026-03-02T09:00:00.000Z" }, "requestId": "..." }
```

`calendarId` stays in the process: the factory did not expose it.

`facts` is an optional object of the `Problem` schema of the OpenAPI document. A client
branches on `code` and reads data from `facts`, never from `detail`, which is a sentence for a
human and may change. The message is answered as it was written: it says nothing the caller
did not send, and nothing about another person. A refusal mapped to a 5xx answers neither its
message nor its facts.

<!-- checked sample -->
```ts
import type { Problem } from '@ddd-ts-kit/http';

// Instead of: data parsed out of the sentence, which breaks the day the sentence is reworded
export function startsAtFromDetail(problem: Problem): string | undefined {
  return /held at (.+)\.$/.exec(problem.detail ?? '')?.[1];
}

// Write: branch on the stable code, read the fact the refusal exposed
export function startsAtOf(problem: Problem): string | undefined {
  if (problem.code !== 'SLOT_TAKEN') {
    return undefined;
  }

  const startsAt = problem.facts?.['startsAt'];

  return typeof startsAt === 'string' ? startsAt : undefined;
}
```

Defaults: `VALIDATION_FAILED` 422 (with `issues`, paths prefixed by the part:
`body.items.0.sku`), `NOT_FOUND` 404, `CONFLICT` 409, `INVARIANT_VIOLATION` 422, `UNAUTHORIZED`
401, `FORBIDDEN` 403, `PRECONDITION_FAILED` 412, `PRECONDITION_REQUIRED` 428, and for files
`FILE_NOT_FOUND` 404, `FILE_TOO_LARGE` 413, `UNSUPPORTED_MEDIA_TYPE` 415. A domain code that is
not mapped answers 422 (`fallbackStatus` of the second argument changes it).

<!-- checked sample -->
```ts
import { createErrorMapper } from '@ddd-ts-kit/http';

export const errorMapper = createErrorMapper({ ORDER_ALREADY_SHIPPED: 409, QUOTA_EXCEEDED: 429, SLOT_TAKEN: 409 });

errorMapper.statusOf('SLOT_TAKEN'); // 409, the code of the application
errorMapper.statusOf('NOT_FOUND'); // 404, a default
errorMapper.statusOf('INVALID_EMAIL'); // 422, a code not mapped
errorMapper.typeOf('SLOT_TAKEN'); // 'urn:problem:slot-taken', the type of its problem document
```

Anything that is not a `DomainError` answers 500 `Internal Server Error` with no detail (its
code is `INTERNAL_ERROR`): the message of an unexpected error never leaves the process. Log it
from the `onError` hook, and report it to the error tracker with
`onError: reportHttpErrors(errorReporter)`: every request answered 5xx goes to the kernel
`ErrorReporter`, once, with the correlation, actor and tenant ids of its execution context
(`context.execution`, present once the request got that far); a 4xx never does.

A refusal built by a factory (`ConceptError`) answers its message as `detail` unless the message
quotes a fact the factory did not expose: then the client reads a sentence made from the code
(`INVALID_EMAIL` gives `Invalid email.`) and the message stays in the logs and the error
reports. A fact is found in the message as a text, a number or an ISO instant; a fact written
another way (a formatted date, a rounded number) is not seen, so expose what a client may
read and keep the rest out of the sentence.

## Options shared by the adapters

Every mount takes the same `ExecuteOptions`, a plain object built where the server starts:

<!-- checked sample -->
```ts
import { auditGuardRefusals } from '@ddd-ts-kit/audit';
import { CacheTagHeader, createErrorMapper, type ExecuteOptions } from '@ddd-ts-kit/http';
import type { AuditTrail, Clock, IdGenerator } from '@ddd-ts-kit/kernel';
import { tracedRoutes } from '@ddd-ts-kit/tracing';

declare function authenticate(raw: unknown): Promise<unknown>;
declare const logger: { error(fields: Record<string, unknown>): void };
declare const trail: AuditTrail;
declare const clock: Clock;
declare const ids: IdGenerator;

export const options: ExecuteOptions = {
  errorMapper: createErrorMapper({ ORDER_ALREADY_SHIPPED: 409 }),
  resolvePrincipal: (raw) => authenticate(raw), // throw UnauthorizedError to refuse
  onError: (error, { requestId, correlationId, operationId, problem }) => {
    if (problem.status >= 500) {
      logger.error({ requestId, correlationId, operationId, error });
    }
  },
  onGuardRefusal: auditGuardRefusals(trail, { clock, ids }), // the refusals at the edge, in the audit trail
  validateResponses: process.env['NODE_ENV'] === 'test', // checks answers against the declaration
  around: tracedRoutes(), // of @ddd-ts-kit/tracing: the span of the request, named by its route template
  // the header the shared cache in front reads the tags from; honoursVary and perTenant: see HTTP caching
  cacheTags: { header: CacheTagHeader.xkey },
};
```

`onGuardRefusal(refusal)` is told, and awaited, every request a guard refused before its
controller (`HasRole`, `HasScope`, `TenantMember`, a guard of the project, and a tenant the caller
does not belong to): its operation, its problem and its execution context. Those refusals reach
no use case, so the authorization hook of `@ddd-ts-kit/auth` never sees them;
`auditGuardRefusals(trail, { clock, ids })` of `@ddd-ts-kit/audit` writes each one to the audit
trail as a denied decision (an anonymous caller's excepted). Only a refusal is reported, a
`DomainError` such as `UnauthorizedError` or `ForbiddenError`: a guard that fails with another
error is a fault, answered 500 and not reported. A refusal of a handler is not reported there,
and a hook that fails does not change the answer.

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
| `tenantId` | the tenant `resolveTenant` names, once the caller is known to belong to it; the tenant of the actor otherwise |
| `locale` | the locale of the session, else the preferred language of `Accept-Language` |
| `deadline` | arrival plus `requestTimeoutMs`, when the option is set |

<!-- checked sample -->
```ts
import { principalResolver, type Authenticator } from '@ddd-ts-kit/auth';
import type { ExecuteOptions } from '@ddd-ts-kit/http';
import { Clock, ExecutionScope } from '@ddd-ts-kit/kernel';

declare const authenticator: Authenticator;
declare const app: { resolve<T>(token: abstract new (...args: never) => T): T };

export const options: ExecuteOptions = {
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

### The tenant of a request

A multi-tenant application says where a request names its tenant with `resolveTenant`:

<!-- checked sample -->
```ts
import { firstTenantOf, tenantFromClaim, tenantFromSubdomain, type ExecuteOptions } from '@ddd-ts-kit/http';

export const options: ExecuteOptions = {
  resolveTenant: firstTenantOf(tenantFromSubdomain('app.example.com'), tenantFromClaim()),
  // or tenantFromHeader('x-tenant-id'), tenantFromPath('tenantId')
};
```

| Resolver | Names |
|---|---|
| `tenantFromSubdomain(baseDomain)` | the one label left of the base domain in `Host` (`acme.app.example.com`); behind a proxy, have it pass the original host |
| `tenantFromHeader(name?)` | the value of a header, `x-tenant-id` by default |
| `tenantFromPath(parameter?)` | a path parameter, `tenantId` by default |
| `tenantFromClaim()` | the tenant of the credential, `Actor.tenantId` |
| `firstTenantOf(...resolvers)` | the first that names one |

The pipeline then checks the membership itself, before any guard or handler: an authenticated
caller that does not belong to the tenant named (its `tenantId`, or its `tenants` attribute for an
actor of several tenants) is answered 403, so a header or a subdomain chosen by a client never
opens another tenant's data. An anonymous caller keeps the tenant it addressed, for the public
routes of a tenant. The guard `TenantMember` puts a group of routes behind a tenant: 401 to the
anonymous caller, 403 to a request in no tenant or of another tenant. Platform staff do not pass
it: they reach tenants through an elevation of the kernel (`acrossTenants`), behind guards of their
own. A tenant id that no tenant can have (`*`, a list, a `:`, outside the grammar of `isTenantId`)
is answered 404 before anything reads it, whoever calls.

| Caller | Tenant named by the request | Answer |
|---|---|---|
| anonymous | any | goes on, in the tenant it addressed; a `TenantMember` route answers 401 |
| member of `acme` | `acme` | goes on, `execution.tenantId` is `acme` |
| member of `acme` | `globex` | 403, before any guard or handler, reported to `onGuardRefusal` |
| member of `acme` | none | goes on in `acme`, the tenant of the actor |
| anybody | `*` or `a,b` | 404 |

## In the composition root

The package binds and resolves nothing: routes are a plain list and `ExecuteOptions` a plain
object, both built where the server starts. What it takes from the application are ports,
resolved by their class:

<!-- checked sample -->
```ts
import { createApplication, defineContextModule, kernelModule, type ContextModule } from '@ddd-ts-kit/di';
import { ErrorMapper, createErrorMapper, type ExecuteOptions } from '@ddd-ts-kit/http';
import { Clock, ExecutionScope } from '@ddd-ts-kit/kernel';

declare const orderingModule: ContextModule; // the module of a bounded context

const httpModule = defineContextModule({
  name: 'http',
  register(builder) {
    builder.bind(ErrorMapper).toValue(createErrorMapper({ ORDER_ALREADY_SHIPPED: 409 }));
  },
});

const app = createApplication({ modules: [kernelModule(), httpModule, orderingModule] });

export const options: ExecuteOptions = {
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

One query vocabulary and one answer for every search, on top of the kernel `PageRequest` and
`Page`: `limit`, `offset` or `cursor`, and `sort` (`placedAt,-total`: comma-separated fields, a
leading `-` for descending).

<!-- checked sample -->
```ts
import { z } from 'zod';
import type { Page, PageRequest } from '@ddd-ts-kit/kernel';
import { defineRoute, pageQuerySchema, pageResponse, pageSchemaOf } from '@ddd-ts-kit/http';
import { zodSchema } from '@ddd-ts-kit/validation/zod';

interface Order {
  readonly id: string;
  readonly placedAt: Date;
  readonly total: number;
}

declare const orders: { search(page: PageRequest<'placedAt' | 'total'>): Promise<Page<Order>> };

const order = zodSchema(z.object({ id: z.string(), placedAt: z.string(), total: z.number() }), { io: 'output' });
const toOrderDto = ({ id, placedAt, total }: Order) => ({ id, placedAt: placedAt.toISOString(), total });

export const searchOrders = defineRoute(
  {
    method: 'GET',
    path: '/orders',
    operationId: 'searchOrders',
    summary: 'Search orders',
    request: { query: pageQuerySchema({ sortable: ['placedAt', 'total'], maxSize: 50 }) },
    responses: { 200: { description: 'A page of orders.', body: pageSchemaOf(order) } },
    security: ['bearer'],
  },
  async ({ query }) => ({
    status: 200, // query is a PageRequest<'placedAt' | 'total'>
    body: pageResponse(await orders.search(query), toOrderDto),
  }),
);
```

| Helper | Does |
|---|---|
| `pageRequestFrom(query, options?)` | reads the four parameters, as strings or already coerced, into a `PageRequest`; throws the `ValidationError` of the pipeline, so a wrong parameter answers 422 with one issue per parameter (`query.limit`, `query.sort`...). For a route whose query schema also has filters: declare the four parameters in that schema and call it in the handler |
| `pageQuerySchema(options?)` | the same reading as a `Schema`, for a route whose whole query is the page |
| `pageResponse(page, map)` | the JSON body `{ items, total?, nextCursor? }`, each item through `map` |
| `pageRequestParameters(options?)` | the JSON Schema of the query (one OpenAPI parameter per property); `properties` merges into a wider schema |
| `pageSchemaOf(itemSchema)` | the `Schema` of a page of items: validates the envelope and each item, describes both in the contract; shared as `<Item>Page` when the item is shared ([shared schemas](#shared-schemas)) |

`options` are the `PageLimits` of the kernel (`defaultSize` 20, `maxSize` 100) plus `sortable`,
the closed list of fields a client may sort by, and `kind`, the variant of a query that names
neither `offset` nor `cursor` (`offset` by default). Without `sortable`, a `sort` parameter is
refused: a client never chooses a column the read port did not offer. `offset` and `cursor`
together are refused. These helpers depend on no validation library; `pageQuerySchema` and
`pageSchemaOf` are plain `Schema`s and sit next to zod or class-validator schemas.

## Filters and sorting

One query grammar for every search route, on top of the kernel `Criteria`: the read port declares
what it accepts with `defineCriteria`, and the route reads the query into a criteria that
definition accepts, or answers 422.

```ts
import { criteriaQuerySchema, defineRoute, pageResponse, pageSchemaOf } from '@ddd-ts-kit/http';

const searchAppointments = defineRoute(
  {
    method: 'GET',
    path: '/appointments',
    operationId: 'searchAppointments',
    summary: 'Search appointments',
    request: { query: criteriaQuerySchema(appointmentCriteria) },
    responses: { 200: { description: 'A page of appointments.', body: pageSchemaOf(appointment) } },
    security: ['bearer'],
  },
  async ({ query, context }) => ({
    status: 200, // query is a Criteria<AppointmentRow>
    body: pageResponse(await queries.execute(new SearchAppointments(context.execution.actor, query)), toAppointmentDto),
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

<!-- checked sample -->
```ts
import express from 'express';
import type { ExecuteOptions, Route } from '@ddd-ts-kit/http';
import { mountExpress } from '@ddd-ts-kit/http/express';

declare const routes: readonly Route[]; // defineRoutes(...), controllerRoutes(...)
declare const options: ExecuteOptions;

const app = express();
app.use(express.json()); // required: the adapter does not parse bodies
mountExpress(app, routes, options); // an express.Router() works too
app.listen(3000);
```

## Fastify 5

<!-- checked sample -->
```ts
import Fastify from 'fastify';
import type { ExecuteOptions, Route } from '@ddd-ts-kit/http';
import { fastifyRoutes, mountFastify } from '@ddd-ts-kit/http/fastify';

declare const routes: readonly Route[];
declare const options: ExecuteOptions;

const app = Fastify();
mountFastify(app, routes, options);
// or, as a plugin:
await app.register(fastifyRoutes(routes, options), { prefix: '/api' });
```

## Hono 4

<!-- checked sample -->
```ts
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import type { ExecuteOptions, Route } from '@ddd-ts-kit/http';
import { mountHono } from '@ddd-ts-kit/http/hono';

declare const routes: readonly Route[];
declare const options: ExecuteOptions;

const app = new Hono();
mountHono(app, routes, { ...options, bodyLimit: 2 * 1024 * 1024 }); // bodyLimit: 1 MiB by default
serve({ fetch: app.fetch, port: 3000 });
```

The adapter reads the JSON body itself, chunk by chunk and up to `bodyLimit` bytes (1 MiB by
default, as Fastify; Express stops at 100 kB): a larger body is answered 413 as a problem
(`BODY_TOO_LARGE`), a body that is not JSON 400 (`MALFORMED_BODY`), both before the pipeline and
without holding the body whole. An upload and a raw body are read from the request stream, with
the limits their route declares, and a stream answer is streamed. A request carries `HonoRaw` as
its raw request (its headers as a record, which the authenticators of the kit read, and the
`Context` of Hono), and a repeated query parameter is a list, as on Express and Fastify. The
adapter imports nothing of Hono at run time and `node:stream` for the streams: the kit proves
Node with `@hono/node-server`, not Bun, Deno or an edge runtime.

## NestJS

No decorator per route: a module mounts the routes on the underlying HTTP server at module
init, whether Nest runs on Express or on Fastify. Handlers get their dependencies by closure.

<!-- checked sample: legacy-decorators -->
```ts
import { Module } from '@nestjs/common';
import type { ExecuteOptions, Route } from '@ddd-ts-kit/http';
import { createRoutesModule } from '@ddd-ts-kit/http/nest';

/** A token of the Nest application, exported by OrdersModule. */
abstract class OrderQueries {}

declare class OrdersModule {}
declare function orderRoutes(orders: OrderQueries): readonly Route[];
declare const options: ExecuteOptions;

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

<!-- checked sample -->
```ts
import { readFileSync, writeFileSync } from 'node:fs';
import type { ErrorMapper, Route } from '@ddd-ts-kit/http';
import { checkOpenApiDrift, generateOpenApi, stringifyOpenApi } from '@ddd-ts-kit/http/openapi';

declare const routes: readonly Route[]; // the very list the server mounts
declare const errorMapper: ErrorMapper;

const document = generateOpenApi({
  info: { title: 'Orders', version: '1.0.0' },
  servers: [{ url: 'https://api.example.com' }],
  routes,
  securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } },
  errorMapper, // the one the server runs with
});

writeFileSync('openapi/openapi.json', stringifyOpenApi(document));

// In CI: regenerate and fail on a difference.
if (checkOpenApiDrift(document, readFileSync('openapi/openapi.json', 'utf8')).drift) {
  process.exit(1);
}
```

`stringifyOpenApi` writes two-space JSON. A project generated by the CLI commits the contract in
YAML instead, `openapi/openapi.yaml`, through `stringifyContract(document, 'yaml')` of
`ddd-ts-kit/dist/contracts.js` in its `scripts/openapi.ts` (`openapi.format` of its config
chooses), and compares the text it writes with the committed one.

What is generated: `{param}` paths, one parameter per property of the params, query and headers
schemas, the request body, the declared responses, the `security` of every operation (an empty
list for a public route), one `application/problem+json` response per
status of the declared `errors` (codes listed in the description and in `x-error-codes`), 422
whenever the route validates input, a shared `Problem` schema. Local `$defs` of the schemas are
moved to `components.schemas`. Paths, statuses and component keys are sorted: the output does
not depend on the order of the routes, so the committed file diffs cleanly.

### Shared schemas

A schema several routes use is declared once and lands once in `components.schemas`; each route
points at it with `$ref`, whether it uses it whole or inside another schema. A schema is shared
when its JSON Schema is a reference to one of its own definitions, which every adapter of
`@ddd-ts-kit/validation` can produce:

| Library | Shared by |
|---|---|
| zod | `.meta({ id: 'Slot' })` on the zod schema, used whole or nested |
| class-validator | `classSchema(SlotDto, { shared: true })`; a nested class is always a component |
| TypeBox | `{ $id: 'Slot' }` in the options of the schema, used whole or nested |
| Standard Schema | the library's own ids through Standard JSON Schema, or `sharedSchema('Slot', schema)` |
| any `Schema` | `sharedSchema(name, schema)` of `@ddd-ts-kit/validation` |

A part of a shared schema (`slot.pick(...)`, `pickClass(SlotDto, [...])`) is a new shape: it is
written where it is used unless it is shared under a name of its own. Two different shapes under
one name get distinct components (`Slot`, `Slot_2`): for zod, the input and the output side of a
schema with defaults are two shapes, so a response gets an id of its own.

The platform shares three schemas of its own:

| Schema | Component | For |
|---|---|---|
| `acceptedSchema` | `Accepted`, `{ id }` | the answer of every command route that returns the identifier of what it created or changed |
| `pageSchemaOf(item)` | `<Item>Page` when the item is shared | the envelope of a search answer (`items`, `total`, `nextCursor`) |
| the problem document | `Problem` | every refusal, RFC 9457 with the stable `code` |

A shared request part (`params`, `query`, `headers`) still gives one parameter per property.

## Serving the contract and its page

<!-- checked sample -->
```ts
import type { Route } from '@ddd-ts-kit/http';
import { openApiDocsRoutes } from '@ddd-ts-kit/http/docs';
import type { OpenApiDocument } from '@ddd-ts-kit/http/openapi';

declare const orderRoutes: readonly Route[];
declare const document: OpenApiDocument; // generateOpenApi(...) of orderRoutes

export const routes = [...orderRoutes, ...openApiDocsRoutes(document, { ui: 'scalar' })];
```

Two public routes (`security: false`), mounted next to the application routes and absent
from the contract they display:
the JSON document (`jsonPath`, default `/openapi.json`) and an interactive page (`uiPath`,
default `/docs`) rendered by `ui`: `swagger` (default), `scalar` or `redoc`. The page loads the
assets of the UI from a public CDN pinned to a major version; `assetsUrl` points it at
self-hosted files when it must work offline or under a strict content security policy. A
project generated by the CLI mounts them in `src/platform/http/with-documentation.ts`, with
the UI chosen by `--docs-ui`, unless documentation is switched off by its configuration.

## A contract split into documents

<!-- checked sample -->
```ts
import type { Route } from '@ddd-ts-kit/http';
import { openApiDocumentsRoutes } from '@ddd-ts-kit/http/docs';
import { generateOpenApi, routesByDocument } from '@ddd-ts-kit/http/openapi';

declare const routes: readonly Route[];

const documents = routesByDocument(routes, [
  { name: 'public', title: 'Booking API', groups: ['AppointmentRoutes'] },
  { name: 'back-office', title: 'Back office', tags: ['audit'], operations: ['openPractice'] },
]).map(({ name, title, routes: selected }) => ({
  name,
  document: generateOpenApi({ info: { title: title ?? 'API', version: '1.0.0' }, routes: selected }),
}));

export const served = [...routes, ...openApiDocumentsRoutes(documents, { ui: 'swagger' })];
```

`routesByDocument` gives each document the routes of its route groups (a controller route
carries in `groups` the class names of its group and of every group above it), of its tags and
of its operations; a route may be in several documents, and a route in none is refused with a
`DeclarationError` naming it. Each document is generated on its own, so it holds every schema
it uses. `openApiDocumentsRoutes` serves each at `/openapi/<name>.json` with a page at
`/docs/<name>`, and on `/docs` Swagger UI with a selector between them (Scalar and Redoc show
one document at a time: `/docs` lists their pages); one document is served as
`openApiDocsRoutes` serves it. A generated project reads the documents from
`openapi.documents` of `ddd-ts-kit.config.json`, through `src/platform/http/openapi-documents.ts`.

## Uploads and files

A controller that receives a file declares it, and the declaration is the contract: the field,
the most it may weigh and the media types it may be, which the OpenAPI document states
(`multipart/form-data`, `x-max-bytes`, `x-media-types`, the 413, 415 and 422 refusals).

<!-- checked sample -->
```ts
import { z } from 'zod';
import { AuthorizedCommand, FileUpload, type Actor, type CommandBus, type ReceivedFile } from '@ddd-ts-kit/kernel';
import {
  acceptedSchema,
  Authenticated,
  Controller,
  RouteGroup,
  type Accepted,
  type HttpRequest,
  type IncomingFile,
} from '@ddd-ts-kit/http';
import { zodSchema } from '@ddd-ts-kit/validation/zod';

/** The command carries the file: the bus stages it before the transaction opens. */
class AttachDocument extends AuthorizedCommand<string> {
  readonly document: FileUpload;

  constructor(
    actor: Actor,
    readonly appointmentId: string,
    file: ReceivedFile,
  ) {
    super(actor);
    this.document = new FileUpload(file, 'appointment-documents');
  }
}

@RouteGroup({ prefix: '/appointments', guards: [Authenticated] })
export class AppointmentRoutes {}

const params = zodSchema(z.object({ appointmentId: z.string().min(1) }));
const body = zodSchema(z.object({ note: z.string().max(200).optional() })); // the text fields, sent before the file

@Controller({
  group: AppointmentRoutes,
  method: 'POST',
  path: '/:appointmentId/document',
  summary: 'Attach a document to an appointment',
  params,
  body,
  upload: { field: 'document', maxBytes: 10_000_000, mediaTypes: ['application/pdf', 'image/*'] },
  response: { status: 201, body: acceptedSchema },
})
export class AttachDocumentController {
  constructor(private readonly commands: CommandBus) {}

  async handle({
    params,
    upload,
    actor,
  }: HttpRequest<{ params: { appointmentId: string }; upload: IncomingFile }>): Promise<Accepted> {
    await this.commands.execute(new AttachDocument(actor, params.appointmentId, upload));

    return { id: params.appointmentId };
  }
}
```

The routes are mounted with an upload reader, `multipartUploads()` of `@ddd-ts-kit/http/uploads`
(on busboy, an optional peer: `npm i busboy`):

<!-- checked sample -->
```ts
import type { Express } from 'express';
import type { ExecuteOptions, Route } from '@ddd-ts-kit/http';
import { mountExpress } from '@ddd-ts-kit/http/express';
import { multipartUploads } from '@ddd-ts-kit/http/uploads';

declare const app: Express;
declare const routes: readonly Route[];
declare const options: ExecuteOptions;

mountExpress(app, routes, { ...options, uploads: multipartUploads() });
```

The file reaches `handle` while it still streams, never held whole: the command wraps it in a
`FileUpload` of the kernel, which `fileUploadsMiddleware` of the command bus stages before the
transaction opens. On its way the content is
counted, and refused with `FILE_TOO_LARGE` (413) beyond `maxBytes`; its first bytes must prove
the media type the client declared and that type must be accepted, or it is refused with
`UNSUPPORTED_MEDIA_TYPE` (415), before a byte reaches the storage. A request announcing a body
far larger than the file allowed is refused before it is read; a form without the file, 422.
Text fields sent after the file are not read. `fileName` is shown back to people, never used as
a key: the key is generated on the server.

For a large file, the client uploads straight to the storage instead: a command signs an upload
link (`FileStaging.uploadUrl`) and records the grant it answers on the aggregate, the client
sends the file to the link, and a second command confirms from that grant
(`FileStaging.confirm(pending)`, which checks the size and the media type on what arrived). A
client that drops the connection part-way fails the file stream, so a handler waiting on it
rejects instead of waiting forever.

`signedFileRoutes(storage, { prefix: '/files' })` answers the signed links of a storage the
application serves itself, the local directory of development or the memory of the tests:
`GET /files?token=` downloads (as an attachment, `nosniff`, `no-store`), `PUT /files?token=`
uploads, refused with 413 beyond the size the link was signed for. They are public, the token being the grant, and are not part of the contract. With
Express, mount them before `express.json()`: that parser reads a JSON body first. An object
store answers its own links and needs no route.

A handler may answer a stream (`Readable`) as its body: it is piped to the response, with its
own `content-type`.

## Limits

- On Express, Fastify and NestJS, a body the framework itself refuses (malformed JSON, payload
  too large) is answered by the framework's own error handler, before the pipeline runs. The
  Hono adapter reads the body itself and answers both as problems (see "Hono 4").
- Routes are JSON first. A handler may answer a string, bytes or a stream by setting its own
  `content-type` header. A request body streams only as a declared upload or a raw body
  (`rawBody`): server-sent events and WebSockets are written natively in the framework.

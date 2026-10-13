# HTTP caching

**Summary.** A read that many callers ask the same way can be answered without reaching the
application: by the browser of the caller, or by a shared cache in front of the API (Varnish, a
CDN). The answer itself says who may keep it and for how long, in `Cache-Control`; the kit has a
route declare that once, refuses a declaration that would leak the answer of one caller to
another, and answers `no-store` for every authenticated route that declares nothing. This page
says what to cache at which layer, and the one thing never to cache: a decision of
authorization made for one actor.

## Three layers, three questions

| Layer | Keeps | Lives | Invalidated by | In the running example |
|---|---|---|---|---|
| HTTP cache | whole answers, keyed by URL (and what `Vary` names) | the browser, Varnish, a CDN: outside the process | expiry (`max-age`), revalidation (`ETag`), a purge | the opening hours of a calendar, read by every patient of the practice |
| Application cache (`Cache` port) | values the application computed or fetched | the process, or a Redis protocol server | expiry, a deletion by key | the working hours a gateway read from another context |
| Read model | rows shaped for a query, kept up to date by events | the database | the events of the aggregates it follows | the agenda of a practice, searched by day |

They answer different questions. A read model answers "what is the state, shaped for this
question?" and is correct by construction, eventually. An application cache answers "have I
computed this recently?" inside the process
([cache and coordination](../tools/cache-and-coordination.md)). An HTTP cache answers "has
anybody already asked this exact URL?", and it is the only one that saves the request itself:
no connection to the application, no authentication, no query.

Choose in that order: a slow query is fixed by an index or a read model first; an expensive
computation inside a use case by the application cache; and only an answer that is the same for
many callers, read far more often than it changes, is worth an HTTP cache in front of it.

## What may be kept by whom

`Cache-Control` names the caches that may keep an answer:

- `public`: every cache on the way, shared ones included. A shared cache keys an answer by its
  URL and hands it to the next caller who asks the same URL.
- `private`: the browser of the caller only. Useful for an authenticated read the same person
  asks again (the agenda of the day), together with an `ETag` so that asking again costs a
  `304` instead of a body.
- `no-store`: nobody. The default of the kit for every route that knows its caller.

The freshness directives say for how long: `max-age` for every cache, `s-maxage` for shared
caches, `stale-while-revalidate` and `stale-if-error` for how long a stale answer may still be
served while the cache asks again or while the server fails.

## Never cache a decision of authorization across actors

What a caller may see is decided by the use case, for that caller: its permission, its access
scope, its tenant ([authentication and authorization](authentication-and-authorization.md)). An
answer that went through that decision is the answer **for that actor**. Kept by a shared cache
under its URL alone, it is served to the next actor without the decision being made again: the
patient of one practice reads the agenda of another, a revoked delegation still reads what it
read yesterday.

Hence the rule the kit holds when a route is declared: **a `public` answer of a route that
knows its caller names in `vary` the request headers it depends on**, or it is refused. With
`vary: ['Authorization']` a shared cache keeps one answer per credential, which is rarely worth
it; `private` is the usual answer. A route open to anybody (`Public`, `security: false`) shows
the same thing to everybody and may be `public` as it is.

Two subtler leaks the declaration cannot see, and a reviewer must:

- **A public route whose answer depends on something else than its URL**: a language read from
  `Accept-Language`, a tenant read from a header or the host. Name it in `vary`.
- **A shared answer that embeds the result of a permission**: a public list that leaves out
  what "the anonymous caller" may not see is fine, since every caller of it is anonymous; a
  list whose content changes with the token is not public.

## How the kit declares it

The policy is part of the declaration of the route, so the server and the OpenAPI contract say
the same thing: on a controller, on its route group (every read of the group), or in the spec
of a function route. The fields and the refusals are listed in the
[`@ddd-ts-kit/http` README](../../packages/http/README.md#http-caching).

```ts
@RouteGroup({
  prefix: '/practices',
  guards: [Public],
  cache: { scope: CacheScope.public, maxAge: '1m', sMaxAge: '5m', staleWhileRevalidate: '30s' },
})
export class PracticeDirectoryRoutes {}
```

## See also

- [Resilience](resilience.md): a cache as a stability tool, and its failure modes
- [Cache and coordination](../tools/cache-and-coordination.md): the application cache on Redis, Valkey or Dragonfly
- [The presentation layer](presentation-layer.md): controllers, route groups and guards
- [CQRS](cqrs.md): read models

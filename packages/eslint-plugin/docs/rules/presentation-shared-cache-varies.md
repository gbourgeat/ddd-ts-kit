# ddd-ts-kit/presentation-shared-cache-varies

Architecture id: `presentation/shared-cache-varies` (added by this plugin). Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: every `@Controller({...})`, `@RouteGroup({...})` and `defineRoute({...}, handler)` of `@ddd-ts-kit/http` outside the tests.

## Why

A shared cache (Varnish, a CDN) files an answer by its URL and hands it to the next caller who asks the same URL. The answer of a route that knows its caller went through a decision of authorization made for that caller: its permission, its access scope, its tenant. Kept in a shared cache, it is served to the next caller without that decision being made again. A `public` cache policy on such a route must say what the answer depends on, in `vary`, so that the cache keeps one answer per value of it; usually the answer is `private` instead.

## Reported

A `cache` whose `scope` is `CacheScope.public` (or `'public'`), with no `vary` or an empty one, on:

- a controller or a route group that writes `guards` other than `[Public]`;
- a function route that writes `security` with at least one scheme.

Incorrect:

```ts
@RouteGroup({
  prefix: '/agenda',
  guards: [Authenticated],
  cache: { scope: CacheScope.public, maxAge: '1m' },
})
export class AgendaRoutes {}
```

Correct:

```ts
@RouteGroup({
  prefix: '/agenda',
  guards: [Authenticated],
  cache: { scope: CacheScope.private, maxAge: '0s', mustRevalidate: true, etag: 'representation' },
})
export class AgendaRoutes {}
```

## Details

A controller that names its group and writes no `guards` of its own takes the guards of the group, which another file declares: it is not judged here, and `@ddd-ts-kit/http` refuses the same declaration with a `DeclarationError` when the routes are built, for every route whatever the file. The rule is the editor's early view of that refusal.

What a non-empty `vary` names is held when the routes are mounted, where the options of the application are known: it must name `Authorization`, `Cookie` or the header the tenant is read from (`vary: ['Accept-Language']` alone is refused), and a cache that ignores `Vary` (Cloudflare, Bunny) refuses a varying public answer. The rule does not judge that: one file does not show the options.

## Options

None.

`rules."presentation/shared-cache-varies"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line presentation/shared-cache-varies -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## With the CLI checker

New with this plugin: the CLI checker knows its id only; the routes are refused at run time by `@ddd-ts-kit/http`.

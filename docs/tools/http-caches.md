**English** · [Français](http-caches.fr.md)

# HTTP caches: Varnish, Souin, nginx, Fastly, Cloudflare, Bunny

**Summary.** A shared HTTP cache in front of the API answers the reads that are the same for
everybody without reaching the application. The kit sends what the cache needs (the
`Cache-Control` of each route policy, `ETag`, and the tags of the resources an answer shows) and
purges by tag after the commit of the command that changed them, through the `CachePurger` port.
What separates the candidates is how they purge: by tag at once, by tag through a ban, by URL
only, or not at all without a paid plan, and whether they honour `Vary`. Varnish with vmod_xkey
is the one the kit generates and runs in CI; Fastly and Cloudflare have adapters held to the
contract suite on a fake of the purge API each documents, never on the services; Bunny, Souin and
nginx are described, not implemented.

## What the kit asks of a shared cache

1. **Honour the policy of the route**: keep what `Cache-Control: public, s-maxage=...` allows,
   pass what is `private` or `no-store`, and never answer a request carrying `Authorization` or a
   cookie from the cache unless the route varies on it.
2. **File an answer under its tags**, read from a response header (`xkey`, `Surrogate-Key`,
   `Cache-Tag`, `CDN-Tag`), and strip that header before the client.
3. **Purge by tag**, over an API the application calls, confirmed by a 2xx: the outbox relay
   retries until it is.
4. **Revalidate** a stale answer with `If-None-Match` and keep it on a `304`.

The whole cycle, for the opening hours of a calendar in the example application: the first read
reaches the API and is filed under its tag, the next ones are answered by the cache, and the
command that changes the hours purges the tag once it has committed.

![A sequence over the client, the shared cache, the API, the database and the outbox relay: a public read is passed to the API on a miss, answered with the tag header xkey: calendar:c-1 and kept an hour under that tag; the same read is then answered from the cache; a command saves the calendar and a purge request in one transaction, and the relay sends PURGE with xkey-purge: calendar:c-1, which drops the answer](../assets/diagrams/http-caches-read-and-purge.svg)

What travels on the wire for `GET /calendars/c-1/opening-hours` of the example, behind the
Varnish the CLI generates. Its controller declares the policy of the sample further down, plus
`etag: { version: 'version' }`, which turns the `version` field of the body into the `ETag`:

```http
# 1. The API answers a miss of Varnish: the policy of the route, the version, the tags
HTTP/1.1 200 OK
Cache-Control: public, max-age=60, s-maxage=3600, stale-while-revalidate=30, stale-if-error=86400
ETag: W/"7"
xkey: calendar:c-1

# 2. Varnish answers the client: the tag header removed, x-cache added by the generated VCL
HTTP/1.1 200 OK
Cache-Control: public, max-age=60, s-maxage=3600, stale-while-revalidate=30, stale-if-error=86400
ETag: W/"7"
x-cache: MISS

# 3. Once the change of the hours has committed, the relay purges through VarnishCachePurger
PURGE / HTTP/1.1
x-purge-key: <the key Varnish was started with>
xkey-purge: calendar:c-1

HTTP/1.1 200 Purged 1
```

The tag header changes with the cache (`Surrogate-Key` for Fastly, `Cache-Tag` for Cloudflare,
`CDN-Tag` for Bunny), and so does the purge request; the route and the use case stay the same.

## Comparison

| | Varnish (xkey) | Souin | nginx (open source) | Fastly | Cloudflare | Bunny |
|---|---|---|---|---|---|---|
| Kind | self-hosted proxy | self-hosted proxy, or a Caddy, Traefik and other middleware | self-hosted proxy | CDN | CDN | CDN |
| Licence or price | open source (BSD 2-clause); see "Varnish and Vinyl" below | MIT | BSD 2-clause; purge is in the paid NGINX Plus | paid, free trial credit | free plan included | paid by traffic, no free plan |
| Tag header | `xkey` (also `X-HashTwo`) | `Surrogate-Key` | none | `Surrogate-Key` | `Cache-Tag` | `CDN-Tag` |
| Purge by tag | `xkey.purge`, immediate; or a ban on the stored header, lazy | `PURGE` with `Surrogate-Key` on its API | no: the third-party `ngx_cache_purge` purges one key (URL) at a time | `POST /service/<id>/purge`, 256 keys a request | `POST /zones/<id>/purge_cache`, 100 tags a request, every plan | `POST /pullzone/<id>/purgeCache` with one `CacheTag` |
| Soft purge (serve stale while refetching) | `xkey.softpurge` | not checked | no | `Fastly-Soft-Purge: 1` | no | not checked |
| Honours `Vary` | yes, one copy per value | yes (documented, not run) | yes, since 1.7.7 (not run) | yes | no, images aside: a varying answer is refused at the mount (`cacheTags.honoursVary` to override) | no, a fixed set of its own (query string, cookie, country): refused likewise |
| Adapter in the kit | `VarnishCachePurger` | none (its purge API is close to Varnish's; not written) | none | `FastlyCachePurger` | `CloudflareCachePurger` | none |
| Verified by the kit | the contract suite on Varnish 9.1.0 with the generated VCL, in CI | not run | not run | the contract suite on a fake of its documented purge API, and the requests checked | the contract suite on a fake of its documented purge API, and the requests checked | not run |

Figures and API shapes were read on 2026-10-13 from each vendor's documentation (Sources).

## Varnish and Vinyl

Since March 2026 the open-source project once called Varnish Cache is **Vinyl Cache** (9.0 was
its first release under that name, `vinyld` instead of `varnishd`), and Varnish Software
continues releases named Varnish Cache as a fork. The official Docker image `varnish`, which the
kit pins (`varnish:9.1.0`), is maintained by the Varnish Docker community of Varnish Software and
ships vmod_xkey among its modules. The VCL the kit writes uses `vcl 4.1` and `import xkey`; the
kit did not run it on Vinyl Cache, whose packages of vmod_xkey were not checked.

## What this kit supports and verified

- **Generated by the CLI**: `init --http-cache varnish` adds a Varnish service to the compose
  file, its VCL under `docker/varnish/default.vcl`, and wires `VarnishCachePurger` into the outbox
  relay of `main.ts`, of every service `generate service` writes, and a recording purger into the
  relay of the end-to-end application (`purges.purged`), with `cacheTags: { header:
  CacheTagHeader.xkey }`. The VCL keeps only an answer that allows it by name (`max-age` or
  `s-maxage` in `Cache-Control`): a route without a policy, a problem, a probe are never kept,
  whatever the default TTL of Varnish. It lets a purge in from its own machine, or from anywhere
  with the key it was started with (`VARNISH_PURGE_KEY`, sent by the purger in `x-purge-key`):
  the API reaches a container through its published port, from another address. A ban Varnish
  refuses is answered `500`, and the purger escapes the characters of a pattern in a tag.
- **Contract suite**: `cachePurgerContract` of `@ddd-ts-kit/testing/contracts`, passed by
  `InMemoryCachePurger`, `RepeatedCachePurger`, by `VarnishCachePurger` in both modes (xkey, ban)
  on Varnish 9.1.0, started by `pipeline/github/scripts/start-varnish.sh` in the integration job,
  and by `FastlyCachePurger` and `CloudflareCachePurger` on a fake of their purge API (path,
  credential, bound of a request, tags compared as written by Fastly and without case by
  Cloudflare, as each documents). It holds: only the answers a tag names, every tag of a request,
  a tag with the characters of a pattern taken as written, another tenant untouched, idempotence.
- **CDN adapters**: `FastlyCachePurger` and `CloudflareCachePurger` send the requests their
  documentation describes, in batches of its bound, and fail with `CachePurgeError` on anything
  but a 2xx. No account was used: the fake follows the documentation, the services were not run.
- **End to end**: the example application runs behind Varnish in CI and proves that the read of a
  calendar is served from the cache, then fetched again after the command that changes it.

The heart of the generated `docker/varnish/default.vcl`, shortened: who may purge, the two ways
to purge, and the rule that keeps only what an answer allows by name.

```vcl
sub vcl_recv {
    if (req.method == "PURGE") {
        # from this machine, or from anywhere with the key Varnish was started with
        if (client.ip !~ purgers && !(std.getenv("VARNISH_PURGE_KEY") != "" && req.http.x-purge-key == std.getenv("VARNISH_PURGE_KEY"))) {
            return (synth(403, "Forbidden"));
        }

        if (req.http.xkey-purge) {
            # every object filed under one of the tags, removed now
            set req.http.x-purged = xkey.purge(req.http.xkey-purge);
        } elsif (req.http.x-ban-tag) {
            # a ban on the xkey header the objects keep, tested as they are looked up
            if (!std.ban("obj.http.xkey ~ (^|\s)" + req.http.x-ban-tag + "(\s|$)")) {
                return (synth(500, "Ban refused: " + std.ban_error()));
            }

            set req.http.x-purged = "a ban";
        }

        return (synth(200, "Purged " + req.http.x-purged));
    }
}

sub vcl_backend_response {
    # no max-age or s-maxage: never kept, whatever the default TTL of Varnish
    if (beresp.http.cache-control !~ "(^|,)\s*(s-maxage|max-age)=") {
        set beresp.uncacheable = true;
        set beresp.ttl = 120s;

        return (deliver);
    }
}
```

## How a purge reaches the cache

A handler of a domain event of the use case asks `CacheInvalidation` to purge tags; the request
becomes a row of the outbox in the transaction of the command; after the commit the relay hands it
to `PurgingPublisher`, which sends the purge requests to the `CachePurger` port and every other
event to the broker. Of all these pieces, only the adapter behind the `CachePurger` port knows
which cache is in front.

![The pieces of a purge: an event handler asks CacheInvalidation, PublishedCacheInvalidation publishes a purge request that the outbox store writes in the transaction of the command; the OutboxRelay hands it to PurgingPublisher, which sends purge requests to the CachePurger port and every other event to the broker; VarnishCachePurger, FastlyCachePurger, CloudflareCachePurger or a purger of your own implement the port, and RepeatedCachePurger wraps one of them](../assets/diagrams/http-caches-purger-wiring.svg)

The read names its tags, and the use case that changes the resource asks for them to be purged,
with the same function (`cacheTag`), so the two always meet:

<!-- checked sample -->
```ts
import { CacheScope, Public, RouteGroup } from '@ddd-ts-kit/http';
import { cacheTag, type CacheInvalidation, type DomainEvent } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';

// presentation: every read of the group is kept an hour by a shared cache, filed under calendar:<calendarId>,
// and served stale for a day if the API fails
@RouteGroup({
  prefix: '/calendars/:calendarId',
  guards: [Public],
  cache: {
    scope: CacheScope.public,
    maxAge: '1m',
    sMaxAge: '1h',
    staleWhileRevalidate: '30s',
    staleIfError: '1d',
    tags: [{ resource: 'calendar', param: 'calendarId' }],
  },
})
export class CalendarPagesRoutes {}

// domain: what the aggregate records when its opening hours change
export class CalendarOpeningHoursSet implements DomainEvent {
  static readonly eventName = 'scheduling.calendar.opening-hours-set';

  readonly name = CalendarOpeningHoursSet.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
  ) {}
}

// application: asked before the commit (the default phase), purged after it, through the outbox
@DomainEventHandler(CalendarOpeningHoursSet, { name: CalendarOpeningHoursSet.eventName })
export class CalendarOpeningHoursSetEventHandler implements DomainEventHandler<CalendarOpeningHoursSet> {
  constructor(private readonly cacheInvalidation: CacheInvalidation) {}

  async handle(event: CalendarOpeningHoursSet): Promise<void> {
    await this.cacheInvalidation.invalidate([cacheTag('calendar', event.aggregateId)]);
  }
}
```

The platform picks the cache in two places that must agree: the tag header the routes send
(`cacheTags.header` of the options of the mount) and the purger the relay calls. `main.ts` of a
project generated with `--http-cache varnish` does the Varnish half of this; the example
application adds the second purge:

<!-- checked sample -->
```ts
import { OutboxRelay, type OutboxStore } from '@ddd-ts-kit/events';
import { CacheTagHeader } from '@ddd-ts-kit/http';
import { CloudflareCachePurger, FastlyCachePurger, VarnishCachePurger } from '@ddd-ts-kit/http/purgers';
import {
  PurgingPublisher,
  RepeatedCachePurger,
  type CachePurger,
  type Clock,
  type IntegrationEventPublisher,
} from '@ddd-ts-kit/kernel';

type CacheInFront = 'varnish' | 'fastly' | 'cloudflare';

// read from the environment by the configuration of the platform
declare const config: {
  readonly cache: CacheInFront;
  readonly varnishUrl: string;
  readonly varnishPurgeKey: string;
  readonly fastlyServiceId: string;
  readonly fastlyToken: string;
  readonly cloudflareZoneId: string;
  readonly cloudflareToken: string;
};
declare const store: OutboxStore;
declare const broker: IntegrationEventPublisher;
declare const clock: Clock;

// the header the routes send, given to the mount as cacheTags: { header: tagHeaders[config.cache] }
export const tagHeaders = {
  varnish: CacheTagHeader.xkey,
  fastly: CacheTagHeader.surrogateKey,
  cloudflare: CacheTagHeader.cacheTag,
} as const satisfies Record<CacheInFront, CacheTagHeader>;

// the purger of the same cache: only the one in front of the API is built
const purgers: Record<CacheInFront, () => CachePurger> = {
  varnish: () => new VarnishCachePurger({ url: config.varnishUrl, key: config.varnishPurgeKey }),
  fastly: () => new FastlyCachePurger({ serviceId: config.fastlyServiceId, token: config.fastlyToken }),
  cloudflare: () => new CloudflareCachePurger({ zoneId: config.cloudflareZoneId, token: config.cloudflareToken }),
};

// purge requests to the cache, purged once more 2 s later; every other event to the broker
const relay = new OutboxRelay({
  store,
  publisher: new PurgingPublisher(new RepeatedCachePurger(purgers[config.cache](), { againAfterMs: 2_000 }), broker),
  clock,
});

relay.start({ intervalMs: 1_000 });
```

## A purger of your own

Souin, Bunny or any cache with a purge API takes a class of a few lines that implements
`CachePurger`: it sends the tags, resolves on a 2xx, and throws `CachePurgeError` on anything else
so that the relay retries. Then the contract suite proves it against the real cache, as the kit
proves Varnish. The sample follows the purge API Souin documents (a `PURGE` naming the keys in
`Surrogate-Key`); the kit has not run it.

<!-- checked sample -->
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { CachePurgeError } from '@ddd-ts-kit/http/purgers';
import type { CachePurger } from '@ddd-ts-kit/kernel';
import { cachePurgerContract } from '@ddd-ts-kit/testing/contracts';

// platform/http-cache/souin-cache-purger.ts
export interface SouinCachePurgerOptions {
  /** The purge API of Souin as the application reaches it, as its `api` settings expose it. */
  readonly url: string;
  /** Default 5000. */
  readonly timeoutMs?: number;
}

export class SouinCachePurger implements CachePurger {
  constructor(private readonly options: SouinCachePurgerOptions) {}

  async purge(tags: readonly string[]): Promise<void> {
    if (tags.length === 0) {
      return;
    }

    const { url, timeoutMs = 5_000 } = this.options;
    const answer = await fetch(url, {
      method: 'PURGE',
      headers: { 'surrogate-key': tags.join(', ') },
      signal: AbortSignal.timeout(timeoutMs),
    }).catch((cause: unknown) => {
      throw new CachePurgeError(`PURGE ${url} reached no cache.`, undefined, { cause });
    });

    await answer.body?.cancel();

    // anything but a 2xx throws: the relay retries the purge request
    if (!answer.ok) {
      throw new CachePurgeError(`PURGE ${url} answered ${answer.status}.`, answer.status);
    }
  }
}

// test/integration/souin-cache-purger.contract.spec.ts: Souin in front of an origin the spec starts
declare const souin: { readonly url: string; readonly purgeUrl: string };
declare const origin: { answerUnder(path: string, tags: readonly string[]): void };
declare function servedFromCache(answer: Response): boolean; // reads the Cache-Status header of Souin

let run = 0;

cachePurgerContract(
  { describe, it, expect, beforeEach },
  {
    name: 'SouinCachePurger',
    createCache: () => {
      run += 1;
      const namespace = `/${Date.now()}-${run}`;

      return {
        purger: new SouinCachePurger({ url: souin.purgeUrl }),
        store: async (key, tags) => {
          origin.answerUnder(`${namespace}${key}`, tags);
          await fetch(`${souin.url}${namespace}${key}`).then((answer) => answer.text());
        },
        holds: async (key) => servedFromCache(await fetch(`${souin.url}${namespace}${key}`)),
      };
    },
  },
);
```

The suite holds what the relay relies on: only the answers a tag names are purged, every tag of a
request, a tag holding the characters of a pattern taken as written, the answers of another tenant
untouched, and a second purge of the same tags changes nothing.

## Limits and when not to use it

- **Purge is not instantaneous**: it happens when the relay delivers the request, after the
  commit (the interval of the relay, or at once when the relay is woken). Between the commit and
  the purge, the cache serves the previous answer. A read that must show the write it follows
  (read your writes) is not answered from a shared cache.
- **A purge request is lost with its outbox row** only if the row is purged or dead: the relay
  retries a failing cache up to `maxAttempts`, then the record is dead and the answer stays until
  `s-maxage`. Keep `s-maxage` at the staleness you accept when the cache is unreachable.
- **Header sizes**: an answer listing hundreds of resources carries hundreds of tags. Varnish
  bounds a response header at 8 KB by default (`http_resp_hdr_len`), Cloudflare at 16 KB of
  `Cache-Tag`. Tag a list by its kind (`{ resource: 'appointment' }`) rather than each item when
  it is long.
- **Bans accumulate**: in `mode: 'ban'`, each purge adds a ban that Varnish tests against the
  objects it looks up until they are all newer; prefer xkey, use bans for a Varnish without it.
- **Authenticated answers pass**: the generated VCL keeps the built-in rule that passes any
  request with `Authorization` or a cookie. A route declared `public` with `vary:
  ['Authorization']` is cached only once the VCL hashes that header: write it on purpose.
- **A read on its way when the purge runs** is kept as fresh for its whole `s-maxage`: purge twice
  (`RepeatedCachePurger`), or keep `s-maxage` short where the answer must converge (see
  [HTTP caching](../concepts/http-caching.md#a-read-on-its-way-when-the-purge-runs)).
- **The purge key is a secret in production**: the local one of `.env.example` is for development
  only. Keep the `PURGE` method off the public side of a load balancer as well: behind one, every
  client reaches Varnish from the address of the balancer.
- **Rate limits of the CDNs**: Cloudflare allows 5 purge requests a minute on its free plan,
  shared by every zone of the account. A burst of commands meets that limit; the relay retries.
- **Tenants**: a multi-tenant application files tags under the tenant (`acme/calendar:c-1`), on
  the answers and on the purges, both or neither. A tagged public route anybody may call needs
  `resolveTenant` (refused at the mount without it); a request that names no tenant is answered
  `no-store`. A tenant read from a header makes every kept answer vary on it, which Cloudflare and
  Bunny ignore: read it from the host or the path behind them.

## Recommendation by situation

![A decision tree: if no public answer is read by many callers far more often than it changes, no shared cache, only private policies and ETags; if a CDN is already in front, its adapter (Fastly, Cloudflare, or your own for Bunny); otherwise, by the proxy in front of the API: none, Varnish with the generated VCL; Caddy or Traefik, Souin with a purger of your own; nginx, no purge by tag without NGINX Plus, so a short s-maxage or Varnish behind it](../assets/diagrams/http-caches-choosing.svg)

| Situation | Choice |
|---|---|
| One instance, few readers | no shared cache: `private` policies and `ETag`s cut the transfers |
| Self-hosted, public reads read far more than written | Varnish with the generated VCL |
| Already behind Caddy or Traefik | Souin as their middleware; write a `CachePurger` on its purge API and run the contract suite against it |
| Already on nginx | no purge by tag without NGINX Plus: short `s-maxage` only, or Varnish behind it |
| Global audience, a CDN in place | its adapter (Fastly, Cloudflare), or one of a few lines on its purge API held to the contract suite |

## Sources

- Varnish image and its vmods: https://hub.docker.com/_/varnish (read on 2026-10-13; `varnish:9.1.0`
  lists `libvmod_xkey.so`).
- vmod_xkey: https://github.com/varnish/varnish-modules/blob/master/src/vmod_xkey.vcc
- Vinyl Cache 9.0 announcement: https://vinyl-cache.org/lists/pipermail/vinyl-announce/2026-March/000144.html
- Fastly purge API: https://www.fastly.com/documentation/reference/api/purging/
- Cloudflare purge by tag and limits: https://developers.cloudflare.com/cache/how-to/purge-cache/purge-by-tags/
  and https://developers.cloudflare.com/cache/how-to/purge-cache/
- Bunny purge API: https://docs.bunny.net/reference/pullzonepublic_purgecachepostbytag (not read
  in detail; not implemented).
- Souin: https://github.com/darkweak/souin (not run).
- nginx `proxy_cache`: https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_cache
- RFC 9111 (HTTP caching), RFC 9110 sections 8.8 and 13 (validators and conditional requests).

## See also

- [HTTP caching](../concepts/http-caching.md): what to cache at which layer
- [Cache and coordination](cache-and-coordination.md): the application cache on Redis, Valkey or Dragonfly
- [Transactional outbox](../concepts/transactional-outbox.md): why the purge request waits for the commit

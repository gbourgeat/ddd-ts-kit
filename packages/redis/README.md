# @ddd-ts-kit/redis

Adapters of kernel ports on the Redis protocol: the `Cache`, `Lock` and `RateLimiter` ports,
and the wake-up signal of the outbox relay. They use a small, common subset of the
protocol, so the same code runs on Redis, Dragonfly and Valkey: the choice of server is an
operational one, made in the composition root by a connection URL.

```
npm i @ddd-ts-kit/redis ioredis
```

| Entry | Holds | Imports |
|---|---|---|
| `@ddd-ts-kit/redis` | `connectRedis`, `redisHealth`, `RedisCache`, `RedisLock`, `RedisRateLimiter`, `RedisRelaySignal`, `relayWakeUpMiddleware`; re-exported from the kernel: the `Lock` and `RateLimiter` ports, `InMemoryLock`, `InMemoryRateLimiter` | the kernel, `ioredis` (peer) |
| `@ddd-ts-kit/redis/testing` | `cacheContract`, `lockContract`, `rateLimiterContract`, re-exported from `@ddd-ts-kit/testing/contracts` | `@ddd-ts-kit/testing` (optional peer), the runner you pass |

Nothing here is imported from `domain/` or `application/`. A use case depends on the port
(`Cache`, `Lock`, `RateLimiter` of the kernel); the adapter is chosen in `platform/` and bound
in the composition root.

## Connection

```ts
// src/platform/redis/redis.ts
import { connectRedis, redisHealth } from '@ddd-ts-kit/redis';

export const redis = connectRedis(config.redisUrl);          // or ioredis options, or a client you already have

export const ready = () => redisHealth(redis.client);        // { status: 'up', latencyMs } | { status: 'down', reason }
export const shutdown = () => redis.close();
```

- `connectRedis(url | options | client)` answers `{ client, close() }`. A connection it opened
  is closed by `close()`; a client it was handed is used as it is and left open, since its
  owner closes it.
- A connection opened here adds two settings to the defaults of ioredis (`FAIL_FAST`), which
  your options override: `commandTimeout: 2000` and `maxRetriesPerRequest: 1`. With the plain
  defaults, a command sent while the server is away waits for twenty reconnections before
  failing, and every request of the application waits with it.
- `redisHealth(client, { timeoutMs? })` sends one `PING`, never throws, and answers within the
  timeout: use it in a readiness probe. A cache being down is rarely a reason to stop
  receiving traffic; a lock or a rate limiter being down may be.
- Every adapter takes the ioredis client, so several share one connection. Only the relay
  signal opens a second one, to listen.

Local development, with Dragonfly:

```yaml
# compose.yaml
services:
  dragonfly:
    image: docker.dragonflydb.io/dragonflydb/dragonfly:v2.0.2
    ulimits:
      memlock: -1
    command: ['--maxmemory=512mb', '--proactor_threads=2']
    ports:
      - '127.0.0.1:6379:6379'
    volumes:
      - dragonfly:/data
volumes:
  dragonfly:
```

`REDIS_URL=redis://127.0.0.1:6379` then suits the three servers alike.

## Cache

`RedisCache` implements the kernel `Cache` port with its typed `CacheKey`.

```ts
// src/main.ts
import { CACHE, METRICS, createApplication, defineContextModule, kernelModule } from '@ddd-ts-kit/di';
import { RedisCache } from '@ddd-ts-kit/redis';

const platformModule = defineContextModule({
  name: 'platform',
  register(builder) {
    builder.rebind(CACHE).toFactory((resolve) => new RedisCache(redis.client, { namespace: 'app', metrics: resolve(METRICS) }));
  },
});

const app = createApplication({ modules: [kernelModule(), platformModule, catalogModule] });
```

`kernelModule({ cache: (resolve) => new RedisCache(...) })` does the same in one line. `cached`
of `@ddd-ts-kit/aspects` and every adapter that resolves `CACHE` then use it without knowing.
A context that wants its keys apart builds its own instance with its own `namespace`.

| Option | Default | Effect |
|---|---|---|
| `namespace` | none | every key is `<namespace>:<name>`: one per bounded context, or per application sharing a server |
| `codec` | `jsonCodec` | how a value becomes text and back. With JSON, a `Date` comes back as a string and a class instance as a plain object: cache data, not objects |
| `onError` | `miss` | a failing server costs a miss on read and a dropped write, never an exception. `throw` lets the failure through |
| `metrics` | none | counts failures as `cache_errors_total`, labels `operation` (`get`, `set`, `delete`) and `context` (the namespace) |
| `lock` | none | a `Lock` that `getOrLoad` uses across processes |

- `set(key, value, { ttlMs })` stores with `PX`, in milliseconds. Without `ttlMs` the entry
  stays until deleted or evicted by the server; `ttlMs: 0` or less deletes it.
- `deleteByPrefix('price:')` deletes every entry of the namespace whose name starts with the
  prefix and answers how many. It walks the keys with `SCAN` (200 at a time), never `KEYS`,
  and reads the prefix literally (`*`, `?`, `[` are escaped). It is not atomic: an entry
  written during the walk may survive. It is an administrative tool, not something to call per
  request; prefer short time to live values to invalidation.
- An entry that cannot be decoded is a miss and is counted.

**A cache must not take the application down.** With the default `onError: 'miss'`, a server
that is away, slow beyond the command timeout or answering errors makes the application run
as if it had no cache. Watch `cache_errors_total`: a cache that silently stopped working is a
latency incident waiting for load.

### Stampede protection

When a popular entry expires, every request that misses it computes it again at the same time.

- Inside one process, `cached` of `@ddd-ts-kit/aspects` already shares one underlying call
  among concurrent identical calls (single flight). Give it a `RedisCache` and that part is done.
- Across processes, use `getOrLoad` with a `lock`:

```ts
const cache = new RedisCache(redis.client, { namespace: 'catalog', lock: new RedisLock(redis.client, { namespace: 'catalog' }) });

const quote = await cache.getOrLoad(quoteKey(pair), () => rates.quoteOf(pair), { ttlMs: 30_000 });
```

`getOrLoad` reads the entry; on a miss the callers of this process share one computation, and
with a lock only one process computes: the others wait for its value up to `waitMs` (default
2 s), then compute it themselves. It never fails because of the lock or the server: the worst
case is the unprotected one. A failed computation is not cached.

## Lock

`RedisLock` implements the kernel `Lock` port:

```ts
interface Lock {
  acquire(key: string, options: { ttlMs: number; waitMs?: number }): Promise<LockHandle | undefined>;
}
interface LockHandle { readonly key: string; readonly fencingToken: number; release(): Promise<void> }
```

```ts
const handle = await lock.acquire('nightly-export', { ttlMs: 60_000 });
if (handle === undefined) return;            // another instance is already doing it
try {
  await exportEverything();
} finally {
  await handle.release();
}
```

`RedisLock` is the single-instance algorithm of the Redis documentation: `SET key <random
owner> NX PX ttl`, and a release that deletes the key only if it still holds that owner
(compare-and-delete), so a holder whose lock expired cannot free the lock of the next one.
`waitMs` polls every `retryDelayMs` (default 25 ms). `InMemoryLock` of the kernel is the same
contract inside one process, for tests and single instances; it is what `LOCK` of
`@ddd-ts-kit/di` is bound to until the platform rebinds it.

**What it guarantees, and what it does not.** At most one holder at a time, provided the
server keeps its data and the holder finishes within `ttlMs`. It is **not a consensus lock**.
Two holders are possible when:

- the holder is paused (garbage collection, a stalled disk, a suspended container) for longer
  than the time to live, and keeps working after the lock went to somebody else;
- the server fails over to a replica that had not received the key yet;
- the server restarts without persistence, or evicts the key under memory pressure;
- clocks, on the server side, jump.

So use it to **avoid doing work twice** (a scheduled job on several instances, the
recomputation of a cache entry, an import): cases where a rare double run costs some waste and
nothing else. Do **not** use it where two holders would break an invariant. Preventing a
double booking, a double payment or a duplicated invoice number belongs to a database
constraint (a unique index, an exclusion constraint, the optimistic version of the aggregate),
which holds whatever any process believes about a lock.

The **fencing token** grows with each acquisition of a key (`INCR`, in the same script as the
`SET`). A resource that stores the highest token it has seen can refuse a write from a stale
holder. It narrows the gap, for resources able to compare; its counter lives in the same
server and starts again if that server loses its data, so it is not a proof either.

A server that is away makes `acquire` reject: whether somebody holds the key cannot be known,
and the caller decides.

## Rate limiter

`RedisRateLimiter` implements the kernel `RateLimiter` port:

```ts
interface RateLimiter {
  consume(key: string, limit: { limit: number; windowMs: number }): Promise<{ allowed: boolean; remaining: number; retryAfterMs: number }>;
}
```

A sliding window: at any instant, at most `limit` allowed calls during the `windowMs` before
it. A refused call is not counted. `RedisRateLimiter` keeps one sorted set per key, one member
per allowed call, and decides in a single script, so concurrent calls from several instances
cannot both take the last place.

In front of the HTTP layer, before authentication cost anything (Fastify shown; the same three
lines fit an Express middleware):

```ts
// src/platform/http/rate-limit.ts
const limiter = new RedisRateLimiter(redis.client, { namespace: 'api', onError: 'allow' });

server.addHook('onRequest', async (request, reply) => {
  const decision = await limiter.consume(`ip:${request.ip}`, { limit: 120, windowMs: 60_000 });
  reply.header('RateLimit-Remaining', decision.remaining);
  if (decision.allowed) return;
  reply.header('Retry-After', Math.ceil(decision.retryAfterMs / 1000));
  return reply.code(429).send({ type: 'about:blank', title: 'Too Many Requests', status: 429, code: 'RATE_LIMITED' });
});
```

A use case that must be limited for a business reason (three password resets per hour)
depends on the `RateLimiter` port of the kernel and receives the adapter by injection
(`RATE_LIMITER` of `@ddd-ts-kit/di`); `InMemoryRateLimiter` on a `FixedClock` is its fake.

- **Exact, at a memory cost.** One member per allowed call: a key costs memory in proportion
  to its limit. Fine up to thousands per window; for tens of thousands, limit a coarser key or
  a shorter window.
- **The clock is the caller's.** Instants come from the `Clock` given to the limiter (the
  system clock by default), not from the server, so every instance must be synchronized (NTP):
  a skew between two instances shifts the window by as much. In exchange the limiter is tested
  on a fixed clock, and the script holds no arithmetic that differs between Lua versions.
- **`onError`**: `throw` (default) lets the caller decide; `allow` keeps serving without a
  limit while the server is away (the usual choice in front of an API); `deny` refuses
  everything (for the few limits that are a security control, such as login attempts).
- The key expires by itself one window after its last allowed call.

## Relay signal

An outbox relay polls. `RedisRelaySignal` lets it poll rarely and still publish at once, across
processes: the process that committed a command notifies, a relay in any other process wakes.

```ts
// the worker that relays
const signal = new RedisRelaySignal(redis.client, { channel: 'app:outbox' });
new OutboxRelay({ store, publisher, clock, wakeOn: signal }).start({ intervalMs: 5_000 });

// the API process, before the unit of work so that it notifies after the commit
commandBus.use(relayWakeUpMiddleware(signal)).use(unitOfWorkMiddleware(unitOfWork));
```

It satisfies the `RelaySignal` port of `@ddd-ts-kit/events` structurally (no dependency), with
the semantics of the in-memory signal: **a hint, never a delivery**. Publish/subscribe keeps
nothing for a subscriber that is away; a notification sent while the relay reconnects, or
before it subscribed, is lost, and the event goes out at the next poll. Keep a real
`intervalMs`. `notify()` never throws. `close()` closes the listening connection the signal
opened.

`relayWakeUpMiddleware` notifies after every command that succeeded, whether it published or
not: a spurious wake-up costs the relay one empty claim. With PostgreSQL, `LISTEN/NOTIFY` from
the outbox table does the same without another server.

## What is not here: a processed-event store

There is deliberately no `RedisProcessedEventStore`. The idempotency of a consumer only holds
if "this event was processed" commits **with** the state change it stands for
(`events/consumer-idempotent`). A mark in Redis and a change in PostgreSQL are two systems: a
crash between the two either loses the event (mark kept, change rolled back) or processes it
twice. Use the store of your database adapter (`KnexProcessedEventStore`,
`DrizzleProcessedEventStore`), in the unit of work of the consumer.

The same reasoning applies to the outbox itself and to anything that must be atomic with
business data: it lives in the database.

## Compatibility: the commands used

| Adapter | Commands |
|---|---|
| `RedisCache` | `GET`, `SET` (with `PX`), `DEL`, `SCAN` (with `MATCH`, `COUNT`) |
| `RedisLock` | `EVAL` of two scripts calling `SET` (with `NX`, `PX`), `INCR`, `GET`, `DEL` |
| `RedisRateLimiter` | `EVAL` of one script calling `ZREMRANGEBYSCORE`, `ZCARD`, `ZADD`, `PEXPIRE`, `ZRANGE` (with `WITHSCORES`) |
| `RedisRelaySignal` | `PUBLISH`, `SUBSCRIBE` |
| `redisHealth`, `close` | `PING`, `QUIT` |
| ioredis itself, at connection | `HELLO 3` (ioredis 6; replies are mapped to their classic shape), `INFO`, `CLIENT SETINFO`, and `AUTH`, `SELECT` when the URL asks |

Choices made for portability:

- Scripts are sent with `EVAL`, not `EVALSHA`: no script cache to warm or to lose behind a
  proxy or after a failover. They are a few lines each.
- Every key a script touches is declared in `KEYS`: Dragonfly refuses a script that reaches
  an undeclared key (Valkey runs it), and a cluster needs the keys for routing. The two keys of the lock share a hash tag (`{key}`).
- Lua is kept to commands and comparisons. No arithmetic on scores, no `redis.call('TIME')`,
  no `cjson`, no `redis.setresp`: Redis and Valkey embed Lua 5.1, Dragonfly Lua 5.4, and they
  differ on numbers. Measured on the two servers above: a script returning `10/4` answers `2`
  on Valkey and `2.5` on Dragonfly, and `tostring(10/2)` is `5` on one and `5.0` on the other.
- No `KEYS`, no `UNLINK`, no keyspace notifications, no streams, no modules, no functions.
- `deleteByPrefix` deletes one key per `DEL`, since a cluster refuses a `DEL` whose keys live
  in different slots.

Tested against Dragonfly v2.0.2 and Valkey 9.1.2 with ioredis 6, same suite, same results. The
suite needs a server and is skipped without `DDD_TS_KIT_TEST_REDIS_URL`:

```
docker run -d --rm --name ddd-ts-kit-test-redis -p 127.0.0.1:6390:6379 docker.dragonflydb.io/dragonflydb/dragonfly:v2.0.2
DDD_TS_KIT_TEST_REDIS_URL=redis://127.0.0.1:6390 npx vitest run packages/redis
```

The specs write under a random namespace per test and never flush the server.

## Contract suites

Each port has a suite that its in-memory implementation and its adapter both pass. An adapter
of your own (another client library, another store) is held to the same:

```ts
import { cacheContract, lockContract, rateLimiterContract } from '@ddd-ts-kit/testing/contracts';

const runner = { describe, it, expect, beforeEach };
cacheContract(runner, { name: 'MyCache', createCache: () => new MyCache(), elapse: (ms) => sleep(ms) });
lockContract(runner, { name: 'MyLock', createLock: () => new MyLock(), elapse: (ms) => sleep(ms) });
rateLimiterContract(runner, { name: 'MyLimiter', createLimiter: () => new MyLimiter(clock), elapse: (ms) => clock.advance(ms) });
```

`elapse` makes time pass for the subject: advance the clock it reads, or really wait when the
time is the server's. The suites live in `@ddd-ts-kit/testing/contracts`, with those of the
other kernel ports, where the in-memory implementations of the kernel are run against them;
`@ddd-ts-kit/redis/testing` re-exports them.

## Limits

- **One server or a primary with replicas.** A Redis Cluster works for the cache (one key per
  command) and the lock (hash tag); `deleteByPrefix` would have to scan every node, which it
  does not. Not tested on a cluster.
- **Eviction applies to everything.** A server configured to evict (`allkeys-lru`) may evict
  a lock or a rate-limit key as well as a cache entry. Use a `volatile-*` policy, or a second
  server for what is not a cache.
- **No client-side caching, no pipelining of `get`**: each read is a round trip.
- **Values are JSON by default**: `undefined`, `Date`, `Map`, `bigint` and class instances do
  not survive. Give a codec, or cache plain data.
- **The lock is not re-entrant and is not renewed**: choose `ttlMs` above the worst case of
  the work, or split the work.
- **ioredis 5** is accepted as a peer; the suites were only run with ioredis 6.

# @ddd-ts-kit/redis

Adapters of kernel ports on the Redis protocol: the `Cache`, `Lock` and `RateLimiter` ports,
the wake-up signal of the outbox relay, and an integration event provider on Redis Streams.
They use a common subset of the protocol, so the same code runs on Redis, Dragonfly and
Valkey: the choice of server is an operational one, made in the composition root by a
connection URL.

```
npm i @ddd-ts-kit/redis ioredis
```

| Entry | Holds | Imports |
|---|---|---|
| `@ddd-ts-kit/redis` | `connectRedis`, `redisHealth`, `RedisCache`, `RedisLock`, `RedisRateLimiter`, `RedisRelaySignal`, `relayWakeUpMiddleware`; re-exported from the kernel: the `Lock` and `RateLimiter` ports, `InMemoryLock`, `InMemoryRateLimiter` | the kernel, `ioredis` (peer) |
| `@ddd-ts-kit/redis/event-bus` | `RedisStreamsEventBus`, its options, topology and error types, the names of the entry fields | the kernel, `ioredis` (peer) |
| `@ddd-ts-kit/redis/testing` | `cacheContract`, `lockContract`, `rateLimiterContract`, re-exported from `@ddd-ts-kit/testing/contracts` | `@ddd-ts-kit/testing` (optional peer), the runner you pass |

Nothing here is imported from `domain/` or `application/`. A use case depends on the port
(`Cache`, `Lock`, `RateLimiter` of the kernel); the adapter is chosen in `platform/` and bound
in the composition root.

With the CLI, `init --cache redis` writes `platform/redis/open-redis.ts` (one connection, the
cache, the lock, the rate limiter, the relay signal, the readiness probe) and
`init --broker redis` writes `platform/events/create-event-provider.ts` around
`RedisStreamsEventBus`. What follows is each piece, wired by hand.

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
- Every adapter takes the ioredis client, so several share one connection. The relay signal
  opens a second one, to listen, and the event bus one per consumer name, to block on its
  reads.

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

**Credentials.** A client of ioredis keeps its options, password included, and shows them to
whoever inspects it: that cannot be changed from here, so never log a client. The adapters of
this package (`RedisCache`, `RedisLock`, `RedisRateLimiter`, `RedisRelaySignal`,
`RedisStreamsEventBus`) hold their client in a field that is not enumerable, and answer their
name to `JSON.stringify` and `util.inspect`: logging, spreading or serialising an adapter does
not lead to the client. The object `connectRedis` answers gives its `client` by name
(`redis.client`, `const { client } = redis`) and leaves it out of a spread or a log.

## Cache

`RedisCache` implements the kernel `Cache` port with its typed `CacheKey`.

```ts
// src/main.ts
import { Cache, Lock, Metrics, RateLimiter } from '@ddd-ts-kit/kernel';
import { contextModule, createApplication, defineContextModule, kernelModule } from '@ddd-ts-kit/di';
import { RedisCache, RedisLock, RedisRateLimiter } from '@ddd-ts-kit/redis';

const platformModule = defineContextModule({
  name: 'platform',
  register(builder) {
    builder.rebind(Cache).toFactory((resolve) => new RedisCache(redis.client, { namespace: 'app', metrics: resolve(Metrics) }));
    builder.rebind(Lock).toValue(new RedisLock(redis.client, { namespace: 'app' }));
    builder.rebind(RateLimiter).toValue(new RedisRateLimiter(redis.client, { namespace: 'app' }));
  },
});

const app = createApplication({ modules: [kernelModule(), platformModule, contextModule('catalog', catalogDeclarations)] });
```

A port of the kernel is an abstract class, and the class is what a binding is keyed by: the
three adapters `implements` theirs, and a use case that names `Cache`, `Lock` or `RateLimiter`
in its dependencies receives them. `kernelModule({ cache: (resolve) => new RedisCache(...), lock: ..., rateLimiter: ... })`
does the same through its options. `cached` of `@ddd-ts-kit/aspects` and everything that
resolves `Cache` then use it without knowing. A context that wants its keys apart builds its
own instance with its own `namespace`.

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
abstract class Lock {
  abstract acquire(key: string, options: { ttlMs: number; waitMs?: number }): Promise<LockHandle | undefined>;
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
contract inside one process, for tests and single instances; it is what `kernelModule()` of
`@ddd-ts-kit/di` binds `Lock` to until the platform rebinds it (`builder.rebind(Lock)`, shown
under [Cache](#cache)).

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
abstract class RateLimiter {
  abstract consume(key: string, limit: { limit: number; windowMs: number }): Promise<{ allowed: boolean; remaining: number; retryAfterMs: number }>;
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
(`builder.rebind(RateLimiter)`, shown under [Cache](#cache)); `InMemoryRateLimiter` on a
`FixedClock` is its fake.

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

It satisfies the `RelaySignal` port of `@ddd-ts-kit/events` structurally: this package does not
depend on `@ddd-ts-kit/events`, so the class does not name the port, and it is accepted wherever
a `RelaySignal` is expected, `builder.bind(RelaySignal).toValue(signal)` included. It has
the semantics of the in-memory signal: **a hint, never a delivery**. Publish/subscribe keeps
nothing for a subscriber that is away; a notification sent while the relay reconnects, or
before it subscribed, is lost, and the event goes out at the next poll. Keep a real
`intervalMs`. `notify()` never throws. `close()` closes the listening connection the signal
opened.

`relayWakeUpMiddleware` notifies after every command that succeeded, whether it published or
not: a spurious wake-up costs the relay one empty claim. With PostgreSQL, `LISTEN/NOTIFY` from
the outbox table does the same without another server.

## Event bus on Redis Streams

`RedisStreamsEventBus` is an integration event provider: an `EventBus` of the kernel that
publishes with `XADD` and resolves only when the server acknowledged every entry, so the
outbox relay can mark a record published, and consumes through one consumer group per
consumer with a blocking read on a dedicated connection, acknowledgement after the handler, a
bounded number of delayed redeliveries and a dead stream. It sits next to the RabbitMQ, Kafka
and NATS providers, passes `eventBusContract` of `@ddd-ts-kit/testing`, and runs unchanged on
Redis, Dragonfly and Valkey.

```
npm i @ddd-ts-kit/redis @ddd-ts-kit/events ioredis
```

**When to choose this.** You already run and operate Redis, Dragonfly or Valkey, the volume is
moderate (handlers of a stream run one at a time per instance), and one more server to run is
worth avoiding. You get consumer groups, redelivery, dead letters and a readable log with one
dependency. Choose RabbitMQ when you want a broker that owns delivery (publisher confirms
written to disk, quorum queues replicated before the confirmation, per-message routing), and
Kafka when you want a durable, replicated log with partitions, per-key ordering and long
retention. Here durability is what the server is configured for, and retention is bounded by
memory: see [Guarantees and limits](#guarantees-and-limits).

### Composition root

Handlers never see this package. They publish to the outbox; the relay publishes to the
streams; each consuming context subscribes through the bus under its own name.

```ts
// main.ts
import { SystemClock } from '@ddd-ts-kit/kernel';
import { OutboxPublisher, OutboxRelay, consume, subscribeAll, validatingPublisher } from '@ddd-ts-kit/events';
import { RedisStreamsEventBus } from '@ddd-ts-kit/redis/event-bus';
import { tracedPublisher, tracedSubscriber } from '@ddd-ts-kit/tracing';

const bus = new RedisStreamsEventBus({
  connection: config.redisUrl, // or ioredis options, or a client you already have (redis.client)
  prefix: 'integration-events', // the default: one stream per type, `<prefix>:<type>`
  retry: { maxAttempts: 5, delayMs: 5_000 }, // the defaults
  visibilityTimeoutMs: 60_000, // the default: above the worst case of a batch of handlers
  batchSize: 10, // the default
  onFailure: (failure) => logger.warn(failure), // codes only, never an error message
  onDelivery: ({ stream, consumer, outcome }) => deliveries.add(1, { stream, consumer, outcome }),
});

// Publishing side: handlers write to the outbox, in the transaction of the command.
const publisher = validatingPublisher(new OutboxPublisher(outboxStore), registry);

// The relay target is the bus. A record is marked published when the server answered its entry id.
const relay = new OutboxRelay({ store: outboxStore, publisher: tracedPublisher(bus), clock: new SystemClock() });
relay.start({ intervalMs: 500 });

// Consuming side: one subscriber per consuming context, named after it.
const billingEvents = tracedSubscriber(bus.forConsumer('billing'));
subscribeAll(billingEvents, [
  consume(orderPlaced, { consumer: 'billing.ordering-order-placed', processed, unitOfWork }, async (event) => {
    await commandBus.execute(new IssueInvoice(event.payload.orderId));
  }),
]);

await bus.assertTopology(); // fail at startup, not at the first event

process.on('SIGTERM', async () => {
  await relay.stop(); // the tick in progress finishes
  await bus.close(); // readers stop, the batch in progress finishes and acknowledges
});
```

- `publish(events)` sends the batch as one `MULTI` of `XADD` and resolves only when the server
  answered an entry id for **every** event. It rejects otherwise (`PUBLISH_NOT_CONFIRMED` with
  the `eventId` and a `reason` code, `BROKER_UNAVAILABLE`, `EVENT_BUS_CLOSED`). Nothing is
  buffered for later: the outbox is the buffer.
- A consumer name is required to subscribe: `bus.forConsumer('billing')` gives an
  `IntegrationEventSubscriber` for one context (a modular monolith has several, each with a
  reading connection of its own), and the `consumer` option names the one `bus.subscribe`
  works for (a service that is a single context).
- With `@ddd-ts-kit/di`, the declared integration event handlers of a context are subscribed on
  `EventSubscribers.forContext(<module name>)`. Give it the bus, and each context reads under
  its own name:

  ```ts
  import { EventSubscribers } from '@ddd-ts-kit/kernel';

  const app = createApplication({
    modules: [
      kernelModule({ eventSubscribers: () => ({ forContext: (name) => bus.forConsumer(name) }) }),
      contextModule('billing', billingDeclarations),
    ],
  });

  // or, from a later module
  builder.rebind(EventSubscribers).toValue({ forContext: (name) => bus.forConsumer(name) });
  ```
- The tracing wrappers work as with any provider (with `@ddd-ts-kit/di`, the consuming side
  is traced by `kernelModule({ instrumentation: traceApplication() })` and `tracedSubscriber`
  is left out): the bus carries `traceparent` and
  `correlationId` untouched, in the envelope and as fields of the entry, across a retry too.
  Next to the event, each handler receives the delivery (`EventDelivery` of the kernel):
  `{ attempt, maxAttempts, system: 'redis', destination, consumer }`, where `destination` is the
  stream. `@ddd-ts-kit/tracing` reads it to make one CONSUMER span per attempt; the bus names
  itself `messagingSystem: 'redis'`.
- The correlation makes the round trip. Publish through `scopedPublisher(publisher, scope)` of
  the kernel and consume with `consume(definition, { ..., scope }, handler)`: the consumer runs
  in an execution context whose `correlationId` is the one of the request that published,
  whose `causationId` is the event, and a redelivery runs in the same one. Or give the bus the
  `scope` option: every handler then runs inside it, under the name of its consumer.
- A context extracted to its own service keeps its consumer name and so its groups: nothing
  changes on the server.
- The publishing connection is the one you give, shared with the other adapters of this
  package if you hand over `redis.client`. Every consumer name reads on a duplicate of it
  (`client.duplicate()`), because a blocking read holds its connection. `close()` closes what
  the bus opened and leaves a client it was handed open.

| Option | Default | Effect |
|---|---|---|
| `connection` | required | URL, ioredis options or client. A connection opened here takes `FAIL_FAST` and a reconnection delay from `reconnect` |
| `prefix`, `streamOf` | `integration-events` | the stream of a type is `<prefix>:<type>`, or what `streamOf(type)` answers |
| `consumer` | none | the consumer `bus.subscribe` reads for |
| `instance` | host, process id, random suffix | the name of this process inside its groups; unique per process |
| `batchSize` | 10 | entries read at once per stream (`COUNT`), then handled in order, one at a time |
| `blockMs` | 1000 | how long a read waits (`BLOCK`): it bounds `close()` and the precision of the retry delay |
| `retry` | 5 attempts, 5000 ms | deliveries before the dead stream, and the wait after a failure |
| `visibilityTimeoutMs` | 60000 | idle time after which the pending entries of another instance are taken over; never less than `retry.delayMs` |
| `startFrom` | `new` | where a group this bus creates starts: what is published from then on, or `beginning` for the whole stream |
| `retention` | none | `{ maxLength }` or `{ maxAgeMs }`: trimming applied by each publication. See the limits |
| `deduplication` | none | `{ windowMs }`: the publish-side guard below |
| `scope` | none | an `ExecutionScope` every handler runs inside |
| `reconnect` | 200 ms doubling up to 30 s | delay between reconnections, and between the attempts of a reader that fails |

### Topology

`bus.describeTopology()` returns the streams and the groups as data, for a review or a
generated document; `bus.assertTopology()` creates them, idempotently. The bus also creates
its groups before it reads or publishes, and again after any failure of a reader (a server
that came back without its data has lost them). For `forConsumer('billing')` subscribed to
`ordering.order.placed`:

| Object | Name | Properties |
|---|---|---|
| events stream | `integration-events:ordering.order.placed` | one per event type, shared by every consumer; created empty by the first group (`MKSTREAM`) or by the first publication |
| consumer group | `billing`, on that stream | one per consumer name; holds its position and its pending entries; created at `$` (or `0` with `startFrom: 'beginning'`) |
| group member | the `instance` name | one per process; removed at `close()` when it leaves nothing pending |
| dead stream | `integration-events:ordering.order.placed:billing:dead` | one per consumer and type, created by the first dead letter; no group reads it |

An entry holds the envelope as JSON in the field `envelope` (`id`, `type`, `version`,
`occurredAt`, `payload`, `traceparent`, `correlationId`) and, beside it, the fields `id`,
`type`, `version`, `traceparent` and `correlation-id`: an operator reads them with `XRANGE`
without parsing the body, and any client of the protocol can consume the stream.

Two consumers of one type have a group each and both receive every event. Two instances of one
consumer are two members of its group: each event goes to one of them.

**Ordering.** One instance receives the events of a type in the order of the stream, which is
the order the server took them in. That order is broken by a redelivery (the failed event
comes back after later ones were handled) and by competing instances (two members of a group
progress independently). There is no order across types, and none per aggregate: carry a
version in the payload when it matters.

### Retry and dead-letter behaviour

1. An entry is acknowledged (`XACK`) after every handler subscribed to its type resolved. Use
   `consume` of `@ddd-ts-kit/events`: the acknowledgement then follows the commit of the unit
   of work, and a redelivery is deduplicated.
2. When a handler throws, the entry is not acknowledged: it stays in the pending entry list of
   the group, owned by this instance, and its idle time restarts at the failure. Once it has
   been idle for `retry.delayMs`, the instance claims it again (`XPENDING` with `IDLE`, then
   `XCLAIM`). A failed entry is never handled again on the spot: no hot loop.
3. The attempt number is the delivery counter the server keeps in the pending entry list: 1
   for the first read, incremented by each claim. At the `retry.maxAttempts`-th failed
   delivery the entry is copied to the dead stream with `dead-reason: max-attempts`,
   `error-code`, `attempt`, `consumer` and `entry-id` (its id in the events stream), and
   acknowledged, in one script: never one without the other.
4. The pending entries of an instance that died, or that is stuck, are taken over by another
   instance of the consumer once they have been idle for `visibilityTimeoutMs`. That delivery
   counts as an attempt. An entry that used all its attempts this way, never answered by a
   handler, goes to the dead stream with `error-code: ATTEMPTS_EXHAUSTED` without being
   handled again: an event that kills its consumers does not kill them forever.
5. An entry that does not hold an envelope (no `envelope` field, unparseable, or without `id`,
   `type`, `version`, `occurredAt`) is poison: it goes straight to the dead stream with
   `dead-reason: poison` and `error-code: POISON_ENTRY`, and no handler sees it.
6. Only codes travel: `error-code` is the `code` of the error or its class name. The message
   of an error is never logged, reported or attached, because it may quote payload data.

Delivery is at least once. An acknowledgement lost to a disconnection, a claim racing a slow
handler, a relay retry: each delivers an event twice, never zero times.

On a lost connection ioredis reconnects with the delay of `reconnect`; `publish` rejects at
once between two attempts (`BROKER_UNAVAILABLE`), so the outbox relay keeps the records and
retries them, and the readers resume where their groups are. Entries that were being handled
stay pending and are claimed again.

### Publishing twice

Redis Streams have **no publish-side deduplication**: an `XADD` that succeeded but whose
answer was lost is appended again by the retry of the relay, and both entries are delivered.
The answer is the same as for every provider: the consumer deduplicates, with a
processed-event store in the transaction of its handler (`consume`).

A cheap guard narrows the window, as an option:

```ts
new RedisStreamsEventBus({ connection, deduplication: { windowMs: 3_600_000 } });
```

Each event is then appended by a script that first looks for the key
`<stream>:<event id>:published`, appends only if it is absent, and writes it with the window
as its time to live. A relay retry within the window appends nothing and is acknowledged. It
is a guard, not a guarantee: the mark is one more key, evicted or lost with the server like
any other, and it costs one key per event for the duration of the window. Consumers still
deduplicate. Verified on Dragonfly v2.0.2, Valkey 9.1.2 and Redis 8.10.2. (Redis 8.10.2
reports a server-side idempotent append in `XINFO STREAM`; it is not used, the two other
servers do not have it.)

### Operations

What to watch, with the commands of any client (`<stream>` is `<prefix>:<type>`):

| Signal | Command | Meaning |
|---|---|---|
| outbox `stats()` (`pending`, `failed`, `dead`) | the outbox store | the publishing side: see `@ddd-ts-kit/events` |
| lag of a consumer | `XINFO GROUPS <stream>`: `lag`, `last-delivered-id` | entries not read yet: the consumer is late or stopped |
| pending entries | `XINFO GROUPS <stream>`: `pending`; detail with `XPENDING <stream> <consumer> - + 10` (owner, idle time, deliveries) | being handled, or waiting for a redelivery; a plateau means a handler that keeps failing, an idle time above the visibility timeout means nobody reads |
| depth of the dead stream | `XLEN <stream>:<consumer>:dead` | must be 0: alert on anything else |
| what died and why | `XRANGE <stream>:<consumer>:dead - + COUNT 10`: `error-code`, `dead-reason`, `attempt` | the code to look for in the logs of the consumer |
| members of a group | `XINFO CONSUMERS <stream> <consumer>` | instances; one that crashed stays listed until removed |
| memory of a stream | `XLEN <stream>`, `MEMORY USAGE <stream>` | streams only grow unless trimmed |
| `onDelivery` counted by `outcome` | this bus | rate of `retried`, `dead`, `poison` against `acknowledged` |
| `onFailure` with `kind: 'connection'` | this bus | reconnections (`CONNECTION_LOST`, `ECONNREFUSED`) and what the server refused to a reader (`REDIS_NOGROUP`) |
| `bus.deliveriesInFlight` | this bus | entries read and not settled; stuck above 0 means a handler that hangs |

Replaying dead entries, once the cause is fixed:

```ts
const replayed = await bus.replayDead({ consumer: 'billing', type: 'ordering.order.placed' }, 100);
```

It moves up to that many entries, oldest first, from the dead stream back to the events
stream, each in one script (appended, then deleted from the dead stream). The new entry has a
fresh attempt budget and carries `replay-for: billing`: the other consumers of the type
acknowledge it without handling it. A client of your own that reads the stream should skip an
entry whose `replay-for` names somebody else. Look at `dead-reason` and `error-code` first:
replaying a poison entry only kills it again.

Housekeeping:

- A consumer stopped for good: `XGROUP DESTROY <stream> <consumer>` and delete its dead
  stream. Unsubscribing only stops reading; the group keeps its position and its lag grows.
- An instance that crashed stays a member of its groups. Its pending entries are taken over
  after the visibility timeout; remove the name with `XGROUP DELCONSUMER <stream> <consumer>
  <instance>` once `XINFO CONSUMERS` shows it with 0 pending (deleting a member drops its
  pending entries).
- Trimming by hand, when no `retention` is configured: `XTRIM <stream> MINID ~ <id>` with an
  id every group has passed (`last-delivered-id` of `XINFO GROUPS`) and nothing pending below.

### Guarantees and limits

- **Durability is the server's, and it is a setting.** An entry is acknowledged when the
  server holds it in memory. What survives a crash depends on persistence: with Redis or
  Valkey and `appendonly yes`, `appendfsync everysec` (the usual setting) can lose about the
  last second of acknowledged entries and `always` none, at a cost on every write; with
  snapshots only (RDB, and Dragonfly, which persists by snapshots), everything since the last
  snapshot is lost; without persistence a restart starts empty. Replication is asynchronous:
  a failover can lose what the replica had not received. For an event log this means an event
  the relay marked published can vanish, and no consumer will ever see it. A broker that
  confirms after writing to a replicated log does not have that window. Decide whether your
  events tolerate it, set persistence accordingly, and do not purge published outbox records
  before your backup horizon.
- **The positions are in the same server.** Groups, pending entries and delivery counters are
  lost or rewound with the data. A server restored from an older snapshot delivers again what
  was handled since (consumers deduplicate); a server that lost everything gets its groups
  created again at the end of empty streams.
- **No publish-side deduplication**, as said above.
- **Retention is bounded by memory.** A stream lives in memory, entirely. By default nothing
  is trimmed. `retention: { maxLength }` (`MAXLEN ~`) and `retention: { maxAgeMs }`
  (`MINID ~`, by the clock of the publisher) trim at each publication, approximately, and
  **without regard for the groups**: an entry no consumer has read yet, or one waiting for
  its redelivery, is dropped with the rest and silently leaves the pending list at its next
  claim. Size the cap far above the worst lag you accept, or trim by hand. Dead streams are
  never trimmed.
- **Eviction applies to everything.** Under `allkeys-*` a whole stream can be evicted. Run the
  event bus on a server with `noeviction` (a publication then fails when memory is full, and
  the relay retries), not on the one that is your cache.
- **One at a time per stream and instance.** Throughput is that of your handlers in sequence;
  scale with instances, at the price of ordering. Types are handled in parallel inside a
  batch, but a turn ends when its slowest stream does.
- **The visibility timeout must exceed the worst case of a batch** (`batchSize` times the
  slowest handler): beyond it another instance takes the entries over while the first is still
  working, and they are handled twice. With slow handlers, lower `batchSize`.
- **One delay.** The same wait before every retry, no exponential backoff, precise to
  `blockMs`. A failed entry whose instance stops is retried by another one after the
  visibility timeout, not after the retry delay.
- **A redelivery runs every handler of the type again**, those that succeeded included, when
  several handlers of one consumer subscribe to the same type. Each must be idempotent.
- **A batch is one transaction on one server**: all its entries are appended, or the
  publication rejects. A rejection does not prove nothing was appended (the answer may have
  been lost); the relay retries and consumers deduplicate.
- **A new group starts at the end of the stream** by default: what was published before a
  consumer first subscribed is not delivered to it. `startFrom: 'beginning'` reads what the
  stream still holds.
- **A subscription added while the consumer is reading** is read from the next turn, up to
  `blockMs` later. Nothing is missed: its group exists before the bus publishes.
- **One server or a primary with replicas.** A read covers the streams of a consumer in one
  command and a dead letter touches two keys in one script: on a Redis Cluster the keys must
  share a slot, which a `prefix` in braces gives (`{events}`). Not tested on a cluster.
- **A crashed process leaves its name** in its groups, and a deduplication mark per event for
  the window, when the guard is on: housekeeping above.

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
| `RedisStreamsEventBus`, publishing | `MULTI`, `EXEC`, `XADD` (with `MAXLEN ~` or `MINID ~` under `retention`); under `deduplication`, `EVAL` of one script calling `GET`, `XADD`, `SET` (with `PX`) |
| `RedisStreamsEventBus`, consuming | `XGROUP CREATE` (with `MKSTREAM`), `XREADGROUP` (with `GROUP`, `COUNT`, `BLOCK`, several streams), `XACK`, `XPENDING` (extended form, with `IDLE` and with a consumer), `XCLAIM` (with a minimum idle time, and with `JUSTID`), `XGROUP DELCONSUMER`, `EVAL` of one script calling `XADD`, `XACK` |
| `RedisStreamsEventBus`, `replayDead` | `XRANGE` (with `COUNT`), `EVAL` of one script calling `XRANGE`, `XADD`, `XDEL` |
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
- No `KEYS`, no `UNLINK`, no keyspace notifications, no modules, no functions. Streams are used
  by the event bus only.
- The scripts of the event bus pass a variable number of fields with `unpack(ARGV, n)` and
  test an empty reply with `#`: both behave the same on Lua 5.1 and 5.4, checked on the three
  servers. A dead letter is a script, not a `MULTI`: a transaction would acknowledge the entry
  even if its copy to the dead stream had failed.
- Redeliveries use `XPENDING` then `XCLAIM`, not `XAUTOCLAIM`. `XAUTOCLAIM` works on the three
  servers, but answers no delivery counter, and the bounded retries need it.
- The blocking read goes through the named command of ioredis (`client.xreadgroup`), never
  `client.call('XREADGROUP')`: under RESP3, which ioredis 6 speaks, only the commands it knows
  have their reply mapped back to the classic shape.
- `deleteByPrefix` deletes one key per `DEL`, since a cluster refuses a `DEL` whose keys live
  in different slots.

What differs between the servers, as far as the event bus is concerned, and is absorbed:

- `XREADGROUP` on several streams answers every stream on Dragonfly, those without a new
  entry with an empty list; Redis and Valkey leave them out.
- A command on a stream that no longer exists is refused as `NOGROUP` by Redis and Valkey;
  Dragonfly answers `ERR no such key` to `XPENDING`. Both make the reader create its groups
  again; the code reported is `REDIS_NOGROUP` or `REDIS_ERR`.
- An empty blocking read lasted its `BLOCK` time on Dragonfly and Redis, and was measured at
  about 100 ms more on Valkey.

Tested against Dragonfly v2.0.2, Valkey 9.1.2 and Redis 8.10.2 with ioredis 6, same suite,
same results. The suite needs a server and is skipped without `DDD_TS_KIT_TEST_REDIS_URL`:

```
docker run -d --rm --name ddd-ts-kit-test-redis -p 127.0.0.1:6390:6379 docker.dragonflydb.io/dragonflydb/dragonfly:v2.0.2
DDD_TS_KIT_TEST_REDIS_URL=redis://127.0.0.1:6390 npx vitest run packages/redis
```

The specs write under a random namespace per test and never flush the server. Those of the
event bus run the contract suite (with its defaults, then with the publication guard and capped
streams), the behaviours of the provider (acknowledged publication cut mid-flight, redelivery,
dead-lettering, replay, poison, competing and separate consumers, takeover after the visibility
timeout, groups lost and created again, reconnection through a TCP relay the test cuts,
graceful close) and the whole chain from the outbox to an idempotent consumer. Each test works
under a prefix of its own and deletes its keys.

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

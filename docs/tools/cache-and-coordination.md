**English** · [Français](cache-and-coordination.fr.md)

# Cache and coordination: Redis, Dragonfly, Valkey

**Summary.** `@ddd-ts-kit/redis` implements three kernel ports on the Redis protocol: `Cache`,
`RateLimiter` and `Lock`, plus a wake-up signal for the outbox relay, a store of background jobs
and an event bus on Redis Streams ([message brokers](message-brokers.md)). It uses a common subset
of commands, so the same code runs on Redis, Valkey and Dragonfly, and the choice of server is
operational and legal (the three have different licences), not architectural. The important
part of this page is what these tools do not guarantee: a cache may be stale or absent, a rate
limiter depends on synchronized clocks, and the lock is an efficiency tool that can have two
holders. Anything that must never happen twice is guarded by a database constraint.

## Three different jobs

| Port | Question it answers | Wrong answer costs | In the running domain |
|---|---|---|---|
| `Cache` | "have I computed this recently?" | a slower or slightly stale read | `availability` caching a practitioner's working hours read through a gateway |
| `RateLimiter` | "has this caller done this too often?" | a few calls too many, or a refused call | 120 requests a minute per address in front of the API; three booking attempts a minute per client |
| `Lock` | "is somebody else already doing this work?" | the work done twice | one instance running the `notifications.send-reminders` job for a given occurrence |

None of them answers "is this slot still free?". That is the no-double-booking invariant of
`appointments`, and it is held by the aggregate and a database constraint
([invariants, permissions and validation](../concepts/invariants-permissions-validation.md)).

Use cases depend on the ports of the kernel; the adapter is chosen in `src/platform/` and
bound at the composition root. `@ddd-ts-kit/redis` is refused in `domain/` and `application/`
even when an allow-list names it (`layer/domain-purity`, `layer/application-inward` in
[ARCHITECTURE.md](../ARCHITECTURE.md)). Without a server, `kernelModule()` binds in-memory
implementations that are correct for one process and for tests.

![A gateway through the cached aspect, a route or a use case that is rate limited, and the job scheduler depend on the Cache, RateLimiter and Lock ports of the kernel; the in-memory adapters bound by kernelModule or the adapters of @ddd-ts-kit/redis implement them, the latter on one connection to Redis, Valkey or Dragonfly](../assets/diagrams/cache-and-coordination-ports-and-adapters.svg)

Moving from one instance to several changes the platform and nothing else. The example
application binds the three Redis adapters on one connection, each under its own namespace, as
`src/platform/redis/open-redis.ts` does:

<!-- checked sample -->
```ts
import { kernelModule } from '@ddd-ts-kit/di';
import { Metrics } from '@ddd-ts-kit/kernel';
import { RedisCache, RedisLock, RedisRateLimiter, connectRedis } from '@ddd-ts-kit/redis';

declare const redisUrl: string;

// redis://..., the same for Redis, Valkey and Dragonfly. Commands time out after two seconds.
const redis = connectRedis(redisUrl);

// src/platform/: the in-memory defaults of kernelModule() replaced by adapters every instance shares.
export const kernel = kernelModule({
  cache: (resolve) => new RedisCache(redis.client, { namespace: 'scheduling', metrics: resolve(Metrics) }),
  // A server that is away lets requests through rather than refusing them all.
  rateLimiter: new RedisRateLimiter(redis.client, { namespace: 'scheduling:rate', onError: 'allow' }),
  lock: new RedisLock(redis.client, { namespace: 'scheduling:lock' }),
});
```

## The three servers

Checked on 2026-10-10 against each project's GitHub repository (latest release, licence file).

| | Redis | Valkey | Dragonfly |
|---|---|---|---|
| Latest release | 8.10.2 (2026-09-17) | 9.1.2 (2026-09-01) | 2.0.2 (2026-10-07) |
| Licence | since Redis 8: your choice of RSALv2, SSPLv1 or AGPLv3; 7.2 and earlier were BSD 3-clause | BSD 3-clause | Business Source License 1.1; converts to Apache 2.0 on the change date written in the licence file (1 November 2030 on the day of the check) |
| What the licence restricts | RSALv2 and SSPLv1 restrict offering it as a managed service; AGPLv3 is copyleft over the network | nothing beyond attribution | use as part of your own product is granted; offering it as an in-memory data store service is not |
| Origin | the original project | fork of Redis 7.2 under the Linux Foundation (2024) | independent implementation of the protocol, multi-threaded |
| Embedded Lua | 5.1 | 5.1 | 5.4 |
| Persistence | append-only file and snapshots | append-only file and snapshots | snapshots |
| Protocol compatibility as the kit measured it | reference | same results as Redis on the kit's suite | same results on the kit's suite; two reply differences absorbed by the event bus; refuses a script touching an undeclared key |

Licences are summarised, not interpreted: have the terms read by whoever is responsible for
that in your organisation, especially if you resell hosting. This page did not benchmark the
servers and makes no performance claim.

## Selection criteria

1. **Licence fit.** For most internal services all three are usable; a hosting provider or a
   company with a policy against source-available or AGPL software narrows the list quickly.
2. **What your platform offers.** A managed Redis or Valkey from your cloud is one less thing
   to run.
3. **Persistence needs.** A cache needs none. A lock and a rate limiter tolerate a restart.
   Redis Streams as an event bus is another matter ([message brokers](message-brokers.md)).
4. **One server or two.** Eviction suits a cache and harms locks, rate-limit keys and streams.
5. **Do you need a server at all?** A single instance needs none of this: the in-memory ports
   are enough.

## What this kit supports and verified

From [`packages/redis/README.md`](../../packages/redis/README.md) and
[`packages/kernel/README.md`](../../packages/kernel/README.md):

- **Tested against** Dragonfly 2.0.2, Valkey 9.1.2 and Redis 8.10.2 with ioredis 6, the same
  suite with the same results. ioredis 5 is accepted as a peer; nothing was run on it. The
  suite needs a server and is skipped when no URL is given.
- **Contract suites** (`cacheContract`, `lockContract`, `rateLimiterContract`) that the
  in-memory implementation and the adapter both pass; an adapter of your own is held to them.
- **Portability choices**: scripts sent with `EVAL` and every key declared; no arithmetic in
  Lua (the two Lua versions differ on numbers); no `KEYS`, modules, functions or keyspace
  notifications.
- **Connection**: a command timeout of two seconds and one retry per request by default, so a
  server that is away fails fast instead of stalling every request; `redisHealth` for a
  readiness probe.

- **Generated by the CLI**: `init --cache redis` writes `src/platform/redis/open-redis.ts`
  (one connection behind `REDIS_URL`) and rebinds the kernel `Cache`, `RateLimiter` and `Lock`
  to it in the platform module, with the relay signal for the outbox; the compose file runs
  Dragonfly 2.0.2 for local development. Without the option the three stay in the memory of
  the process. `init --queue redis` binds `RedisJobStore` for the background jobs, and
  `init --broker redis` the event bus on Redis Streams.
- **Background jobs**: `RedisJobStore` is the `JobStore` of `@ddd-ts-kit/scheduling` on the
  same servers. Redis cannot join the transaction of the database: a job added inside a unit
  of work is written once it committed, and a process that dies in between loses that write
  silently. A write Redis refuses after the commit is passed to `onLostJob`, which
  `reportLostJobs(logger, errors)` logs and reports. With a database, the jobs table of the ORM
  package is the safer store ([background jobs](../concepts/background-jobs.md)).

**Cache.** Typed keys, a namespace per context or application, time to live in milliseconds.
A failing server is a miss on read and a dropped write by default: the application runs as if
it had no cache, and `cache_errors_total` is the signal to watch. `getOrLoad` protects against
a stampede: callers of one process share a computation, and with a lock only one process
computes while the others wait up to `waitMs` for the lock, then answer the value it stored, or
compute it themselves when it is still missing. It never fails because of the lock. The
`cached` aspect refuses to wrap a repository or a use case unless explicitly allowed: an
aggregate served from a cache hides that it is stale, and the next command would decide on old
state.

![getOrLoad on a miss: a computation already running in this process is shared; otherwise, without the lock option of RedisCache, it runs load and stores the value with its time to live; with it, it takes the lock, waiting up to waitMs, reads the entry again and answers it when another process filled it meanwhile, or runs load, stores the value and releases the lock](../assets/diagrams/cache-and-coordination-get-or-load.svg)

What to cache, and where. Instead of caching what a command decides on:

```ts
// AspectNotAllowedError as soon as the repository is wrapped
builder.bind(AppointmentRepository).toClass(KnexAppointmentRepository).as('repository')
  .with(cached({ key: (method, [id]) => `appointment:${String(id)}`, ttlMs: 60_000 }));
```

cache what is read from elsewhere and may be a little old, from the composition root, so that
the gateway itself knows nothing of it:

<!-- checked sample -->
```ts
import { cached } from '@ddd-ts-kit/aspects';
import type { Cache } from '@ddd-ts-kit/kernel';

interface WorkingHours {
  readonly practitionerId: string;
  readonly opensAt: string;
  readonly closesAt: string;
}

// contexts/availability/application/ports/calendar.gateway.ts
export abstract class CalendarGateway {
  abstract workingHoursOf(practitionerId: string): Promise<WorkingHours>;
}

declare const httpCalendars: CalendarGateway; // the adapter that calls the calendars context
declare const cache: Cache; // RedisCache with several instances, InMemoryCache with one

// src/platform/: five minutes of staleness are acceptable for working hours.
export const calendars = cached({
  key: (method, [practitionerId]) => (method === 'workingHoursOf' ? `working-hours:${String(practitionerId)}` : undefined),
  ttlMs: 5 * 60_000,
  cache,
})(httpCalendars, { kind: 'gateway', context: 'availability' });
```

Concurrent identical calls share one call to the calendars context; a failed call is not cached;
a cache that fails is a miss. With a container, the same aspect goes on the binding:
`.as('gateway').with(cached({ ... }))`.

**Rate limiter.** An exact sliding window: one sorted-set member per allowed call, decided in
one script, so concurrent instances cannot both take the last place. A refused call is not
counted. `onError` chooses between `throw` (default), `allow` (usual in front of an API) and
`deny` (for limits that are a security control).

A limit that is a business rule ("three booking attempts a minute per client") belongs to the
use case, which depends on the port and refuses with a code of its own:

<!-- checked sample -->
```ts
import { ConceptError, RateLimiter } from '@ddd-ts-kit/kernel';

export class BookingError extends ConceptError {
  static tooManyAttempts(retryAfterMs: number) {
    return BookingError.refusal('TOO_MANY_BOOKING_ATTEMPTS', 'Too many booking attempts, try again later.', {
      retryAfterMs,
    });
  }
}

// contexts/appointments/application/: called by the handler of BookAppointment before anything else.
export class BookingAttempts {
  constructor(private readonly limiter: RateLimiter) {}

  async admit(clientId: string): Promise<void> {
    const decision = await this.limiter.consume(`booking:${clientId}`, { limit: 3, windowMs: 60_000 });

    if (!decision.allowed) {
      throw BookingError.tooManyAttempts(decision.retryAfterMs);
    }
  }
}
```

In a spec, `InMemoryRateLimiter` on a `FixedClock` is its fake: advance the clock by a minute
and the fourth attempt is admitted.

**Lock.** The single-instance algorithm of the Redis documentation: `SET NX PX` with a random
owner, release by compare-and-delete, a fencing token incremented in the same script.

**Relay signal.** Publish/subscribe used as a hint to wake the outbox relay; a lost
notification only delays publication until the next poll.

## What the lock does and does not guarantee

It guarantees at most one holder at a time **provided** the server keeps its data and the
holder finishes within `ttlMs`. It is not a consensus lock. The README lists when two holders
exist at once:

- the holder is paused (garbage collection, a stalled disk, a suspended container) longer
  than the time to live and resumes working;
- the server fails over to a replica that had not received the key;
- the server restarts without persistence, or evicts the key under memory pressure;
- clocks on the server side jump.

![Instance A acquires the lock with a time to live of 60 seconds and gets token 41, then is paused for 90 seconds; the key expires; instance B acquires it and gets token 42 and writes with it; A resumes and writes with token 41, which a store that remembers the highest token refuses](../assets/diagrams/cache-and-coordination-two-holders.svg)

The **fencing token** narrows this for resources able to compare: a store that remembers the
highest token it has seen refuses the write carrying 41 after it saw 42. It is not a proof
either: the counter lives in the same server and restarts if that server loses its data. The
lock is also **not re-entrant and not renewed**: choose `ttlMs` above the worst case of the
work, or split the work. A server that is away makes `acquire` reject, since nobody can know
whether the key is held.

A store compares tokens with a condition on its write. Here the row of an export keeps the
token of the holder that wrote it last, and a holder whose lock expired changes nothing:

<!-- checked sample -->
```ts
import type { LockHandle } from '@ddd-ts-kit/kernel';

interface Database {
  execute(sql: string, values: readonly unknown[]): Promise<{ readonly rowCount: number }>;
}

/** Answers false when a newer holder of the lock already wrote: this one was paused past its ttlMs. */
export async function writeExport(database: Database, holder: LockHandle, content: string): Promise<boolean> {
  const { rowCount } = await database.execute(
    'update exports set content = $1, fencing_token = $2 where id = $3 and fencing_token <= $2',
    [content, holder.fencingToken, 'nightly'],
  );

  return rowCount === 1;
}
```

Hence the rule the kernel states of `Lock` itself: an efficiency tool, never the guard of an
invariant. Instead of guarding the no-double-booking invariant with it:

```ts
// a pause past five seconds, a failover, an eviction: and two bookings of one slot get in
const handle = await lock.acquire(`slot:${practitionerId}:${startsAt}`, { ttlMs: 5_000 });
if (handle === undefined) {
  throw AppointmentError.slotTaken(practitionerId, startsAt);
}
await appointments.save(Appointment.book(practitionerId, startsAt));
```

leave the invariant to the aggregate and to a constraint of the database (the exclusion
constraint of the [persistence page](persistence.md)), and keep the lock for work whose double
run only costs work, such as sending this morning's reminders through a command that skips
what was already sent:

<!-- checked sample -->
```ts
import type { Lock } from '@ddd-ts-kit/kernel';

declare function sendTodaysReminders(): Promise<void>; // idempotent: a reminder already sent is skipped

export async function sendRemindersOnce(lock: Lock, day: string): Promise<void> {
  const handle = await lock.acquire(`notifications.send-reminders:${day}`, { ttlMs: 15 * 60_000 });

  if (handle === undefined) {
    return; // another instance is sending them, or has sent them
  }

  // Not released at the end: an instance whose timer fires a little later finds the key still
  // held and sends nothing. The lock frees itself after ttlMs.
  await sendTodaysReminders();
}
```

A scheduled job declared `singleInstance` gets this from the scheduler of
`@ddd-ts-kit/scheduling`, which takes the lock under `job:<name>:<scheduled instant>` before each
occurrence; the others record `skipped-locked`
([scheduled jobs](../concepts/scheduled-jobs.md)).

| Need | Right tool | Why |
|---|---|---|
| one instance sends this morning's reminders | `Lock`, and an idempotent command | a rare double run wastes work; the command sends each reminder once anyway |
| recompute an expensive cache entry once | `Lock` through `getOrLoad` | worst case is the unprotected computation |
| a practitioner is never double booked | exclusion or unique constraint in the `appointments` schema, plus the aggregate | holds whatever any process believes about a lock |
| an appointment is not rescheduled by two requests at once | optimistic concurrency on the aggregate `version` | the second writer gets a conflict |
| an integration event is handled once per consumer | processed-event store in the consumer's transaction | a mark in Redis and a change in PostgreSQL are two systems |
| a job occurrence runs exactly once and survives a crash | not available: a row in a table processed by a repeatable job | [scheduled jobs](../concepts/scheduled-jobs.md) |

## Limits and when not to use it

Stated by the package:

- **One server or a primary with replicas.** A Redis Cluster works for the cache and the lock;
  `deleteByPrefix` does not scan every node. Not tested on a cluster.
- **Eviction applies to everything.** Under `allkeys-lru` a lock or a rate-limit key can be
  evicted like a cache entry. Use a `volatile-*` policy, or a second server for what is not a
  cache.
- **No client-side caching, no pipelining of reads**: each `get` is a round trip.
- **Values are JSON by default**: `Date`, `Map`, `bigint` and class instances do not survive.
  Cache plain data.
- **`deleteByPrefix` is not atomic** and is an administrative tool; prefer short times to live
  to invalidation.
- **Rate limiter memory** grows with the limit (one member per allowed call): fine up to
  thousands per window. **Its clock is the caller's**: instances must be synchronized, and a
  skew shifts the window by as much.
- **No processed-event store on Redis**, deliberately, and no outbox: what must be atomic with
  business data lives in the database.

When not to use a cache: in front of a repository of aggregates; to hide a slow query that an
index or a read model would fix; when the data must be correct at the instant of a decision.
When not to use the lock: whenever the sentence describing the need contains "never".

## Recommendation by situation

| Situation | Choice |
|---|---|
| One instance | no server: the in-memory ports of `kernelModule()` |
| Several instances, a cache and jobs, no licence constraint | any of the three; the generated compose file runs Dragonfly for local development |
| A policy requiring a permissive open-source licence | Valkey |
| Managed service from your cloud provider | whatever it offers that speaks the protocol; run the contract suites against it once |
| Cache plus Redis Streams as the event bus | two servers or two policies: the bus needs `noeviction` and persistence |
| A hard mutual exclusion requirement | not this package: a database constraint, or a consensus system you operate knowingly |

## Sources

- Redis documentation, distributed locks (the single-instance pattern and its limits):
  https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/
- Martin Kleppmann, "How to do distributed locking" (2016), on pauses and fencing tokens:
  https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html
- Redis licence: https://github.com/redis/redis/blob/unstable/LICENSE.txt ; Valkey:
  https://github.com/valkey-io/valkey ; Dragonfly licence:
  https://github.com/dragonflydb/dragonfly/blob/main/LICENSE.md (all read on 2026-10-10)
- Redis eviction policies: https://redis.io/docs/latest/develop/reference/eviction/
- Michael Nygard, Release It!, 2nd edition, Pragmatic Bookshelf, 2018 (caching as a stability
  risk).
- Martin Kleppmann, Designing Data-Intensive Applications, O'Reilly, 2017, chapter 8.
- Not verified: the persistence modes of Dragonfly beyond what the kit's README states
  (snapshots); behaviour of any of the three under cluster mode.

## See also

- [Resilience](../concepts/resilience.md)
- [Scheduled jobs](../concepts/scheduled-jobs.md)
- [Aggregates](../concepts/aggregates.md)
- [Delivery and idempotency](../concepts/delivery-and-idempotency.md)
- [Message brokers](message-brokers.md)
- [Persistence](persistence.md)
- [HTTP caches](http-caches.md): the shared cache in front of the API, Varnish and the CDNs

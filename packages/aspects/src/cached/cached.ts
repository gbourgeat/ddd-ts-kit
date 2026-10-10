import { cacheKey, type Cache, type CacheKey } from '@ddd-ts-kit/kernel';
import type { AdviceFactory } from '../aspect/advice-factory.js';
import type { AspectKind } from '../aspect/aspect-kind.js';
import type { Aspect } from '../aspect/aspect.js';
import { defineAspect } from '../aspect/define-aspect.js';
import type { JoinPoint } from '../aspect/join-point.js';
import { AspectNotAllowedError } from '../errors/aspect-not-allowed-error.js';
import { cacheOr } from '../runtime/cache-or.js';

export interface CachedOptions {
  /**
   * The cache key of a call, or `undefined` for a call that is not cached. The only place
   * arguments are read: build the key from identifiers, never from personal data.
   */
  readonly key: (method: string, args: readonly unknown[]) => string | undefined;
  readonly ttlMs: number;
  /** Defaults to the cache of the aspect runtime. */
  readonly cache?: Cache;
  /** Kinds to wrap although they are refused by default: `repository`, `use-case`. */
  readonly allowKinds?: readonly AspectKind[];
}

interface Cached {
  readonly value: unknown;
}

const REFUSED_KINDS: readonly AspectKind[] = ['repository', 'use-case'];

/**
 * Answers a read from the cache when it was made recently. For read methods of gateways and
 * external adapters: select them with `when(forMethods('find*'), cached(...))`. Refuses to
 * wrap a repository or a use case unless `allowKinds` says so: an aggregate served from a
 * cache hides that it is stale. Concurrent identical calls share one underlying call;
 * failures are not cached; a cache that fails is treated as a miss.
 */
export function cached(options: CachedOptions): Aspect {
  return defineAspect(cachedAdvice(options));
}

export function cachedAdvice(options: CachedOptions): AdviceFactory {
  return (joinPoint) => {
    assertAllowed(joinPoint, options);

    const inFlight = new Map<string, Promise<unknown>>();

    return async ({ args, proceed }) => {
      const id = options.key(joinPoint.method, args);

      if (id === undefined) {
        return proceed();
      }

      const entry: Entry = { cache: cacheOr(options.cache), key: keyOf(joinPoint, id), ttlMs: options.ttlMs };
      const hit = await read(entry);

      if (hit !== undefined) {
        return hit.value;
      }

      const pending = inFlight.get(id) ?? loading(entry, proceed).finally(() => inFlight.delete(id));

      inFlight.set(id, pending);

      return pending;
    };
  };
}

function assertAllowed(joinPoint: JoinPoint, options: CachedOptions): void {
  const { kind } = joinPoint;

  if (kind === undefined || !REFUSED_KINDS.includes(kind) || options.allowKinds?.includes(kind) === true) {
    return;
  }

  throw new AspectNotAllowedError(
    `cached refuses to wrap ${joinPoint.className}.${joinPoint.method}, bound as ${kind}: what it would serve may be stale. Select gateways and external adapters with when(forKinds(...)), or pass allowKinds: ['${kind}'] to take the decision.`,
  );
}

interface Entry {
  readonly cache: Cache;
  readonly key: CacheKey<Cached>;
  readonly ttlMs: number;
}

function keyOf(joinPoint: JoinPoint, id: string): CacheKey<Cached> {
  return cacheKey<Cached>('aspect', joinPoint.className, joinPoint.method, id);
}

async function read({ cache, key }: Entry): Promise<Cached | undefined> {
  try {
    return await cache.get(key);
  } catch {
    return undefined;
  }
}

async function loading({ cache, key, ttlMs }: Entry, proceed: () => Promise<unknown>): Promise<unknown> {
  const value = await proceed();

  try {
    await cache.set(key, { value }, { ttlMs });
  } catch {
    return value;
  }

  return value;
}

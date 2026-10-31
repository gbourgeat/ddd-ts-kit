import { cacheKey, tenantCacheKey, type Cache, type CacheKey } from '@ddd-ts-kit/kernel';
import type { AdviceFactory } from '../aspect/advice-factory';
import type { AspectKind } from '../aspect/aspect-kind';
import type { Aspect } from '../aspect/aspect';
import { defineAspect } from '../aspect/define-aspect';
import type { JoinPoint } from '../aspect/join-point';
import { AspectNotAllowedError } from '../errors/aspect-not-allowed-error';
import { cacheOr } from '../runtime/cache-or';
import { isElevatedWork } from '../runtime/is-elevated-work';
import { tenantScopeOfWork } from '../runtime/tenant-scope-of-work';

export interface CachedOptions {
  /**
   * The cache key of a call, or `undefined` for a call that is not cached. The only place
   * arguments are read: build the key from identifiers, never from personal data.
   */
  readonly key: (method: string, args: readonly unknown[]) => string | undefined;
  readonly ttlMs: number;
  /** Defaults to the cache of the aspect runtime. */
  readonly cache?: Cache;
  /**
   * One entry for every tenant, for a read whose answer does not depend on the tenant. By default
   * the entry is confined to the tenant of the work.
   */
  readonly shared?: boolean;
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
 * cache hides that it is stale. Work that names a tenant has its own entries, through the
 * execution scope of the aspect runtime, unless `shared` says otherwise; work that names none
 * keeps the key as written; work under an elevation (`acrossTenants`) neither reads nor writes the
 * cache, since its answer may reach beyond one tenant. Concurrent identical calls of one tenant share one underlying call;
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

      if (id === undefined || isElevatedWork()) {
        return proceed();
      }

      const key = keyOf(joinPoint, id, options);
      const entry: Entry = { cache: cacheOr(options.cache), key, ttlMs: options.ttlMs };
      const hit = await read(entry);

      if (hit !== undefined) {
        return hit.value;
      }

      const pending = inFlight.get(key.name) ?? loading(entry, proceed).finally(() => inFlight.delete(key.name));

      inFlight.set(key.name, pending);

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

function keyOf(joinPoint: JoinPoint, id: string, { shared }: CachedOptions): CacheKey<Cached> {
  const segments = ['aspect', joinPoint.className, joinPoint.method, id];
  const scope = shared === true ? undefined : tenantScopeOfWork();

  return scope === undefined ? cacheKey<Cached>(...segments) : tenantCacheKey<Cached>(scope, ...segments);
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

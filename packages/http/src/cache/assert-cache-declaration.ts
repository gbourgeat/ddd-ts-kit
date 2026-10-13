import type { DurationText } from '@ddd-ts-kit/kernel';
import { DeclarationError } from '@ddd-ts-kit/kernel/declarations';
import type { CacheDeclaration } from './cache-declaration.js';
import type { CachePolicy } from './cache-policy.js';
import { CacheScope } from './cache-scope.js';
import { cacheSeconds } from './cache-seconds.js';

const READS: readonly string[] = ['GET', 'HEAD'];

/**
 * Refuses a cache policy that would let a cache keep what it must not: a write, an answer with
 * no stated freshness, a directive of shared caches on a private answer, and above all the
 * answer of a route that knows its caller kept in a shared cache that does not know what the
 * answer varies on.
 */
export function assertCacheDeclaration(route: CacheDeclaration): void {
  const { cache } = route;

  if (cache === undefined) {
    return;
  }

  const refused = (reason: string): DeclarationError =>
    new DeclarationError(`Route "${route.operationId}" (${route.method} ${route.path}): ${reason}`);

  assertRead(route, cache, refused);
  assertDurations(cache, refused);
  assertScope(cache, refused);
  assertSharedVaries(route, cache, refused);
}

type Refusal = (reason: string) => DeclarationError;

function assertRead(route: CacheDeclaration, cache: CachePolicy, refused: Refusal): void {
  if (cache.scope !== CacheScope.noStore && !READS.includes(route.method)) {
    throw refused('only the answer of a read (GET, HEAD) is kept by a cache: declare scope no-store, or no policy.');
  }
}

function assertDurations(cache: CachePolicy, refused: Refusal): void {
  const written: readonly (DurationText | undefined)[] = [
    cache.maxAge,
    cache.sMaxAge,
    cache.staleWhileRevalidate,
    cache.staleIfError,
  ];

  for (const duration of written) {
    if (duration !== undefined && cacheSeconds(duration) === undefined) {
      throw refused(`"${duration}" is not a whole number of seconds: write '0s', '30s', '5m', '1h' or '1d'.`);
    }
  }
}

function assertScope(cache: CachePolicy, refused: Refusal): void {
  if (cache.scope === CacheScope.noStore) {
    const durations = [cache.maxAge, cache.sMaxAge, cache.staleWhileRevalidate, cache.staleIfError];

    if (durations.some((duration) => duration !== undefined)) {
      throw refused('a no-store answer is kept by nobody: it has no freshness to declare.');
    }

    return;
  }

  if (cache.maxAge === undefined) {
    throw refused(
      `a ${cache.scope} answer says how long it stays fresh: declare maxAge, '0s' to have it revalidated each time.`,
    );
  }

  if (cache.scope === CacheScope.private && cache.sMaxAge !== undefined) {
    throw refused('sMaxAge speaks to shared caches, which a private answer never reaches.');
  }
}

function assertSharedVaries(route: CacheDeclaration, cache: CachePolicy, refused: Refusal): void {
  if (cache.scope !== CacheScope.public || route.security === false || (cache.vary ?? []).length > 0) {
    return;
  }

  throw refused(
    'the route knows its caller, and a public answer is kept by shared caches that would hand it to the next caller. Declare scope private, or name in vary the request headers the answer depends on (Authorization, a tenant header).',
  );
}

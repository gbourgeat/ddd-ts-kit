import type { DurationText } from '@ddd-ts-kit/kernel';
import { cacheSeconds } from './cache-seconds';
import type { CachePolicy } from './cache-policy';
import { CacheScope } from './cache-scope';

/** The `Cache-Control` header a policy answers with, its directives in a fixed order. */
export function cacheControlOf(policy: CachePolicy): string {
  if (policy.scope === CacheScope.noStore) {
    return CacheScope.noStore;
  }

  const directives = [
    policy.scope,
    directive('max-age', policy.maxAge),
    directive('s-maxage', policy.sMaxAge),
    directive('stale-while-revalidate', policy.staleWhileRevalidate),
    directive('stale-if-error', policy.staleIfError),
    policy.mustRevalidate === true ? 'must-revalidate' : undefined,
  ];

  return directives.filter((written) => written !== undefined).join(', ');
}

function directive(name: string, duration: DurationText | undefined): string | undefined {
  const seconds = duration === undefined ? undefined : cacheSeconds(duration);

  return seconds === undefined ? undefined : `${name}=${seconds}`;
}

import { DeclarationError } from '@ddd-ts-kit/kernel/declarations';
import type { CachePolicy } from '../cache/cache-policy.js';
import { CacheScope } from '../cache/cache-scope.js';
import { CacheTagHeader } from '../cache/cache-tag-header.js';
import { varyOf } from '../cache/vary-of.js';
import { answersWithSchema } from '../route/answers-with-schema.js';
import type { Route } from '../route/route.js';
import type { ExecuteOptions } from './execute-options.js';

// The request headers that say who calls: an answer that varies on one is never handed to another caller.
const ACTOR_HEADERS: readonly string[] = ['authorization', 'cookie'];
// The caches that key their answers on Vary: Varnish (xkey) and Fastly. Cloudflare and Bunny do not.
const HONOURING_VARY: readonly CacheTagHeader[] = [CacheTagHeader.xkey, CacheTagHeader.surrogateKey];

type Shared = Route & { readonly cache: CachePolicy };

/**
 * Refuses, when the routes are mounted with the options of the application, a public answer the
 * caches in front could hand to the wrong caller: one of a route that knows its caller whose
 * `vary` names neither who calls (`Authorization`, `Cookie`) nor the header its tenant is read
 * from; one that varies, on a header or on `Accept` among the representations of the route,
 * behind a cache that ignores `Vary`; one filed per tenant on a route anybody may call, when
 * nothing names the tenant of an anonymous call.
 */
export function assertCachedRoutes(routes: readonly Route[], options: ExecuteOptions): void {
  for (const route of routes) {
    if (route.cache?.scope === CacheScope.public) {
      assertCachedRoute({ ...route, cache: route.cache }, options);
    }
  }
}

function assertCachedRoute(route: Shared, options: ExecuteOptions): void {
  const refused = (reason: string): DeclarationError =>
    new DeclarationError(`Route "${route.operationId}" (${route.method} ${route.path}): ${reason}`);

  const tenantHeaders = lowerCase(options.resolveTenant?.headers ?? []);
  const declared = lowerCase(route.cache.vary ?? []);
  const dimensions = [...ACTOR_HEADERS, ...tenantHeaders];

  if (route.security !== false && !declared.some((name) => dimensions.includes(name))) {
    throw refused(
      `the route knows its caller, and its public answer is kept by shared caches: name in vary one of ${dimensions.join(', ')}, what says who calls or the tenant, or declare scope private.`,
    );
  }

  if (!honoursVary(options) && (varyOf(declared, tenantHeaders).length > 0 || negotiated(route, options))) {
    throw refused(
      `the cache in front (${options.cacheTags?.header ?? ''}) ignores Vary, and would hand one variant to every caller: declare scope private, read the tenant from the host or the path, or set cacheTags.honoursVary once the cache keys on these headers.`,
    );
  }

  assertTenantNamed(route, options, refused);
}

/** Whether the answer is chosen by `Accept` among several media types, which makes it vary on that header. */
function negotiated(route: Route, { representations }: ExecuteOptions): boolean {
  return representations !== undefined && answersWithSchema(route) && representations.offeredBy(route).length > 1;
}

function lowerCase(names: readonly string[]): string[] {
  return names.map((name) => name.toLowerCase());
}

function honoursVary({ cacheTags }: ExecuteOptions): boolean {
  if (cacheTags === undefined) {
    return true;
  }

  return cacheTags.honoursVary ?? HONOURING_VARY.includes(cacheTags.header);
}

function assertTenantNamed(route: Shared, options: ExecuteOptions, refused: (reason: string) => Error): void {
  const tagged = (route.cache.tags ?? []).length > 0;

  if (options.cacheTags?.perTenant !== true || !tagged || route.security !== false) {
    return;
  }

  if (options.resolveTenant === undefined) {
    throw refused(
      'its tags are filed per tenant, and an anonymous call names no tenant: no purge would ever meet its answer. Name the tenant of a request with resolveTenant (tenantFromSubdomain, tenantFromPath, tenantFromHeader).',
    );
  }
}

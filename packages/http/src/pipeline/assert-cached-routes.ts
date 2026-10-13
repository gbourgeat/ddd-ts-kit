import { DeclarationError } from '@ddd-ts-kit/kernel/declarations';
import type { CachePolicy } from '../cache/cache-policy.js';
import { CacheScope } from '../cache/cache-scope.js';
import { CacheTagHeader } from '../cache/cache-tag-header.js';
import { varyOf } from '../cache/vary-of.js';
import { fieldAccess } from '../field-access/field-access.js';
import { answersWithSchema } from '../route/answers-with-schema.js';
import type { ResponseSpec } from '../route/response-spec.js';
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
 * from; one whose fields are shown to some callers only (`withFieldAccess`) whose `vary` names
 * neither `Authorization` nor `Cookie`, whoever may call the route; one that varies, on a header
 * or on `Accept` among the representations of the route, behind a cache that ignores `Vary`; one
 * filed per tenant on a route anybody may call, when nothing names the tenant of an anonymous call.
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

  const reason = callerRefusal(route, options) ?? fieldsRefusal(route) ?? varyRefusal(route, options);

  if (reason !== undefined) {
    throw refused(reason);
  }

  assertTenantNamed(route, options, refused);
}

/** On a route that knows its caller, why its answer could reach another caller, if it could. */
function callerRefusal(route: Shared, options: ExecuteOptions): string | undefined {
  const tenantHeaders = lowerCase(options.resolveTenant?.headers ?? []);
  const dimensions = [...ACTOR_HEADERS, ...tenantHeaders];

  if (route.security === false || namesOneOf(route, dimensions)) {
    return undefined;
  }

  return `the route knows its caller, and its public answer is kept by shared caches: name in vary one of ${dimensions.join(', ')}, what says who calls or the tenant, or declare scope private.`;
}

/** On an answer with fields some callers may not read, why it could reach another caller, if it could. */
function fieldsRefusal(route: Shared): string | undefined {
  if (!showsFieldsPerCaller(route) || namesOneOf(route, ACTOR_HEADERS)) {
    return undefined;
  }

  return `its answer shows some fields to some callers only, and a shared cache would hand the answer of the first caller to the next: name in vary one of ${ACTOR_HEADERS.join(', ')}, or declare scope private.`;
}

/** Behind a cache that ignores Vary, why a varying answer would reach every caller, if it would. */
function varyRefusal(route: Shared, options: ExecuteOptions): string | undefined {
  if (honoursVary(options) || !varies(route, options)) {
    return undefined;
  }

  return `the cache in front (${options.cacheTags?.header ?? ''}) ignores Vary, and would hand one variant to every caller: declare scope private, answer in one media type, read the tenant from the host or the path, or set cacheTags.honoursVary once the cache keys on these headers.`;
}

function namesOneOf(route: Shared, headers: readonly string[]): boolean {
  return lowerCase(route.cache.vary ?? []).some((name) => headers.includes(name));
}

/** Whether the answer varies: on the headers its policy or the tenant names, or on `Accept` among several media types. */
function varies(route: Shared, options: ExecuteOptions): boolean {
  const { representations, resolveTenant } = options;
  const named = varyOf(route.cache.vary ?? [], resolveTenant?.headers ?? []);

  const negotiated =
    representations !== undefined && answersWithSchema(route) && representations.offeredBy(route).length > 1;

  return named.length > 0 || negotiated;
}

/** Whether a schema the route answers with holds a field some callers may not see. */
function showsFieldsPerCaller(route: Shared): boolean {
  // A copy has a string index, which is how the statuses are enumerated.
  const declared: Readonly<Record<string, ResponseSpec>> = { ...route.responses };

  return Object.values(declared).some(({ body }) => fieldAccess.of(body).some(({ rule }) => rule.read !== undefined));
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

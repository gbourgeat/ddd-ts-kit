import { CliError } from '../../../cli-error';
import { toName } from '../../../naming';
import type { ControllerPlan } from './controller-plan';

const SCOPES = ['public', 'private', 'no-store'] as const;
const IDENTIFIER = /^(.+)Id$/;

/**
 * The cache policy `--cache` asks of a controller, as the text of its declaration: a public read
 * is kept by every cache and tagged with the resources of its path, a private one revalidated
 * each time with a strong `ETag`, `no-store` kept by nobody. Nothing without the flag.
 */
export function cachePolicyText(asked: string | undefined, plan: ControllerPlan): string | undefined {
  if (asked === undefined) {
    return undefined;
  }

  const scope = SCOPES.find((candidate) => candidate === asked);

  if (scope === undefined) {
    throw new CliError(`Unknown cache policy "${asked}".`, `Pass --cache with one of: ${SCOPES.join(', ')}.`);
  }

  if (scope === 'no-store') {
    return '{ scope: CacheScope.noStore }';
  }

  assertCacheable(scope, plan);

  return scope === 'private'
    ? "{ scope: CacheScope.private, maxAge: '0s', mustRevalidate: true, etag: 'representation' }"
    : publicPolicy(plan);
}

function assertCacheable(scope: string, { endpoint, group }: ControllerPlan): void {
  if (endpoint.method !== 'GET') {
    throw new CliError(
      `--cache ${scope} on a ${endpoint.method} route: only the answer of a read is kept by a cache.`,
      'Pass --cache no-store, or leave the flag out: a route that knows its caller answers no-store by default.',
    );
  }

  if (scope === 'public' && group !== undefined) {
    throw new CliError(
      `--cache public on a route behind the group ${group.name.pascal}Routes, which knows its caller: a shared cache would hand the answer of one caller to the next.`,
      'Pass --cache private (kept by the browser of the caller, revalidated with an ETag), or make the use case public.',
    );
  }
}

function publicPolicy({ endpoint }: ControllerPlan): string {
  const tags = endpoint.parameters.map((parameter) => {
    const resource = toName(IDENTIFIER.exec(parameter)?.[1] ?? parameter).kebab;

    return `{ resource: '${resource}', param: '${parameter}' }`;
  });

  return `{ scope: CacheScope.public, maxAge: '1m', sMaxAge: '5m', staleWhileRevalidate: '30s', etag: 'representation', tags: [${tags.join(', ')}] }`;
}

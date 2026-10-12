import type { Schema } from '@ddd-ts-kit/validation';
import { assertUniqueRoutes } from '../route/assert-unique-routes.js';
import type { RequestSchemas } from '../route/request-schemas.js';
import type { RouteInput } from '../route/route-input.js';
import type { RouteOutput } from '../route/route-output.js';
import type { Route } from '../route/route.js';
import type { ControllerClass } from './controller-class.js';
import type { ErasedController } from './erased-controller.js';
import type { ControllerRoutesOptions } from './controller-routes-options.js';
import type { GuardRequest } from './guard-request.js';
import type { Guard } from './guard.js';
import { resolvedController, type ResolvedController } from './resolved-controller.js';

const DEFAULT_SECURITY = ['bearer'];

/**
 * The routes of controllers, for any adapter and for the contract generator: each controller
 * becomes one `Route`, so validation, error mapping, tracing and problem documents are those
 * of every route. Controllers are given as classes with `resolve`, or as instances.
 */
export function controllerRoutes(
  controllers: readonly (ControllerClass | ErasedController)[],
  options: ControllerRoutesOptions = {},
): readonly Route[] {
  const routes = controllers.map((entry) => routeOf(resolvedController(entry, options.resolve), options));

  assertUniqueRoutes(routes);

  return routes;
}

function routeOf(resolved: ResolvedController, options: ControllerRoutesOptions): Route {
  const { controller, spec, declared } = resolved;
  const guards = options.guards === 'skip' ? [] : resolved.guards;
  const { status, body, description } = spec.response;
  const identity = { method: spec.method, path: declared.path, operationId: declared.operationId };

  return {
    ...identity,
    summary: spec.summary,
    ...(spec.description === undefined ? {} : { description: spec.description }),
    ...(declared.tags.length === 0 ? {} : { tags: declared.tags }),
    ...requestOf(spec),
    responses: { [status]: { description: description ?? defaultDescription(body), ...bodyOf(body) } },
    errors: [...new Set([...declared.errors, ...resolved.guards.flatMap((guard) => guard.documents?.errors ?? [])])],
    security: securityOf(resolved.guards, options.security ?? DEFAULT_SECURITY),
    ...(spec.deprecated === true ? { deprecated: true } : {}),
    async handle(input: RouteInput): Promise<RouteOutput> {
      for (const guard of guards) {
        await guard.check(guardRequest(identity, input));
      }

      const answer: unknown = await controller.handle({ ...input, actor: input.context.execution.actor });

      return body === undefined ? { status } : { status, body: answer };
    },
  };
}

function requestOf(parts: RequestSchemas): { request?: RequestSchemas } {
  const declared = Object.entries({
    params: parts.params,
    query: parts.query,
    headers: parts.headers,
    body: parts.body,
  }).filter(([, schema]) => schema !== undefined);

  return declared.length === 0 ? {} : { request: Object.fromEntries(declared) };
}

function bodyOf(body: Schema<unknown> | undefined): { body?: Schema<unknown> } {
  return body === undefined ? {} : { body };
}

function defaultDescription(body: Schema<unknown> | undefined): string {
  return body === undefined ? 'Done.' : 'The answer.';
}

function securityOf(guards: readonly Guard[], schemes: readonly string[]): readonly string[] | false {
  if (guards.some((guard) => guard.documents?.public === true)) {
    return false;
  }

  const named = guards.flatMap((guard) => guard.documents?.security ?? []);

  return [...new Set(named.length === 0 ? schemes : named)];
}

function guardRequest(
  identity: Pick<GuardRequest, 'method' | 'path' | 'operationId'>,
  input: RouteInput,
): GuardRequest {
  const { context } = input;
  const { actor, session } = context.execution;

  return {
    ...identity,
    params: typeof input.params === 'object' && input.params !== null ? { ...input.params } : {},
    headers: context.rawHeaders ?? {},
    actor,
    ...(session === undefined ? {} : { session }),
    context,
  };
}

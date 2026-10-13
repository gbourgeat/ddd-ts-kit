import type { Schema } from '@ddd-ts-kit/validation';
import { DomainError } from '@ddd-ts-kit/kernel';
import { assertCacheDeclaration } from '../cache/assert-cache-declaration.js';
import { assertUniqueRoutes } from '../route/assert-unique-routes.js';
import type { RequestSchemas } from '../route/request-schemas.js';
import type { RouteInput } from '../route/route-input.js';
import type { RouteOutput } from '../route/route-output.js';
import type { RouteSpec } from '../route/route-spec.js';
import type { Route } from '../route/route.js';
import type { ControllerClass } from './controller-class.js';
import type { ErasedController } from './erased-controller.js';
import type { ControllerRoutesOptions } from './controller-routes-options.js';
import type { ControllerSpec } from './controller-spec.js';
import type { GuardRequest } from './guard-request.js';
import { guardRefusals } from './guard-refusals.js';
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
  const { spec, declared } = resolved;
  const identity = { method: spec.method, path: declared.path, operationId: declared.operationId };
  const security = securityOf(resolved.guards, options.security ?? DEFAULT_SECURITY);
  const cache = declared.cache === undefined ? {} : { cache: declared.cache };
  const ifMatch = spec.ifMatch === undefined ? {} : { ifMatch: spec.ifMatch };

  assertCacheDeclaration({ ...identity, security, ...cache, ...ifMatch });

  return {
    ...identity,
    ...documentationOf(resolved),
    security,
    ...cache,
    ...ifMatch,
    handle: handlerOf(resolved, options, identity),
  };
}

type Documentation = Omit<RouteSpec, 'method' | 'path' | 'operationId' | 'security' | 'cache' | 'ifMatch'> &
  Pick<Route, 'groups'>;

function documentationOf({ spec, declared, guards }: ResolvedController): Documentation {
  const { status, body, description } = spec.response;

  return {
    summary: spec.summary,
    ...(spec.description === undefined ? {} : { description: spec.description }),
    ...(declared.tags.length === 0 ? {} : { tags: declared.tags }),
    ...(declared.groups.length === 0 ? {} : { groups: declared.groups }),
    ...requestOf(spec),
    ...(spec.upload === undefined ? {} : { upload: spec.upload }),
    responses: { [status]: { description: description ?? defaultDescription(body), ...bodyOf(body) } },
    errors: [...new Set([...declared.errors, ...guards.flatMap((guard) => guard.documents?.errors ?? [])])],
    ...(spec.deprecated === true ? { deprecated: true } : {}),
    ...presentationOf(spec),
  };
}

function handlerOf(
  resolved: ResolvedController,
  options: ControllerRoutesOptions,
  identity: Pick<GuardRequest, 'method' | 'path' | 'operationId'>,
): Route['handle'] {
  const { controller } = resolved;
  const guards = options.guards === 'skip' ? [] : resolved.guards;
  const { status, body } = resolved.spec.response;

  return async (input: RouteInput): Promise<RouteOutput> => {
    await passedGuards(guards, guardRequest(identity, input));

    const answer: unknown = await controller.handle({ ...input, actor: input.context.execution.actor });

    return body === undefined ? { status } : { status, body: answer };
  };
}

/**
 * Every guard, in order. A refusal one throws (a `DomainError`: `UnauthorizedError`,
 * `ForbiddenError` or one of the project) is marked as a refusal at the edge before it goes on to
 * the pipeline; a fault (a lookup that failed) is not, and is never audited as a decision.
 */
async function passedGuards(guards: readonly Guard[], request: GuardRequest): Promise<void> {
  try {
    for (const guard of guards) {
      await guard.check(request);
    }
  } catch (error) {
    if (error instanceof DomainError) {
      guardRefusals.mark(error);
    }

    throw error;
  }
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

function presentationOf({ produces, consumes, form }: ControllerSpec): Pick<Route, 'produces' | 'consumes' | 'form'> {
  return {
    ...(produces === undefined ? {} : { produces: [...produces] }),
    ...(consumes === undefined ? {} : { consumes: [...consumes] }),
    ...(form === undefined ? {} : { form }),
  };
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

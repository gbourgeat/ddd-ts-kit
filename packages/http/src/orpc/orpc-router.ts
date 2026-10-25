import { type ErrorMap, type Meta, os, type Procedure, type Schema } from '@orpc/server';
import { createErrorMapper } from '../error/create-error-mapper';
import type { ErrorMapper } from '../error/error-mapper';
import { refusalCodesByStatus } from '../error/refusal-codes-by-status';
import type { ExecuteOptions } from '../pipeline/execute-options';
import { executeRoute } from '../pipeline/execute-route';
import { assertUniqueRoutes } from '../route/assert-unique-routes';
import type { Route } from '../route/route';
import type { OrpcContext } from './orpc-context';
import { rpcAnswer } from './rpc-answer';
import { rpcRequest } from './rpc-request';

/** One procedure of `orpcRouter`: its input and output are checked by the schemas of its route, not by oRPC. */
export type OrpcProcedure = Procedure<
  OrpcContext,
  OrpcContext,
  Schema<unknown, unknown>,
  Schema<unknown, unknown>,
  ErrorMap,
  Meta
>;

/** The procedures of `orpcRouter`, by the `operationId` of their route. */
export type OrpcRouter = Readonly<Record<string, OrpcProcedure>>;

/**
 * The routes as oRPC procedures, one per `operationId`, for `RPCHandler` of `@orpc/server`: a
 * typed client of the same contract calls the use cases without paths or methods. Each call runs
 * through `executeRoute` with the same options as the HTTP adapter (guards, principal, tenant,
 * validation, permissions, error hook, tracing), and a refusal is an `ORPCError` with the code of
 * its problem, declared by the procedure when the contract documents it, so that the client
 * narrows it.
 *
 * What only HTTP carries stays with the routes: a route that receives a file or a raw body is not
 * a procedure; an answer is JSON whatever the representations; its headers are not returned, so no
 * cache keeps it and an `ETag` is not read through it; a file or a streamed list is refused 406.
 */
export function orpcRouter(routes: readonly Route[], options: ExecuteOptions = {}): OrpcRouter {
  assertUniqueRoutes(routes);

  const mapper = options.errorMapper ?? createErrorMapper();
  const served = routes.filter((route) => route.upload === undefined && route.rawBody !== true);
  const execute = withoutRepresentations(options);

  return Object.fromEntries(served.map((route) => [route.operationId, procedureOf(route, execute, mapper)]));
}

/** oRPC writes the answer: no representation is negotiated, and a list read as it comes stays the body, closed when refused. */
function withoutRepresentations({ representations, ...options }: ExecuteOptions): ExecuteOptions {
  return options;
}

function procedureOf(route: Route, options: ExecuteOptions, mapper: ErrorMapper): OrpcProcedure {
  return os
    .$context<OrpcContext>()
    .errors(declaredErrors(route, mapper))
    .handler(async ({ input, context }) => rpcAnswer(await executeRoute(route, rpcRequest(input, context), options)));
}

/** The codes the contract documents for the route, with their status: the refusals the client may narrow to. */
function declaredErrors(route: Route, mapper: ErrorMapper): ErrorMap {
  const entries = [...refusalCodesByStatus(route, mapper, undefined)].flatMap(([status, codes]) =>
    codes.map((code) => [code, { status }] as const),
  );

  return Object.fromEntries(entries);
}

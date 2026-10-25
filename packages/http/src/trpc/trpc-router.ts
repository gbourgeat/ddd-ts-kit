import {
  initTRPC,
  type TRPCBuiltRouter,
  type TRPCDefaultErrorShape,
  type TRPCError,
  type TRPCMutationProcedure,
  type TRPCQueryProcedure,
} from '@trpc/server';
import { createErrorMapper } from '../error/create-error-mapper';
import type { ErrorMapper } from '../error/error-mapper';
import type { ExecuteOptions } from '../pipeline/execute-options';
import { executeRoute } from '../pipeline/execute-route';
import { assertUniqueRoutes } from '../route/assert-unique-routes';
import type { Route } from '../route/route';
import { rpcAnswer } from '../rpc/rpc-answer';
import type { RpcContext } from '../rpc/rpc-context';
import { rpcRequest } from '../rpc/rpc-request';
import type { TrpcErrorShape } from './trpc-error-shape';
import { RouteRefusal } from './route-refusal';
import { TRPC_PROTOCOL } from './trpc-protocol';

/** One procedure of `trpcRouter`: its input and output are checked by the schemas of its route, not by tRPC. */
export type TrpcProcedure =
  | TRPCQueryProcedure<{ input: unknown; output: unknown; meta: object }>
  | TRPCMutationProcedure<{ input: unknown; output: unknown; meta: object }>;

/** The root of `trpcRouter`: the context the server hands over, and the error a client reads. */
export interface TrpcRootTypes {
  ctx: RpcContext;
  meta: object;
  errorShape: TrpcErrorShape;
  transformer: false;
}

/** The procedures of `trpcRouter`, by the `operationId` of their route. */
export type TrpcRouter = TRPCBuiltRouter<TrpcRootTypes, Record<string, TrpcProcedure>>;

const trpc = initTRPC.context<RpcContext>().create({ errorFormatter: formatError });

/**
 * The routes as tRPC procedures, one per `operationId`, a query for a `GET` and a mutation for the
 * other methods, for the adapters of `@trpc/server`: a typed client calls the use cases without
 * paths or methods. Each call runs through `executeRoute` with the same options as the HTTP adapter
 * (guards, principal, tenant, validation, permissions, error hook, tracing), and a refusal is a
 * `TRPCError` whose `data.problem` is the problem document of the route, its `code` the one of the kit.
 *
 * What only HTTP carries stays with the routes: a route that receives a file or a raw body is not
 * a procedure; an answer is JSON whatever the representations; its headers are not returned, so no
 * cache keeps it and an `ETag` is not read through it; a file, a binary body or a streamed list is
 * refused 406.
 */
export function trpcRouter(routes: readonly Route[], options: ExecuteOptions = {}): TrpcRouter {
  assertUniqueRoutes(routes);

  const mapper = options.errorMapper ?? createErrorMapper();
  const served = routes.filter((route) => route.upload === undefined && route.rawBody !== true);
  const execute = withoutRepresentations(options);

  return trpc.router(
    Object.fromEntries(served.map((route) => [route.operationId, procedureOf(route, execute, mapper)])),
  );
}

/** tRPC writes the answer: no representation is negotiated, and a list read as it comes stays the body, closed when refused. */
function withoutRepresentations({ representations, ...options }: ExecuteOptions): ExecuteOptions {
  return options;
}

function procedureOf(route: Route, options: ExecuteOptions, mapper: ErrorMapper): TrpcProcedure {
  const procedure = trpc.procedure.input((input: unknown) => input);

  const resolve = async ({ input, ctx }: { input: unknown; ctx: RpcContext }): Promise<unknown> =>
    rpcAnswer(await executeRoute(route, rpcRequest(input, ctx), options), TRPC_PROTOCOL, mapper);

  return route.method === 'GET' ? procedure.query(resolve) : procedure.mutation(resolve);
}

/** The data of the error, without the stack tRPC adds in development: the problem document is what the client reads. */
function formatError({ shape, error }: { shape: TRPCDefaultErrorShape; error: TRPCError }): TrpcErrorShape {
  const { stack, ...data } = shape.data;
  const problem = error.cause instanceof RouteRefusal ? (error.cause.problem ?? null) : null;

  return { ...shape, data: { ...data, problem } };
}

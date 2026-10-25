import { createTRPCClient, httpLink, TRPCClientError, type TRPCLink } from '@trpc/client';
import type { TRPCBuiltRouter, TRPCMutationProcedure, TRPCQueryProcedure } from '@trpc/server';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import type { Route } from '../../src';
import type { ExecuteOptions } from '../../src/pipeline/execute-options';
import { type TrpcContext, type TrpcErrorShape, type TrpcRouter, trpcRouter } from '../../src/trpc';

interface Order {
  readonly id: string;
  readonly customerId: string;
  readonly lines: number;
}

interface Procedure<TInput, TOutput> {
  input: TInput;
  output: TOutput;
  meta: object;
}

/** What `ddd-ts-kit sdk` writes for the order routes when `stack.rpc` is `trpc`: the type of the router, and nothing else. */
export type OrderRouter = TRPCBuiltRouter<
  { ctx: TrpcContext; meta: object; errorShape: TrpcErrorShape; transformer: false },
  {
    placeOrder: TRPCMutationProcedure<
      Procedure<{ body: { customerId: string; items: { sku: string; quantity: number }[] } }, Order>
    >;
    getOrder: TRPCQueryProcedure<Procedure<{ path: { orderId: string }; query?: { expand?: 'lines' } }, Order>>;
    cancelOrder: TRPCMutationProcedure<Procedure<{ path: { orderId: string } }, undefined>>;
    whoAmI: TRPCQueryProcedure<Procedure<undefined, { principal: unknown }>>;
  }
>;

/** A router of procedures the type above does not list. */
export type AnyRouter = TRPCBuiltRouter<
  { ctx: TrpcContext; meta: object; errorShape: TrpcErrorShape; transformer: false },
  Record<string, TRPCQueryProcedure<Procedure<Readonly<Record<string, unknown>> | undefined, unknown>>>
>;

export const ENDPOINT = '/trpc';

export function clientOf(
  routes: readonly Route[],
  options: ExecuteOptions = {},
  headers: Record<string, string> = {},
): ReturnType<typeof createTRPCClient<OrderRouter>> {
  return createTRPCClient<OrderRouter>({ links: [linkOf(trpcRouter(routes, options), headers)] });
}

/** A client of procedures the type above does not list: what a test of one route calls. */
export function untypedClientOf(
  routes: readonly Route[],
  options: ExecuteOptions = {},
): ReturnType<typeof createTRPCClient<AnyRouter>> {
  return createTRPCClient<AnyRouter>({ links: [linkOf(trpcRouter(routes, options), {})] });
}

/** A link that hands each request to the fetch adapter of tRPC, without a server. */
function linkOf(router: TrpcRouter, headers: Record<string, string>): TRPCLink<OrderRouter> {
  return httpLink<OrderRouter>({
    url: `http://api.test${ENDPOINT}`,
    headers,
    fetch: async (url, init) =>
      fetchRequestHandler({
        endpoint: ENDPOINT,
        req: new Request(url, { ...init, signal: init?.signal ?? null }),
        router,
        createContext: ({ req }) => ({ headers: Object.fromEntries(req.headers) }),
      }),
  });
}

/** The error a call was refused with, as a client of the router type reads it. */
export async function refusalOf(call: Promise<unknown>): Promise<TRPCClientError<OrderRouter>> {
  const error: unknown = await call.then(
    () => undefined,
    (thrown: unknown) => thrown,
  );

  if (!(error instanceof TRPCClientError)) {
    throw new Error(`The call was not refused by tRPC: ${String(error)}`);
  }

  return error as TRPCClientError<OrderRouter>;
}

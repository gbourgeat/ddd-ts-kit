{{header}}
import { createTRPCClient, type HTTPLinkOptions, httpLink, type TRPCClient, TRPCClientError } from '@trpc/client';
import type {
  TRPC_ERROR_CODE_KEY,
  TRPC_ERROR_CODE_NUMBER,
  TRPCBuiltRouter,
  TRPCMutationProcedure,
  TRPCQueryProcedure,
} from '@trpc/server';
import type * as Operations from './operations.js';
import type { DataOf } from './runtime.js';
{{#if schemas}}
import type * as Schemas from './schemas.js';
{{/if}}

/** The problem document a refusal carries in `data.problem`. */
type Problem = {{problem}};

/** What `error.data` holds for a refusal: the code tRPC has for its status, and the problem document of the route. */
export interface RpcErrorData {
  readonly code: TRPC_ERROR_CODE_KEY;
  readonly httpStatus: number;
  readonly path?: string;
  /** Its `code` is the one of the contract. `null` for an error of tRPC itself, such as an unknown procedure. */
  readonly problem: Problem | null;
}

interface Procedure<TInput, TOutput> {
  input: TInput;
  output: TOutput;
  meta: object;
}

/** What the router says of every procedure: the error a client reads, and no transformer. */
interface Root {
  ctx: object;
  meta: object;
  errorShape: { code: TRPC_ERROR_CODE_NUMBER; message: string; data: RpcErrorData };
  transformer: false;
}

/**
 * The router of {{api}}, as a type only: what `trpcRouter` of `@ddd-ts-kit/http/trpc` serves, a
 * query for a `GET` operation and a mutation for the others.
 */
export type AppRouter = TRPCBuiltRouter<
  Root,
  {
{{procedures}}
  }
>;

export type RpcClient = TRPCClient<AppRouter>;

export type RpcHeaders = Readonly<Record<string, string>>;

export interface RpcClientOptions {
  /** Where the procedures are served: the base URL of the API followed by /trpc. */
  readonly url: string;
  /** Sent with every call, the credentials among them; a function is asked before each call. */
  readonly headers?: RpcHeaders | (() => RpcHeaders | Promise<RpcHeaders>);
  /** Replaces the global `fetch`. */
  readonly fetch?: typeof fetch;
}

/** The client of the procedures: one per operation, `.query(input)` or `.mutate(input)`, its input and its body typed by the contract. */
export function createRpcClient(options: RpcClientOptions): RpcClient {
  const { url, headers = {}, fetch: send } = options;
  const link = httpLink<AppRouter>({
    url,
    headers: typeof headers === 'function' ? () => headers() : headers,
    ...(send === undefined ? {} : { fetch: fetchOf(send) }),
  });

  return createTRPCClient<AppRouter>({ links: [link] });
}

/** A `fetch` as tRPC calls it: the signal it leaves out is no signal. */
function fetchOf(send: typeof fetch): NonNullable<HTTPLinkOptions<Root>['fetch']> {
  return (input, init) => send(input, init === undefined ? undefined : { ...init, signal: init.signal ?? null });
}

/** Whether a call was refused by the API: then `error.data?.problem?.code` is the code of the contract. */
export function isRpcRefusal(error: unknown): error is TRPCClientError<AppRouter> {
  return error instanceof TRPCClientError;
}

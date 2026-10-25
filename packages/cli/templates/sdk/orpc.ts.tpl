{{header}}
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import { type ContractRouterClient, oc, type } from '@orpc/contract';
import type * as Operations from './operations.js';
import type { DataOf } from './runtime.js';
{{#if schemas}}
import type * as Schemas from './schemas.js';
{{/if}}

/** The problem document a refusal carries as its data. */
type Problem = {{problem}};

/**
 * The procedures of {{api}}: what `orpcRouter` of `@ddd-ts-kit/http/orpc` serves. A refusal the
 * contract declares is a defined error: `isDefinedError(error)` narrows `error.code` to the codes
 * of the procedure.
 */
export const contract = {
{{procedures}}
};

export type RpcClient = ContractRouterClient<typeof contract>;

export type RpcHeaders = Readonly<Record<string, string>>;

export interface RpcClientOptions {
  /** Where the procedures are served: the base URL of the API followed by /rpc. */
  readonly url: string;
  /** Sent with every call, the credentials among them; a function is asked before each call. */
  readonly headers?: RpcHeaders | (() => RpcHeaders | Promise<RpcHeaders>);
  /** Replaces the global `fetch`. */
  readonly fetch?: typeof fetch;
}

/** The client of the procedures: one method per operation, its input and its body typed by the contract. */
export function createRpcClient(options: RpcClientOptions): RpcClient {
  const { url, headers = {}, fetch: send } = options;
  const link = new RPCLink({
    url,
    headers: typeof headers === 'function' ? () => headers() : headers,
    ...(send === undefined ? {} : { fetch: send }),
  });

  return createORPCClient(link);
}

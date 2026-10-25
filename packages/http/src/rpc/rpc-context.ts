import type { RawHeaders } from '../route/raw-headers';

/**
 * What the server hands to every procedure with the call, as the context of its RPC handler: the
 * headers of the RPC request, which carry the credentials, the request and correlation ids and the
 * tenant, as they do on a route.
 */
export interface RpcContext {
  readonly headers: RawHeaders;
  /**
   * What `resolvePrincipal` reads. Left out, `{ headers }`: what `principalResolver` of
   * `@ddd-ts-kit/auth` reads the bearer credential from.
   */
  readonly raw?: unknown;
}

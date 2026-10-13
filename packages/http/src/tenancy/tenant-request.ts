import type { Actor } from '@ddd-ts-kit/kernel';
import type { RawHeaders } from '../route/raw-headers.js';

/** What a resolver reads to name the tenant of a request: who calls, and how the request was addressed. */
export interface TenantRequest {
  readonly headers: Readonly<RawHeaders>;
  /** The path parameters, through the schema of the route when it declares one. */
  readonly params: Readonly<Record<string, unknown>>;
  readonly actor: Actor;
}

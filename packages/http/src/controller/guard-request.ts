import type { Actor, Session } from '@ddd-ts-kit/kernel';
import type { HttpMethod } from '../route/http-method.js';
import type { RawHeaders } from '../route/raw-headers.js';
import type { RequestContext } from '../route/request-context.js';

/** What a guard reads to let a request through or refuse it: who calls, and which route. */
export interface GuardRequest {
  readonly method: HttpMethod;
  /** The template of the route, the prefixes of its groups included: `/practices/:practiceId/agenda`. */
  readonly path: string;
  readonly operationId: string;
  /** The path parameters, through the schema of the controller when it declares one. */
  readonly params: Readonly<Record<string, unknown>>;
  /** The headers as they arrived, before any schema. */
  readonly headers: RawHeaders;
  readonly actor: Actor;
  /** Absent when the application resolves no session. */
  readonly session?: Session;
  readonly context: RequestContext;
}

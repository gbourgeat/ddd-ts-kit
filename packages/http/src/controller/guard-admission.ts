import type { Actor, Session } from '@ddd-ts-kit/kernel';
import type { HttpMethod } from '../route/http-method';
import type { RawHeaders } from '../route/raw-headers';

/** What a guard reads to decide on the caller alone, before the request is read: who calls, and which route. */
export interface GuardAdmission {
  readonly method: HttpMethod;
  /** The template of the route, the prefixes of its groups included: `/practices/:practiceId/agenda`. */
  readonly path: string;
  readonly operationId: string;
  /** The headers as they arrived, before any schema. */
  readonly headers: RawHeaders;
  readonly actor: Actor;
  /** Absent when the application resolves no session. */
  readonly session?: Session;
}

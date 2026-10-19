import type { Actor, Session } from '@ddd-ts-kit/kernel';
import type { RawHeaders } from './raw-headers.js';

/** What is known of a request before it is read: its headers and its caller, the tenant it names not yet resolved. */
export interface RouteAdmission {
  readonly headers: RawHeaders;
  readonly actor: Actor;
  /** Absent when the application resolves no session. */
  readonly session?: Session;
}

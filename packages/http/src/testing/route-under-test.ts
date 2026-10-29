import type { Actor } from '@ddd-ts-kit/kernel';
import type { RouteResponse } from '../pipeline/route-response';
import type { Route } from '../route/route';
import type { SentRequest } from './sent-request';

/** A route a spec sends requests to, as the adapter of a framework would, without a server. */
export interface RouteUnderTest {
  readonly route: Route;
  /** Who sends every request: what a protected use case receives as its actor. */
  readonly caller: Actor;
  /** Sends one request through the whole pipeline: authentication, guards, validation, handler, answer. */
  readonly send: (request?: SentRequest) => Promise<RouteResponse>;
}

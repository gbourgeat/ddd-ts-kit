import type { Name } from '../../../naming';
import type { Scope } from '../../scope';
import type { Endpoint } from './endpoint';
import { messagePlan, NOTHING_READ, type MessagePlan } from './message-plan';
import type { UseCase } from './use-case';

/** What a route is about: its name, its endpoint and the use case it calls. */
export interface Routed {
  readonly name: Name;
  readonly endpoint: Endpoint;
  readonly useCase: UseCase;
}

/** How the route builds its message from the request, unless a request mapper builds it. */
export function planOf(scope: Scope, { endpoint, useCase }: Routed, withMapper: boolean): MessagePlan {
  return withMapper ? NOTHING_READ : messagePlan(scope.config.stack.validation, endpoint, useCase);
}

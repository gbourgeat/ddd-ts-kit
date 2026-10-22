import type { InjectionToken } from '@nestjs/common';
import type { Route } from '../route/route';

/** Routes whose handlers close over injected dependencies. */
export interface RoutesFactory {
  readonly inject: readonly InjectionToken[];

  // A method, so that a factory naming the types it expects (`(orders: OrderService) => ...`)
  // is accepted: the tokens are only resolved at runtime.
  useFactory(...dependencies: unknown[]): readonly Route[];
}

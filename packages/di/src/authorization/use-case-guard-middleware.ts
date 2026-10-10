import type { BusMiddleware } from '@ddd-ts-kit/kernel';
import type { Resolve } from '../wiring/resolve.js';
import { UseCaseGuard } from './use-case-guard.js';

/** Resolved at each message, so the guard may be bound, rebound or faked after the bus exists. */
export function useCaseGuardMiddleware(resolve: Resolve): BusMiddleware {
  return (message, next, info) => resolve(UseCaseGuard).check(message, next, info);
}

import type { BusMiddleware } from '@ddd-ts-kit/kernel';
import type { Resolve } from '../wiring/resolve.js';
import { UseCaseGuard } from './use-case-guard.js';

/** The part of the guard that wraps the handler alone, installed around the handler of a bus. Resolved at each message, as the guard. */
export function useCaseGuardWithinMiddleware(resolve: Resolve): BusMiddleware {
  return (message, next, info) => {
    const guard = resolve(UseCaseGuard);

    return guard.within === undefined ? next() : guard.within(message, next, info);
  };
}

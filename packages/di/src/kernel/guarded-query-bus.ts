import { InMemoryQueryBus, type BusMiddleware } from '@ddd-ts-kit/kernel';
import { useCaseGuardMiddleware } from '../authorization/use-case-guard-middleware';
import { useCaseGuardWithinMiddleware } from '../authorization/use-case-guard-within-middleware';
import type { Resolve } from '../wiring/resolve';
import { reportedFailures } from './reported-failures';

/** What observes the use cases comes after the guard: a refused query never started. What the guard checks once the handler returned runs around the handler itself. */
export function guardedQueryBus(resolve: Resolve, observed?: BusMiddleware): InMemoryQueryBus {
  const bus = new InMemoryQueryBus().use(reportedFailures(resolve)).use(useCaseGuardMiddleware(resolve));

  return (observed === undefined ? bus : bus.use(observed)).aroundHandler(useCaseGuardWithinMiddleware(resolve));
}

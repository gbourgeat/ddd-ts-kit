import { InMemoryQueryBus, type BusMiddleware } from '@ddd-ts-kit/kernel';
import { useCaseGuardMiddleware } from '../authorization/use-case-guard-middleware.js';
import type { Resolve } from '../wiring/resolve.js';
import { reportedFailures } from './reported-failures.js';

/** What observes the use cases comes after the guard: a refused query never started. */
export function guardedQueryBus(resolve: Resolve, observed?: BusMiddleware): InMemoryQueryBus {
  const bus = new InMemoryQueryBus().use(reportedFailures(resolve)).use(useCaseGuardMiddleware(resolve));

  return observed === undefined ? bus : bus.use(observed);
}

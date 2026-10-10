import { InMemoryCommandBus, UnitOfWork, unitOfWorkMiddleware, type BusMiddleware } from '@ddd-ts-kit/kernel';
import { useCaseGuardMiddleware } from '../authorization/use-case-guard-middleware.js';
import type { Resolve } from '../wiring/resolve.js';
import { reportedFailures } from './reported-failures.js';

/**
 * The unit of work is resolved at each command, not when the bus is built: the application
 * resolves the bus at creation to attach the handlers, and that must not open a database. The
 * error reporting comes first, outside of it, so a commit that fails is reported too. What
 * observes the use cases comes after the guard: a refused command never started.
 */
export function transactionalCommandBus(resolve: Resolve, observed?: BusMiddleware): InMemoryCommandBus {
  const bus = new InMemoryCommandBus().use(reportedFailures(resolve)).use(useCaseGuardMiddleware(resolve));

  if (observed !== undefined) {
    bus.use(observed);
  }

  return bus.use(unitOfWorkMiddleware({ run: (work) => resolve(UnitOfWork).run(work) }));
}

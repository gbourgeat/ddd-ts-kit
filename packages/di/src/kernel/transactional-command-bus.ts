import { InMemoryCommandBus, UnitOfWork, unitOfWorkMiddleware } from '@ddd-ts-kit/kernel';
import { useCaseGuardMiddleware } from '../authorization/use-case-guard-middleware.js';
import type { Resolve } from '../wiring/resolve.js';

/**
 * The unit of work is resolved at each command, not when the bus is built: the application
 * resolves the bus at creation to attach the handlers, and that must not open a database.
 */
export function transactionalCommandBus(resolve: Resolve): InMemoryCommandBus {
  return new InMemoryCommandBus()
    .use(useCaseGuardMiddleware(resolve))
    .use(unitOfWorkMiddleware({ run: (work) => resolve(UnitOfWork).run(work) }));
}

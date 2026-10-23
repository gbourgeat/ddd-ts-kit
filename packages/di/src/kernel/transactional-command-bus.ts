import {
  FileKeys,
  FileStaging,
  InMemoryCommandBus,
  UnitOfWork,
  fileUploadsMiddleware,
  unitOfWorkMiddleware,
  type BusMiddleware,
} from '@ddd-ts-kit/kernel';
import { useCaseGuardMiddleware } from '../authorization/use-case-guard-middleware';
import { useCaseGuardWithinMiddleware } from '../authorization/use-case-guard-within-middleware';
import type { Resolve } from '../wiring/resolve';
import { reportedFailures } from './reported-failures';

/**
 * The unit of work is resolved at each command, not when the bus is built: the application
 * resolves the bus at creation to attach the handlers, and that must not open a database. The
 * error reporting comes first, outside of it, so a commit that fails is reported too. What
 * observes the use cases comes after the guard: a refused command never started. The file a
 * command carries is staged last before the unit of work, out of any transaction; the staging is
 * resolved only for such a command. What the guard checks once the handler returned runs around
 * the handler itself, inside the unit of work, so that a failure there rolls the change back.
 */
export function transactionalCommandBus(resolve: Resolve, observed?: BusMiddleware): InMemoryCommandBus {
  const bus = new InMemoryCommandBus().use(reportedFailures(resolve)).use(useCaseGuardMiddleware(resolve));

  if (observed !== undefined) {
    bus.use(observed);
  }

  return bus
    .use(fileUploadsMiddleware(() => ({ keys: resolve(FileKeys), staging: resolve(FileStaging) })))
    .use(unitOfWorkMiddleware({ run: (work) => resolve(UnitOfWork).run(work) }))
    .aroundHandler(useCaseGuardWithinMiddleware(resolve));
}

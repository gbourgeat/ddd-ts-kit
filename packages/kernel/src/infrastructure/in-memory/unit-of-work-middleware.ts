import type { BusMiddleware } from '../../application/messaging/bus-middleware.js';
import { withinUnitOfWork } from '../domain-events/within-unit-of-work.js';

/**
 * Runs every command inside one unit of work. Queries are left alone: they do not write. The
 * domain events its saves recorded are dispatched once the handler has returned, before the
 * commit, whatever the unit of work given: one that does not call `withinUnitOfWork` itself is
 * covered here. A command sent from inside a unit of work joins it.
 */
export function unitOfWorkMiddleware(unitOfWork: {
  run<T>(work: () => Promise<T>): Promise<T>;
}): BusMiddleware {
  return (_message, next, info) =>
    info.kind === 'command' ? withinUnitOfWork(next, (scoped) => unitOfWork.run(scoped)) : next();
}

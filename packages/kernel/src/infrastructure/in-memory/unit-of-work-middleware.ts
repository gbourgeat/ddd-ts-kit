import type { BusMiddleware } from '../../application/messaging/bus-middleware.js';

/** Runs every command inside one unit of work. Queries are left alone: they do not write. */
export function unitOfWorkMiddleware(unitOfWork: {
  run<T>(work: () => Promise<T>): Promise<T>;
}): BusMiddleware {
  return (_message, next, info) => (info.kind === 'command' ? unitOfWork.run(next) : next());
}

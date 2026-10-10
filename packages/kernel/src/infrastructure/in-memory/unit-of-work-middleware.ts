import type { BusMiddleware } from '../../application/messaging/bus-middleware.js';
import { apartFromDomainEventFlow } from '../domain-events/apart-from-domain-event-flow.js';

/**
 * Runs every command inside one unit of work. Queries are left alone: they do not write. The
 * domain events its saves announce are dispatched inside it, also for a command sent by the
 * handler of another event.
 */
export function unitOfWorkMiddleware(unitOfWork: {
  run<T>(work: () => Promise<T>): Promise<T>;
}): BusMiddleware {
  return (_message, next, info) =>
    info.kind === 'command' ? unitOfWork.run(() => apartFromDomainEventFlow(next)) : next();
}

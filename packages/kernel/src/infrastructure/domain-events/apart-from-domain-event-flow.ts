import { domainEventFlow } from './domain-event-flow.js';

/**
 * Runs a unit of work of its own: the events its saves announce are dispatched before those
 * saves resolve, inside it, even when it was started by the handler of another event.
 */
export function apartFromDomainEventFlow<T>(work: () => T): T {
  return domainEventFlow.run(undefined, work);
}

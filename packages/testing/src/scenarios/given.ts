import { resolve } from '../builders/resolve';
import type { Resolvable } from '../builders/resolvable';
import type { EventSource } from './event-source';
import { scenario, type Scenario } from './scenario';

/**
 * Starts a scenario from an aggregate (or its builder) in its "given" state. The events
 * recorded while arranging are discarded, so only the events of `when` are asserted.
 */
export function given<A extends EventSource>(aggregate: A | Resolvable<A>): Scenario<A> {
  return scenario(() => resolve(aggregate));
}

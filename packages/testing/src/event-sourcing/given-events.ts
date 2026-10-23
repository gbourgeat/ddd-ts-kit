import type { AggregateHistory, DomainEvent } from '@ddd-ts-kit/kernel';
import type { EventSource } from '../scenarios/event-source';
import { scenario, type Scenario } from '../scenarios/scenario';

/**
 * Starts a scenario of an event-sourced aggregate from its history, without a database: the
 * aggregate is rebuilt by replaying `events` through `rehydrate`, then `when` runs one command and
 * `thenEvents` asserts what it recorded.
 * `givenEvents((id, history) => Invoice.rehydrate(id, history), [issued]).when((invoice) => invoice.pay(now)).thenEvents([InvoicePaid])`.
 * The id is the one the events carry; give it for an empty history.
 */
export function givenEvents<A extends EventSource, E extends DomainEvent>(
  rehydrate: (id: string, history: AggregateHistory<E>) => A,
  events: readonly E[],
  id?: string,
): Scenario<A> {
  const identity = id ?? events[0]?.aggregateId;

  if (identity === undefined) {
    throw new TypeError('givenEvents needs the id of the aggregate when the history is empty');
  }

  return scenario(() => rehydrate(identity, { events }));
}

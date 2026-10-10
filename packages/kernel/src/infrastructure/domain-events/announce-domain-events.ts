import { AsyncLocalStorage } from 'node:async_hooks';
import type { DomainEventDispatcher } from '../../application/ports/domain-event-dispatcher.js';
import type { DomainEvent } from '../../domain/domain-event.js';
import { domainEventFlow, type AnnouncedEvent, type DomainEventFlow } from './domain-event-flow.js';

/**
 * Dispatches the events one by one, in the order given. Events announced meanwhile, by a
 * handler that saves an aggregate, wait behind the ones already announced instead of being
 * dispatched inside that handler: the whole chain goes out in recording order, without
 * recursion, and the promise resolves once nothing is left. The first handler that fails
 * rejects it, and what was still waiting is dropped with it.
 *
 * Each event is dispatched in the asynchronous context of the save that announced it, so what
 * follows the call chain (a trace, an execution scope) names that save.
 */
export async function announceDomainEvents(
  events: readonly DomainEvent[],
  dispatcher: Pick<DomainEventDispatcher, 'dispatch'>,
): Promise<void> {
  if (events.length === 0) return;

  const whereAnnounced = AsyncLocalStorage.snapshot();
  const current = domainEventFlow.getStore();
  const flow: DomainEventFlow = current?.open === true ? current : { waiting: [], open: true };

  const dispatch = (event: DomainEvent): Promise<void> =>
    whereAnnounced(() => domainEventFlow.run(flow, () => dispatcher.dispatch([event])));

  flow.waiting.push(...events.map((event): AnnouncedEvent => ({ event, dispatch })));

  if (flow !== current) await drained(flow);
}

async function drained(flow: DomainEventFlow): Promise<void> {
  try {
    for (let next = flow.waiting.shift(); next !== undefined; next = flow.waiting.shift()) {
      await next.dispatch(next.event);
    }
  } finally {
    flow.open = false;
    flow.waiting.length = 0;
  }
}

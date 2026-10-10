import { AsyncLocalStorage } from 'node:async_hooks';
import type { DomainEventDispatcher } from '../../application/ports/domain-event-dispatcher.js';
import type { DomainEvent } from '../../domain/domain-event.js';
import { dispatchAfterCommit } from './dispatch-after-commit.js';
import { dispatchBeforeCommit } from './dispatch-before-commit.js';
import { here } from './here.js';
import { SaveAfterCommitError } from './save-after-commit-error.js';
import { unitOfWorkScope, type QueuedDomainEvent, type UnitOfWorkScope } from './unit-of-work-scope.js';

/**
 * Hands over the events a save pulled from its aggregates.
 *
 * Inside a unit of work they only join its queue, behind what earlier saves recorded: the unit
 * of work dispatches them at its end, before the commit (`withinUnitOfWork`), and the promise
 * resolves at once.
 *
 * Outside of any, the save is all there is to wait for: they are dispatched now, `before-commit`
 * handlers then `after-commit` ones, in the asynchronous context of that save. Events recorded
 * meanwhile, by a handler that saves an aggregate, wait behind them: one chain, in recording
 * order, without recursion. The first `before-commit` handler that fails rejects the promise.
 */
export async function announceDomainEvents(
  events: readonly DomainEvent[],
  dispatcher: Pick<DomainEventDispatcher, 'dispatch'>,
): Promise<void> {
  if (events.length === 0) return;

  const current = unitOfWorkScope.getStore();

  if (current?.stage === 'after-commit') throw new SaveAfterCommitError('announceDomainEvents');

  if (current !== undefined && current.stage !== 'closed') {
    current.queue.push(...queued(events, dispatcher, current.kind === 'save' ? AsyncLocalStorage.snapshot() : here));

    return;
  }

  await dispatchedNow(queued(events, dispatcher, AsyncLocalStorage.snapshot()));
}

function queued(
  events: readonly DomainEvent[],
  dispatcher: Pick<DomainEventDispatcher, 'dispatch'>,
  within: QueuedDomainEvent['within'],
): QueuedDomainEvent[] {
  return events.map((event) => ({ event, dispatcher, within }));
}

async function dispatchedNow(events: QueuedDomainEvent[]): Promise<void> {
  const scope: UnitOfWorkScope = { kind: 'save', stage: 'open', queue: events, dispatched: [] };

  try {
    await dispatchBeforeCommit(scope);
  } finally {
    scope.stage = 'closed';
    scope.queue.length = 0;
  }

  await dispatchAfterCommit(scope);
}

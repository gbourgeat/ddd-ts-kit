import { AsyncLocalStorage } from 'node:async_hooks';
import type { DomainEventDispatcher } from '../../application/ports/domain-event-dispatcher';
import type { ExecutionScope } from '../../application/ports/execution-scope';
import type { DomainEvent } from '../../domain/domain-event';
import { dispatchAfterCommit } from './dispatch-after-commit';
import { dispatchBeforeCommit } from './dispatch-before-commit';
import { here } from './here';
import { SaveAfterCommitError } from './save-after-commit-error';
import { inContextOf } from './in-context-of';
import { unitOfWorkScope, type QueuedDomainEvent, type UnitOfWorkScope, type Within } from './unit-of-work-scope';

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
 *
 * With an execution scope, the handlers of both phases run in the execution context of the save,
 * whenever the dispatch happens: a command run inside another, for another tenant or another actor,
 * shares the unit of work of the first, and its events are dispatched at the end of that one.
 */
export async function announceDomainEvents(
  events: readonly DomainEvent[],
  dispatcher: Pick<DomainEventDispatcher, 'dispatch'>,
  scope?: ExecutionScope,
): Promise<void> {
  if (events.length === 0) {
    return;
  }

  const current = unitOfWorkScope.getStore();

  if (current?.stage === 'after-commit') {
    throw new SaveAfterCommitError('announceDomainEvents');
  }

  if (current !== undefined && current.stage !== 'closed') {
    const within = current.kind === 'save' ? AsyncLocalStorage.snapshot() : here;

    current.queue.push(...queued(events, dispatcher, { within, inContext: inContextOf(scope) }));

    return;
  }

  await dispatchedNow(
    queued(events, dispatcher, { within: AsyncLocalStorage.snapshot(), inContext: inContextOf(scope) }),
  );
}

function queued(
  events: readonly DomainEvent[],
  dispatcher: Pick<DomainEventDispatcher, 'dispatch'>,
  where: { readonly within: Within; readonly inContext: Within },
): QueuedDomainEvent[] {
  return events.map((event) => ({ event, dispatcher, ...where }));
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

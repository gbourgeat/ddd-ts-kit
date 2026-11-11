import { AsyncLocalStorage } from 'node:async_hooks';
import type { DomainEventDispatcher } from '../../application/ports/domain-event-dispatcher';
import type { DomainEvent } from '../../domain/domain-event';
import type { CommitStep } from './commit-step';

/** Runs the work somewhere: in an asynchronous context, in an execution context. */
export type Within = <T>(work: () => T) => T;

/**
 * One event waiting for the end of its scope: who dispatches it, in which asynchronous context, and in
 * which execution context (`inContext`: that of the save that recorded it, kept in both phases).
 */
export interface QueuedDomainEvent {
  readonly event: DomainEvent;
  readonly dispatcher: Pick<DomainEventDispatcher, 'dispatch'>;
  readonly within: Within;
  readonly inContext: Within;
}

/**
 * What one unit of work has to dispatch. `unit-of-work` is opened by `withinUnitOfWork`; `save`
 * is the scope of a save made outside of any, which dispatches as soon as it resolved.
 */
export interface UnitOfWorkScope {
  readonly kind: 'unit-of-work' | 'save';
  stage: 'open' | 'before-commit' | 'after-commit' | 'closed';
  /** Recorded and not dispatched yet, oldest first. */
  readonly queue: QueuedDomainEvent[];
  /** Dispatched before the commit, in that order: what the `after-commit` phase is given. */
  readonly dispatched: QueuedDomainEvent[];
  /** What `afterCommit` was handed in a unit of work: run after the `after-commit` handlers, never on a rollback. */
  readonly committed?: (() => Promise<void>)[];
  /** What `atCommit` was handed in a unit of work: applied last, inside the transaction. */
  readonly atCommit?: CommitStep[];
}

// Follows the asynchronous call chain of what opened it: concurrent commands never share a scope.
export const unitOfWorkScope = new AsyncLocalStorage<UnitOfWorkScope>();

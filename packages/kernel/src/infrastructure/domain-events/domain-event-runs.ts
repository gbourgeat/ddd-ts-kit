import type { DomainEventPhase } from '../../application/events/domain-event-phase';
import { unitOfWorkScope, type QueuedDomainEvent, type UnitOfWorkScope } from './unit-of-work-scope';

/** Neighbours of a queue handed over by the same save to the same dispatcher: they leave together. */
export interface DomainEventRun {
  /** Hands the events to their dispatcher for one phase, inside the scope, in the asynchronous context they were queued with. */
  dispatch(scope: UnitOfWorkScope, phase: DomainEventPhase): Promise<void>;
}

/** Neighbours of the queue handed over by the same save to the same dispatcher: never empty. */
type Group = [QueuedDomainEvent, ...QueuedDomainEvent[]];

export function domainEventRuns(events: readonly QueuedDomainEvent[]): DomainEventRun[] {
  const groups: Group[] = [];

  for (const queued of events) {
    const last = groups.at(-1);

    if (last !== undefined && last[0].dispatcher === queued.dispatcher && last[0].within === queued.within) {
      last.push(queued);
    } else {
      groups.push([queued]);
    }
  }

  return groups.map(runOf);
}

function runOf(group: Group): DomainEventRun {
  const [first] = group;
  const facts = group.map(({ event }) => event);

  return {
    dispatch: (scope, phase) =>
      first.within(() => unitOfWorkScope.run(scope, async () => first.dispatcher.dispatch(facts, phase))),
  };
}

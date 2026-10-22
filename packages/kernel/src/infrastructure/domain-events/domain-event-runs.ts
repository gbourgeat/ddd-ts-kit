import type { DomainEventPhase } from '../../application/events/domain-event-phase';
import { unitOfWorkScope, type QueuedDomainEvent, type UnitOfWorkScope } from './unit-of-work-scope';

/** Neighbours of a queue handed over by the same save to the same dispatcher: they leave together. */
export interface DomainEventRun {
  /** Hands the events to their dispatcher for one phase, inside the scope, in the asynchronous context they were queued with. */
  dispatch(scope: UnitOfWorkScope, phase: DomainEventPhase): Promise<void>;
}

export function domainEventRuns(events: readonly QueuedDomainEvent[]): DomainEventRun[] {
  const groups: QueuedDomainEvent[][] = [];

  for (const queued of events) {
    const first = groups.at(-1)?.[0];

    if (first !== undefined && first.dispatcher === queued.dispatcher && first.within === queued.within) {
      groups.at(-1)?.push(queued);
    } else {
      groups.push([queued]);
    }
  }

  return groups.flatMap(runOf);
}

function runOf(group: readonly QueuedDomainEvent[]): DomainEventRun[] {
  const [first] = group;

  if (first === undefined) {
    return [];
  }

  const facts = group.map(({ event }) => event);

  return [
    {
      dispatch: (scope, phase) =>
        first.within(() => unitOfWorkScope.run(scope, async () => first.dispatcher.dispatch(facts, phase))),
    },
  ];
}

import { SpanKind } from '@opentelemetry/api';
import {
  unitOfWorkStage,
  type DomainEvent,
  type DomainEventDispatcher,
  type DomainEventPhase,
} from '@ddd-ts-kit/kernel';
import { admitDependencySpan } from '../local-root/admit-dependency-span.js';
import { inSpan } from '../span/in-span.js';

/**
 * Decorates a dispatcher: each event is dispatched in a span `domain-event <name>`, and the
 * handlers it reaches are its children. Never the aggregate id nor anything the event carries.
 *
 * At the end of a unit of work the events are under one span `unit-of-work before-commit`,
 * which follows the saves under the span of the command: the trace shows that the handlers ran
 * after every save and before the commit. What their handlers recorded in turn is under a second
 * such span. Once the unit of work has committed, the events that have an `after-commit` handler
 * are under `unit-of-work after-commit`, in the same trace. Outside of a unit of work the events
 * stay under the save that dispatched them. The spans count against the caps of the local root.
 */
export function tracedDomainEvents(dispatcher: DomainEventDispatcher): DomainEventDispatcher {
  const handledAfterCommit = new Set<string>();

  return {
    on: (name, handler, subscription) => {
      if (subscription?.phase === 'after-commit') {
        handledAfterCommit.add(name);
      }

      dispatcher.on(name, handler, subscription);
    },
    dispatch(events, phase = 'before-commit') {
      const shown = phase === 'before-commit' ? events : events.filter((event) => handledAfterCommit.has(event.name));
      const each = (): Promise<void> => dispatchedEach(events, { dispatcher, phase, shown });

      return shown.length > 0 && unitOfWorkStage() === phase ? underThePhase(phase, each) : each();
    },
  };
}

interface Dispatch {
  readonly dispatcher: DomainEventDispatcher;
  readonly phase: DomainEventPhase;
  /** The events that get a span: the others are dispatched without one. */
  readonly shown: readonly DomainEvent[];
}

function underThePhase(phase: DomainEventPhase, work: () => Promise<void>): Promise<void> {
  const name = `unit-of-work ${phase}`;

  return admitDependencySpan(name) ? inSpan({ name, options: { kind: SpanKind.INTERNAL } }, work) : work();
}

async function dispatchedEach(events: readonly DomainEvent[], dispatch: Dispatch): Promise<void> {
  for (const event of events) {
    await dispatched(event, dispatch);
  }
}

function dispatched(event: DomainEvent, { dispatcher, phase, shown }: Dispatch): Promise<void> {
  const name = `domain-event ${event.name}`;

  if (!shown.includes(event) || !admitDependencySpan(name)) {
    return dispatcher.dispatch([event], phase);
  }

  const options = { kind: SpanKind.INTERNAL, attributes: { 'app.domain_event.name': event.name } };

  return inSpan({ name, options }, () => dispatcher.dispatch([event], phase));
}

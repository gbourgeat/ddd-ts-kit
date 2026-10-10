import { SpanKind } from '@opentelemetry/api';
import type { DomainEvent, DomainEventDispatcher } from '@ddd-ts-kit/kernel';
import { admitDependencySpan } from '../local-root/admit-dependency-span.js';
import { inSpan } from '../span/in-span.js';

/**
 * Decorates a dispatcher: each event is dispatched in a span `domain-event <name>`, under the
 * save that announced it, and the handlers it reaches are its children. Never the aggregate
 * id nor anything the event carries. The spans count against the caps of the local root.
 */
export function tracedDomainEvents(dispatcher: DomainEventDispatcher): DomainEventDispatcher {
  return {
    on: (name, handler) => {
      dispatcher.on(name, handler);
    },
    async dispatch(events) {
      for (const event of events) await dispatched(event, dispatcher);
    },
  };
}

function dispatched(event: DomainEvent, dispatcher: DomainEventDispatcher): Promise<void> {
  const name = `domain-event ${event.name}`;

  if (!admitDependencySpan(name)) return dispatcher.dispatch([event]);

  const options = { kind: SpanKind.INTERNAL, attributes: { 'app.domain_event.name': event.name } };

  return inSpan({ name, options }, () => dispatcher.dispatch([event]));
}

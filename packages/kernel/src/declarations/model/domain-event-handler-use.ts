import type { DomainEvent } from '../../domain/domain-event.js';
import type { DomainEventHandler } from './domain-event-handler.js';
import type { DomainEventType } from './domain-event-type.js';

export type DomainEventHandlerUse<Outcome> = <E extends DomainEvent>(
  event: DomainEventType<E>,
  implementation: new (...args: never) => DomainEventHandler<E>,
) => Outcome;

import type { DomainEvent } from '../../domain/domain-event';
import type { DomainEventHandler } from './domain-event-handler';
import type { DomainEventType } from './domain-event-type';

export type DomainEventHandlerUse<Outcome> = <E extends DomainEvent>(
  event: DomainEventType<E>,
  implementation: new (...args: never) => DomainEventHandler<E>,
) => Outcome;

import type { DomainEvent } from '../../domain/domain-event';
import type { NamedDomainEventType } from '../model/named-domain-event-type';
import { DeclarationError } from '../registry/declaration-error';

/** The name the event class declares, read once by the decorator that attaches a reader to its events. */
export function eventNameOf(event: NamedDomainEventType<DomainEvent>, reader: string): string {
  const name: unknown = event.eventName;

  if (typeof name !== 'string' || name.trim() === '') {
    throw new DeclarationError(
      `${reader} of ${event.name} is attached under the name its events carry: declare it once on the event class, static readonly eventName = '<context>.<aggregate>.<fact>'.`,
    );
  }

  return name;
}

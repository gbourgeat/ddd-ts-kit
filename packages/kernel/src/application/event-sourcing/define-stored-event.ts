import type { DomainEvent } from '../../domain/domain-event';
import type { DomainEventType } from '../../declarations/model/domain-event-type';
import { storedDataOf } from './stored-data-of';
import type { StoredEventSpec } from './stored-event-spec';
import type { StoredEventType } from './stored-event-type';

/**
 * Declares how an event of `type` is stored, in the event codec of its aggregate (infrastructure):
 * `defineStoredEvent(NoShowNoted, { version: 1, encode: (event): NoShowNotedData => ({ ... }), decode: ... })`.
 */
export function defineStoredEvent<E extends DomainEvent, Data extends object>(
  type: DomainEventType<E>,
  spec: StoredEventSpec<E, Data>,
): StoredEventType<E> {
  if (!Number.isInteger(spec.version) || spec.version < 1) {
    throw new TypeError(`The stored version of ${type.name} is a whole number from 1, not ${spec.version}`);
  }

  return {
    version: spec.version,
    upcasters: spec.upcasters ?? {},
    encode: (event) => {
      if (!(event instanceof type)) {
        throw new TypeError(`"${event.name}" is declared as a ${type.name} and was recorded as another class`);
      }

      return storedDataOf(spec.encode(event));
    },
    decode: (data, envelope) => spec.decode(data, envelope),
  };
}

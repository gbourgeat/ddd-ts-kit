import type { StoredEvent } from '../../application/event-sourcing/stored-event';
import type { DomainEvent } from '../../domain/domain-event';
import type { EventSerializer } from '../../infrastructure/event-sourcing/event-serializer';
import { DeclarationError } from '../registry/declaration-error';
import { declarationOf } from '../registry/declaration-of';

/**
 * How a declared projection applies the events of an event store: an event whose name one of its
 * `@On` methods applies is read back with the serializer of its aggregate and handed to that
 * method; every other event of the store is passed over. What a `CatchUpSubscription` and an
 * `EventStoreProjectionRebuild` are given: `applyingProjection(new AttendanceHistoryProjection(copy), serializer)`.
 * Every event an `@On` method names has to be declared by that serializer: one it does not
 * declare would be passed over at every event, silently, so it is refused here. A projection fed
 * by the store therefore follows the events of one event-sourced aggregate.
 */
export function applyingProjection<E extends DomainEvent>(
  projection: object,
  serializer: EventSerializer<E>,
): (event: StoredEvent) => Promise<void> {
  const declaration = declarationOf(projection.constructor);

  if (declaration?.role !== 'projection') {
    throw new DeclarationError(
      `${projection.constructor.name} is not a declared projection: it carries no @Projection.`,
    );
  }

  const methods = new Map(
    declaration.applies.flatMap((application) =>
      application.kind === 'domain' ? [[application.name, application.method] as const] : [],
    ),
  );

  const undeclared = [...methods.keys()].filter((name) => !serializer.declares(name));

  if (undeclared.length > 0) {
    throw new DeclarationError(
      `${projection.constructor.name} applies ${undeclared.join(', ')}, which the serializer it is given does not declare: a projection fed by the event store follows the stored events of one aggregate, read back by the serializer of that aggregate.`,
    );
  }

  return async (stored) => {
    const method = methods.get(stored.type);

    if (method !== undefined) {
      const apply: unknown = Reflect.get(projection, method);

      if (typeof apply === 'function') {
        await Reflect.apply(apply, projection, [await serializer.deserialize(stored)]);
      }
    }
  };
}

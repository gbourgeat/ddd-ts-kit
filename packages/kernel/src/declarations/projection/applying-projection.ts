import type { StoredEvent } from '../../application/event-sourcing/stored-event.js';
import type { DomainEvent } from '../../domain/domain-event.js';
import type { EventSerializer } from '../../infrastructure/event-sourcing/event-serializer.js';
import { DeclarationError } from '../registry/declaration-error.js';
import { declarationOf } from '../registry/declaration-of.js';

/**
 * How a declared projection applies the events of an event store: an event whose name one of its
 * `@On` methods applies is read back with the serializer of its aggregate and handed to that
 * method; every other event of the store is passed over. What a `CatchUpSubscription` and an
 * `EventStoreProjectionRebuild` are given: `applyingProjection(new AttendanceHistoryProjection(copy), serializer)`.
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

  return async (stored) => {
    const method = methods.get(stored.type);

    if (method !== undefined && serializer.declares(stored.type)) {
      const apply: unknown = Reflect.get(projection, method);

      if (typeof apply === 'function') {
        await Reflect.apply(apply, projection, [await serializer.deserialize(stored)]);
      }
    }
  };
}

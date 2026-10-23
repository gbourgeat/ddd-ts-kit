import type { IntegrationEvent } from '../events/integration-event';
import type { CachePurgePayload } from './cache-purge-payload';

const TYPE = 'kit.cache.purge-requested';
const VERSION = 1;

/**
 * The message that asks for tags to be purged once the work that asked has committed. It
 * travels as an integration event on the outbox of the application, so it commits or rolls back
 * with that work, and the relay hands it to a `CachePurger` instead of the broker. It is a
 * message of the kit, never part of the published language of a context.
 */
export const CachePurgeRequest = {
  type: TYPE,
  version: VERSION,

  of(
    tags: readonly string[],
    meta: { readonly id: string; readonly occurredAt: string },
  ): IntegrationEvent<CachePurgePayload> {
    return { id: meta.id, type: TYPE, version: VERSION, occurredAt: meta.occurredAt, payload: { tags: [...tags] } };
  },

  /** The tags a purge request names; `undefined` for any other event. */
  tagsOf(event: IntegrationEvent): readonly string[] | undefined {
    if (event.type !== TYPE || typeof event.payload !== 'object' || event.payload === null) {
      return undefined;
    }

    const tags: unknown = Reflect.get(event.payload, 'tags');

    return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === 'string') : undefined;
  },
} as const;

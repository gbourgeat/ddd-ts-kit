import { CachePurgeRequest } from '../../application/cache/cache-purge-request.js';
import type { IntegrationEvent } from '../../application/events/integration-event.js';
import { messagingSystemOf } from '../../application/events/messaging-system-of.js';
import type { CachePurger } from '../../application/ports/cache-purger.js';
import type { IntegrationEventPublisher } from '../../application/ports/integration-event-publisher.js';

/**
 * What the outbox relay publishes through: the purge requests go to the `CachePurger`, every
 * other event to the provider. A purge that fails throws, so the relay retries the record as it
 * retries a publication; purging is idempotent, and a request delivered twice purges twice.
 *
 *     new OutboxRelay({ store, publisher: new PurgingPublisher(new VarnishCachePurger(...), broker), clock })
 */
export class PurgingPublisher implements IntegrationEventPublisher {
  readonly messagingSystem?: string;

  constructor(
    private readonly purger: CachePurger,
    private readonly next: IntegrationEventPublisher,
  ) {
    const system = messagingSystemOf(next);

    if (system !== undefined) {
      this.messagingSystem = system;
    }
  }

  async publish(events: readonly IntegrationEvent[]): Promise<void> {
    const tags = events.flatMap((event) => CachePurgeRequest.tagsOf(event) ?? []);
    const others = events.filter((event) => CachePurgeRequest.tagsOf(event) === undefined);

    if (tags.length > 0) {
      await this.purger.purge([...new Set(tags)]);
    }

    if (others.length > 0) {
      await this.next.publish(others);
    }
  }
}

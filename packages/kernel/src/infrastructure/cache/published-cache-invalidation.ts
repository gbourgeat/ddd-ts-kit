import { CachePurgeRequest } from '../../application/cache/cache-purge-request.js';
import { tenantCacheTags } from '../../application/cache/tenant-cache-tags.js';
import type { CacheInvalidation } from '../../application/ports/cache-invalidation.js';
import type { Clock } from '../../application/ports/clock.js';
import type { ExecutionScope } from '../../application/ports/execution-scope.js';
import type { IdGenerator } from '../../application/ports/id-generator.js';
import type { IntegrationEventPublisher } from '../../application/ports/integration-event-publisher.js';

export interface PublishedCacheInvalidationOptions {
  /** The publisher of the application: with an outbox, the purge request commits with the work. */
  readonly publisher: IntegrationEventPublisher;
  readonly ids: IdGenerator;
  readonly clock: Clock;
  /** Where the tenant of the work is read, to file the tags under it. */
  readonly scope: ExecutionScope;
  /**
   * Files the tags under the tenant of the work, for a multi-tenant application whose answers are
   * tagged per tenant too (`cacheTags.perTenant` of `@ddd-ts-kit/http`). Default `false`: the two
   * sides must agree, or the purges miss.
   */
  readonly perTenant?: boolean;
}

/**
 * Publishes a purge request on the publisher of the application, the tags under the tenant of the
 * work when `perTenant` says so. Behind an outbox, the request is
 * written in the transaction of the work: a rollback takes it away, a commit keeps it until the
 * relay hands it to the `CachePurger` (see `PurgingPublisher`), even across a restart.
 */
export class PublishedCacheInvalidation implements CacheInvalidation {
  constructor(private readonly options: PublishedCacheInvalidationOptions) {}

  async invalidate(tags: readonly string[]): Promise<void> {
    const distinct = [...new Set(tags)];

    if (distinct.length === 0) {
      return;
    }

    const { publisher, ids, clock, scope, perTenant } = this.options;
    const filed = perTenant === true ? tenantCacheTags(distinct, scope.current()?.tenantId) : distinct;

    await publisher.publish([CachePurgeRequest.of(filed, { id: ids.next(), occurredAt: clock.now().toISOString() })]);
  }
}

import { CachePurgeRequest } from '../../application/cache/cache-purge-request';
import { NoCurrentTenantError } from '../../application/audit/no-current-tenant-error';
import { tenantCacheTags } from '../../application/cache/tenant-cache-tags';
import type { CacheInvalidation } from '../../application/ports/cache-invalidation';
import type { Clock } from '../../application/ports/clock';
import type { ExecutionScope } from '../../application/ports/execution-scope';
import type { IdGenerator } from '../../application/ports/id-generator';
import type { IntegrationEventPublisher } from '../../application/ports/integration-event-publisher';

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
   * sides must agree, or the purges miss. Work that names no tenant (a job, a system actor) is then
   * refused (`NoCurrentTenantError`): its purge would meet no answer.
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

    const { publisher, ids, clock } = this.options;
    const filed = this.filed(distinct);

    await publisher.publish([CachePurgeRequest.of(filed, { id: ids.next(), occurredAt: clock.now().toISOString() })]);
  }

  private filed(tags: readonly string[]): readonly string[] {
    if (this.options.perTenant !== true) {
      return tags;
    }

    const tenantId = this.options.scope.current()?.tenantId;

    if (tenantId === undefined) {
      throw new NoCurrentTenantError();
    }

    return tenantCacheTags(tags, tenantId);
  }
}

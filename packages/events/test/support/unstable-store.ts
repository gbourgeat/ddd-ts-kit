import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import type { OutboxRecord, OutboxStats, OutboxStore } from '../../src';

class StoreUnavailable extends Error {
  constructor() {
    super('password authentication failed for user "app"');
  }
}

/** A store whose first claims fail, as when the database is restarting. */
export class UnstableStore implements OutboxStore {
  constructor(
    private readonly inner: OutboxStore,
    private failures: number,
  ) {}

  async claimBatch(limit: number, now: Date): Promise<OutboxRecord[]> {
    if (this.failures > 0) {
      this.failures -= 1;

      throw new StoreUnavailable();
    }

    return this.inner.claimBatch(limit, now);
  }

  append(events: readonly IntegrationEvent[]): Promise<void> {
    return this.inner.append(events);
  }

  markPublished(ids: readonly string[], at: Date): Promise<void> {
    return this.inner.markPublished(ids, at);
  }

  markFailed(id: string, error: { readonly code: string }, nextAttemptAt: Date | null): Promise<void> {
    return this.inner.markFailed(id, error, nextAttemptAt);
  }

  retryDead(ids: readonly string[], now: Date): Promise<number> {
    return this.inner.retryDead(ids, now);
  }

  purgePublished(before: Date): Promise<number> {
    return this.inner.purgePublished(before);
  }

  stats(): Promise<OutboxStats> {
    return this.inner.stats();
  }
}

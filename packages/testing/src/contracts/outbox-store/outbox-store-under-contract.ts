import type { IntegrationEvent } from '@ddd-ts-kit/kernel';

/** An event that carries personal data, as a declaration names it. */
export interface PersonalEventUnderContract {
  readonly type: string;
  readonly version: number;
  readonly personal: { readonly subject: string; readonly fields: readonly string[] };
}

/**
 * The outbox store port of `@ddd-ts-kit/events`, restated structurally so that this package
 * does not depend on it. Any `OutboxStore` fits.
 */
export interface OutboxStoreUnderContract {
  append(events: readonly IntegrationEvent[]): Promise<void>;
  claimBatch(
    limit: number,
    now: Date,
  ): Promise<
    {
      readonly event: IntegrationEvent;
      readonly status: string;
      readonly attempts: number;
      readonly lastErrorCode?: string;
    }[]
  >;
  markPublished(ids: readonly string[], at: Date): Promise<void>;
  markFailed(id: string, error: { readonly code: string }, nextAttemptAt: Date | null): Promise<void>;
  retryDead(ids: readonly string[], now: Date): Promise<number>;
  purgePublished(before: Date): Promise<number>;
  erasePersonalFields(subject: string, events: readonly PersonalEventUnderContract[]): Promise<number>;
  stats(): Promise<{ readonly pending: number; readonly failed: number; readonly dead: number }>;
}

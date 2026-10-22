import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import type { OutboxStatus } from './outbox-status';

export interface OutboxRecord {
  readonly event: IntegrationEvent;
  readonly status: OutboxStatus;
  /** Number of delivery attempts started, the one in progress included. */
  readonly attempts: number;
  /** A pending record is not claimed before this instant. */
  readonly nextAttemptAt: Date;
  /** Identifier-shaped code of the last failure. Never an error message. */
  readonly lastErrorCode?: string;
  readonly publishedAt?: Date;
}

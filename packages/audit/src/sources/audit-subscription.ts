import type { IntegrationEventCallback } from '@ddd-ts-kit/kernel';

/** What `subscribeAll` of `@ddd-ts-kit/events` takes. */
export interface AuditSubscription {
  readonly type: string;
  readonly handler: IntegrationEventCallback;
}

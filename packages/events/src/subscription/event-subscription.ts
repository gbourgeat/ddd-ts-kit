import type { IntegrationEventCallback } from '@ddd-ts-kit/kernel';

export interface EventSubscription {
  readonly type: string;
  readonly handler: IntegrationEventCallback;
}

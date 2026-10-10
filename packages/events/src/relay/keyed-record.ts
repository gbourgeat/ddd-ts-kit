import type { IntegrationEvent } from '@ddd-ts-kit/kernel';

export interface KeyedRecord {
  readonly event: IntegrationEvent;
  readonly attempts: number;
}

import type { IntegrationEvent } from '@ddd-ts-kit/kernel';

export type EventKey = (event: IntegrationEvent) => string | undefined;

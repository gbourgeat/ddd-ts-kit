import type { IntegrationEvent } from '@ddd-ts-kit/kernel';

export const orderOf = (event: IntegrationEvent): string => String((event.payload as { orderId: string }).orderId);

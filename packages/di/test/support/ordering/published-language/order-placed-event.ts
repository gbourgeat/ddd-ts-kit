import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import { OrderPlaced } from './order-placed.js';

/** An order placed event as a broker would deliver it, whatever its payload. */
export function orderPlaced(id: string, payload: unknown, version = 1): IntegrationEvent {
  return {
    id,
    type: OrderPlaced.type,
    version,
    occurredAt: '2026-01-01T00:00:00.000Z',
    payload,
  };
}

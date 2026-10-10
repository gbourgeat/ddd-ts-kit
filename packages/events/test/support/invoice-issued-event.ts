import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import { at, invoiceIssued } from './events.js';

export function invoiceIssuedEvent(id: string): IntegrationEvent {
  return invoiceIssued.create({ invoiceId: `inv-${id}`, orderId: 'order-1' }, { id, occurredAt: at });
}

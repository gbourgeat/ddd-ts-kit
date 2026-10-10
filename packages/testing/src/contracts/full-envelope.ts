import type { IntegrationEvent } from '@ddd-ts-kit/kernel';

/** An envelope using everything a provider has to carry: nesting, null, offset, trace. */
export function fullEnvelope(event: IntegrationEvent): IntegrationEvent {
  return {
    ...event,
    version: 3,
    occurredAt: '2026-03-01T11:30:00.123+01:00',
    payload: { thingId: 'thing-1', lines: [{ sku: 'sku-1', quantity: 2 }], note: null },
    traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
    correlationId: 'corr-7f3a',
  };
}

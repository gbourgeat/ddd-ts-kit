import type { EventToAppend } from '@ddd-ts-kit/kernel';

const AT = new Date('2026-03-01T10:00:00.000Z');

/** An event to append, told apart by its id, with data that exercises the JSON round trip. */
export function eventOf(id: string, data: EventToAppend['data'] = { label: id }): EventToAppend {
  return {
    id,
    type: 'shipping.consignment.weighed',
    schemaVersion: 1,
    data,
    metadata: { aggregateId: 'c1', correlationId: `corr-${id}` },
    occurredAt: AT,
  };
}

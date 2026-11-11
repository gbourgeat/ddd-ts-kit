import { describe, expect, it } from 'vitest';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import { contextModule, defineContextModule, type ContextModule } from '../src';
import { createTestApplication } from './support/on-container';
import { OrderPlaced } from './fixtures/contexts/billing/published-language/order-placed';
import * as reporting from './fixtures/contexts/reporting/reporting.declarations';

const { CustomerOrders } = reporting;

const placed: IntegrationEvent = {
  id: 'evt-1',
  type: 'ordering.order.placed',
  version: 1,
  occurredAt: '2026-10-10T12:00:01.000Z',
  payload: { orderId: 'order-1', customerId: 'customer-1' },
};

/** A context that reacts to the event the projection of reporting applies, by what it reads then. */
function reacting(read: () => Promise<void>): ContextModule {
  return defineContextModule({
    name: 'loyalty',
    register(builder) {
      builder
        .on(OrderPlaced, { consumer: 'loyalty.reward-on-order-placed' })
        .handledByFactory(() => ({ handle: read }));
    },
  });
}

describe('an event a projection applies and a handler reacts to, on the bus of the process', () => {
  it('reaches the projection first, so that the handler reads the row the event wrote, whatever the order of the modules', async () => {
    const seen: unknown[] = [];

    const app = createTestApplication({
      modules: [
        reacting(async () => void seen.push(await app.get(CustomerOrders).get('customer-1'))),
        contextModule('reporting', reporting),
      ],
    });

    await app.start();
    await app.eventBus.publish([placed]);

    expect(seen).toEqual([{ customerId: 'customer-1', orders: 1, lastOrderId: 'order-1' }]);
  });
});

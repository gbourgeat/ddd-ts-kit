import { describe, expect, it } from 'vitest';
import {
  EventBus,
  InMemoryMetrics,
  type EventStamp,
  type IntegrationEvent,
  type ReadModelWrite,
} from '@ddd-ts-kit/kernel';
import { contextModule, kernelModule, override } from '../src';
import { createApplication } from './support/on-container';
import * as reporting from './fixtures/contexts/reporting/reporting.declarations';
import { TransactionalProcessedEvents } from './support/fakes/transactional-processed-events';
import { TransactionalUnitOfWork } from './support/fakes/transactional-unit-of-work';

const { CustomerOrders, CustomerOrdersProjection, InMemoryCustomerOrders } = reporting;

type Row = reporting.CustomerOrdersRow;

const NAME = 'reporting.customer-orders';
const labels = { context: 'reporting', projection: NAME, event: 'ordering.order.placed' };

const placed = (id: string, second: number): IntegrationEvent => ({
  id,
  type: 'ordering.order.placed',
  version: 1,
  occurredAt: new Date(Date.UTC(2026, 9, 10, 12, 0, second)).toISOString(),
  payload: { orderId: `order-${id}`, customerId: 'customer-1' },
});

/** Customers another event registers: an order changes the row of its customer, and never creates it. */
class RegisteredCustomerOrders extends InMemoryCustomerOrders {
  async register(customerId: string, second: number): Promise<void> {
    const stamp = { eventId: 'registered', occurredAt: new Date(Date.UTC(2026, 9, 10, 12, 0, second)) };

    await super.upsertIfNewer(customerId, stamp, () => ({ customerId, orders: 0, lastOrderId: '' }));
  }

  override upsertIfNewer(
    key: string,
    stamp: EventStamp,
    next: (current: Row | undefined) => Row | undefined,
  ): Promise<ReadModelWrite> {
    return this.updateIfNewer(key, stamp, (current) => next(current) ?? current);
  }
}

describe('a declared projection whose event changes a row that is not held yet', () => {
  function reportingOn(rows: RegisteredCustomerOrders) {
    const metrics = new InMemoryMetrics();
    const processed = new TransactionalProcessedEvents();
    const unitOfWork = new TransactionalUnitOfWork([processed]);

    const app = createApplication({
      modules: [
        kernelModule({ metrics, unitOfWork, processedEvents: processed }),
        contextModule('reporting', [CustomerOrdersProjection]),
      ],
      overrides: [override(CustomerOrders, rows)],
    });

    const counted = (result: string) => metrics.counterValue('projection_events_total', { ...labels, result });

    return { app, processed, unitOfWork, counted };
  }

  it('fails the delivery and leaves no mark, so the event comes back and is applied after the creation', async () => {
    const rows = new RegisteredCustomerOrders();
    const { app, processed, unitOfWork } = reportingOn(rows);

    await app.start();
    await expect(app.resolve(EventBus).publish([placed('evt-2', 2)])).rejects.toThrow('1 event handler(s) failed');

    expect(processed.has(`${NAME} evt-2`)).toBe(false);
    expect(await rows.get('customer-1')).toBeUndefined();

    await rows.register('customer-1', 1);
    await app.resolve(EventBus).publish([placed('evt-2', 2)]);

    expect(unitOfWork.outcomes).toEqual(['rolled back', 'committed']);
    expect(processed.has(`${NAME} evt-2`)).toBe(true);
    expect(await rows.get('customer-1')).toEqual({ customerId: 'customer-1', orders: 1, lastOrderId: 'order-evt-2' });
  });

  it('counts each such delivery as early, apart from the failures, until the event is applied', async () => {
    const rows = new RegisteredCustomerOrders();
    const { app, counted } = reportingOn(rows);

    await app.start();
    await expect(app.resolve(EventBus).publish([placed('evt-2', 2)])).rejects.toThrow(AggregateError);
    await expect(app.resolve(EventBus).publish([placed('evt-2', 2)])).rejects.toThrow(AggregateError);
    await rows.register('customer-1', 1);
    await app.resolve(EventBus).publish([placed('evt-2', 2)]);

    expect(counted('early')).toBe(2);
    expect(counted('failed')).toBe(0);
    expect(counted('applied')).toBe(1);
  });
});

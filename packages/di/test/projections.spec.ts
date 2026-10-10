import { describe, expect, it } from 'vitest';
import {
  DomainEventDispatcher,
  EventBus,
  FixedClock,
  InMemoryMetrics,
  InMemoryReadModelStore,
  Criteria,
  scoped,
  type IntegrationEvent,
  type ReadModelStore,
} from '@ddd-ts-kit/kernel';
import {
  contextModule,
  createApplication,
  createTestApplication,
  fake,
  kernelModule,
  override,
  type Instrumentation,
  type WiringError,
} from '../src/index.js';
import { Twice, Twin } from './fixtures/contexts/projection-mistakes.js';
import * as reporting from './fixtures/contexts/reporting/reporting.declarations.js';
import { TransactionalJournal } from './support/fakes/transactional-journal.js';
import { TransactionalProcessedEvents } from './support/fakes/transactional-processed-events.js';
import { TransactionalUnitOfWork, type Transactional } from './support/fakes/transactional-unit-of-work.js';

const { CustomerForgotten, CustomerOrders, CustomerOrdersProjection, InMemoryCustomerOrders, customerOrdersCriteria } =
  reporting;

const NAME = 'reporting.customer-orders';

const placed = (id: string, second: number, customerId = 'customer-1'): IntegrationEvent => ({
  id,
  type: 'ordering.order.placed',
  version: 1,
  occurredAt: new Date(Date.UTC(2026, 9, 10, 12, 0, second)).toISOString(),
  payload: { orderId: `order-${id}`, customerId },
});

const reportingModule = () => contextModule('reporting', reporting);

describe('a declared projection', () => {
  it('applies the integration events of the upstream context to its read model, readable through its port', async () => {
    const app = createTestApplication({ modules: [reportingModule()] });

    await app.start();
    await app.eventBus.publish([placed('evt-1', 1), placed('evt-2', 2), placed('evt-3', 3, 'customer-2')]);

    const page = await app
      .get(CustomerOrders)
      .search(scoped(Criteria.of<reporting.CustomerOrdersRow>(), { kind: 'all' }));

    expect(page.items).toEqual([
      { customerId: 'customer-1', orders: 2, lastOrderId: 'order-evt-2' },
      { customerId: 'customer-2', orders: 1, lastOrderId: 'order-evt-3' },
    ]);
  });

  it('applies an event once, and never one older than what the row holds, whatever the order of the deliveries', async () => {
    const app = createTestApplication({ modules: [reportingModule()] });

    await app.start();
    await app.eventBus.publish([placed('evt-2', 2), placed('evt-2', 2), placed('evt-1', 1), placed('evt-3', 3)]);

    expect(await app.get(CustomerOrders).get('customer-1')).toEqual({
      customerId: 'customer-1',
      orders: 2,
      lastOrderId: 'order-evt-3',
    });
  });

  it('applies the domain events of its own context where they are dispatched', async () => {
    const app = createTestApplication({ modules: [reportingModule()] });

    await app.start();
    await app.eventBus.publish([placed('evt-1', 1)]);

    await app
      .get(DomainEventDispatcher)
      .dispatch([new CustomerForgotten('customer-1', new Date('2026-10-10T12:00:05Z'))]);

    await app.eventBus.publish([placed('evt-2', 2)]);

    expect(await app.get(CustomerOrders).get('customer-1')).toBeUndefined();
  });
});

/** A read model whose writes take part in the unit of work, as a table of the same database does. */
class TransactionalCustomerOrders extends InMemoryCustomerOrders implements Transactional {
  private readonly journal = new TransactionalJournal('A row of the read model');

  failing = false;

  begin(): void {
    this.journal.begin();
  }

  commit(): void {
    this.journal.commit();
  }

  rollBack(): void {
    this.journal.rollBack();
  }

  override async upsertIfNewer(...written: Parameters<ReadModelStore<reporting.CustomerOrdersRow>['upsertIfNewer']>) {
    this.journal.write(written[0]);

    if (this.failing) {
      throw new RangeError('the table is locked');
    }

    return super.upsertIfNewer(...written);
  }
}

describe('a declared projection, with a unit of work and a processed-event store', () => {
  function database() {
    const rows = new TransactionalCustomerOrders();
    const processed = new TransactionalProcessedEvents();
    const unitOfWork = new TransactionalUnitOfWork([rows, processed]);
    const module = contextModule('reporting', [CustomerOrdersProjection]);

    const app = createApplication({
      modules: [kernelModule({ unitOfWork, processedEvents: processed }), module],
      overrides: [override(CustomerOrders, rows)],
    });

    return { rows, processed, unitOfWork, app };
  }

  it('marks the event under the name of the projection, in the unit of work of the write', async () => {
    const { processed, unitOfWork, app } = database();

    await app.start();
    await app.resolve(EventBus).publish([placed('evt-1', 1)]);

    expect(unitOfWork.outcomes).toEqual(['committed']);
    expect(processed.has(`${NAME} evt-1`)).toBe(true);
  });

  it('leaves no mark when the write fails, so the event is applied at its next delivery', async () => {
    const { rows, processed, unitOfWork, app } = database();

    await app.start();
    rows.failing = true;
    await expect(app.resolve(EventBus).publish([placed('evt-1', 1)])).rejects.toThrow('1 event handler(s) failed');
    rows.failing = false;
    await app.resolve(EventBus).publish([placed('evt-1', 1)]);

    expect(unitOfWork.outcomes).toEqual(['rolled back', 'committed']);
    expect(processed.has(`${NAME} evt-1`)).toBe(true);
    expect(await rows.get('customer-1')).toMatchObject({ orders: 1 });
  });
});

describe('a declared projection, seen from outside', () => {
  it('counts what it applied, skipped as stale and failed, and says how old the last applied event was', async () => {
    const metrics = new InMemoryMetrics();
    const rows = new TransactionalCustomerOrders();
    const clock = new FixedClock(new Date('2026-10-10T12:00:10.000Z'));

    const app = createApplication({
      modules: [
        kernelModule({ metrics, clock, unitOfWork: new TransactionalUnitOfWork([rows]) }),
        contextModule('reporting', [CustomerOrdersProjection]),
      ],
      overrides: [override(CustomerOrders, rows)],
    });

    const labels = { context: 'reporting', projection: NAME, event: 'ordering.order.placed' };

    await app.start();
    await app.resolve(EventBus).publish([placed('evt-2', 2), placed('evt-1', 1)]);
    rows.failing = true;
    await expect(app.resolve(EventBus).publish([placed('evt-3', 3)])).rejects.toThrow(AggregateError);

    expect(metrics.counterValue('projection_events_total', { ...labels, result: 'applied' })).toBe(1);
    expect(metrics.counterValue('projection_events_total', { ...labels, result: 'stale' })).toBe(1);
    expect(metrics.counterValue('projection_events_total', { ...labels, result: 'failed' })).toBe(1);
    expect(metrics.gaugeValue('projection_last_event_age_ms', { context: 'reporting', projection: NAME })).toBe(8_000);
  });

  it('is instrumented as a consumer under its name: one `process <projection>` span per delivery', async () => {
    const seen: string[] = [];

    const instrumentation: Instrumentation = {
      consumer: (handler, { consumer, context, type }) => {
        seen.push(`${consumer} of ${context} on ${type}`);

        return handler;
      },
    };

    const app = createApplication({ modules: [kernelModule({ instrumentation }), reportingModule()] });

    await app.start();

    expect(seen).toEqual([`${NAME} of reporting on ordering.order.placed`]);

    expect(app.describe().bindings).toContainEqual(
      expect.objectContaining({ token: 'CustomerOrdersProjection', kind: 'consumer' }),
    );
  });

  it('is described apart from the handlers of integration and domain events', () => {
    const description = createApplication({ modules: [kernelModule(), reportingModule()] }).describe();

    expect(description.projections).toEqual([
      {
        name: NAME,
        projection: 'CustomerOrdersProjection',
        module: 'reporting',
        applies: [
          { kind: 'integration', event: 'ordering.order.placed', version: 1, method: 'orderPlaced' },
          { kind: 'domain', event: 'reporting.customer.forgotten', method: 'forgotten' },
        ],
        origin: 'declared',
        declaredBy: 'CustomerOrdersProjection',
      },
    ]);

    expect(description.integrationEventHandlers).toEqual([]);
    expect(description.domainEventHandlers).toEqual([]);
  });
});

describe('a projection that cannot be wired', () => {
  const failure = (build: () => unknown): Pick<WiringError, 'code' | 'message'> => {
    try {
      build();
    } catch (error) {
      return error as WiringError;
    }

    throw new Error('The application was built');
  };

  it('is refused when another projection carries its name', () => {
    const refused = failure(() =>
      createApplication({ modules: [kernelModule(), reportingModule(), contextModule('analytics', [Twin])] }),
    );

    expect(refused.code).toBe('DUPLICATE_PROJECTION');

    expect(refused.message).toContain(
      'Projection "reporting.customer-orders" is declared twice: in module "reporting" (declared by class CustomerOrdersProjection) and in module "analytics" (declared by class Twin)',
    );
  });

  it('is refused when two of its methods apply the same event', () => {
    const bound = [Twice, InMemoryCustomerOrders];

    expect(
      failure(() => createApplication({ modules: [kernelModule(), contextModule('reporting', bound)] })).code,
    ).toBe('DUPLICATE_CONSUMER');
  });

  it('is refused without its read model', () => {
    const refused = failure(() =>
      createApplication({ modules: [kernelModule(), contextModule('reporting', [CustomerOrdersProjection])] }),
    );

    expect(refused.code).toBe('UNBOUND_DEPENDENCY');
    expect(refused.message).toContain('CustomerOrders');
  });

  it('keeps the fake of its read model a plain in-memory store', async () => {
    const rows = new InMemoryReadModelStore(customerOrdersCriteria);

    const app = createTestApplication({
      modules: [contextModule('reporting', [CustomerOrdersProjection])],
      fakes: [fake(CustomerOrders, rows)],
    });

    await app.start();
    await app.eventBus.publish([placed('evt-1', 1)]);

    expect(await rows.get('customer-1')).toMatchObject({ orders: 1 });
  });
});

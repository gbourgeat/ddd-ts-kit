import { describe, expect, it } from 'vitest';
import { Clock, FixedClock } from '@ddd-ts-kit/kernel';
import { createApplication, kernelModule, override } from '../src/index.js';
import { billingModule } from './support/billing/billing.module.js';
import { orderingModule } from './support/ordering/ordering.module.js';

describe('application.describe', () => {
  const app = createApplication({
    modules: [kernelModule(), orderingModule, billingModule],
    overrides: [override(Clock, new FixedClock(new Date(0)))],
  });

  const description = app.describe();

  it('lists the modules, in order', () => {
    expect(description.modules).toEqual(['kernel', 'ordering', 'billing']);
  });

  it('lists every binding with its kind, lifetime, source and dependencies, by name', () => {
    expect(description.bindings).toContainEqual({
      token: 'OrderRepository',
      module: 'ordering',
      kind: 'repository',
      lifetime: 'singleton',
      source: 'class',
      implementation: 'InMemoryOrderRepository',
      dependencies: [],
      overridden: false,
    });

    expect(description.bindings).toContainEqual({
      token: 'PlaceOrderHandler',
      module: 'ordering',
      kind: 'use-case',
      lifetime: 'singleton',
      source: 'class',
      implementation: 'PlaceOrderHandler',
      dependencies: ['OrderRepository', 'IntegrationEventPublisher', 'IdGenerator', 'Clock'],
      overridden: false,
    });

    expect(description.bindings).toContainEqual({
      token: 'Clock',
      module: 'kernel',
      lifetime: 'singleton',
      source: 'factory',
      dependencies: [],
      overridden: true,
    });
  });

  it('lists commands, queries and integration event handlers with the module that declares them', () => {
    expect(description.commands).toEqual([
      { message: 'PlaceOrder', handler: 'PlaceOrderHandler', module: 'ordering' },
      { message: 'CancelOrder', handler: 'CancelOrderHandler', module: 'ordering' },
      { message: 'IssueInvoice', handler: 'IssueInvoiceHandler', module: 'billing' },
    ]);

    expect(description.queries).toEqual([
      { message: 'GetOrder', handler: 'GetOrderHandler', module: 'ordering' },
    ]);

    expect(description.integrationEventHandlers).toEqual([
      {
        event: 'ordering.order.placed',
        version: 1,
        consumer: 'billing.invoice-on-order-placed',
        handler: 'InvoiceOnOrderPlaced',
        module: 'billing',
      },
    ]);

    expect(description.overrides).toEqual(['Clock']);
  });

  it('is plain data that survives serialization', () => {
    expect(JSON.parse(JSON.stringify(description))).toEqual(description);
  });
});

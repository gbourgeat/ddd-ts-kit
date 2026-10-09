import { describe, expect, it } from 'vitest';
import { FixedClock } from '@ddd-ts-kit/kernel';
import { CLOCK, createApplication, kernelModule, override } from '../src/index.js';
import { billingModule, orderingModule } from './support/ordering.js';

describe('application.describe', () => {
  const app = createApplication({
    modules: [kernelModule(), orderingModule, billingModule],
    overrides: [override(CLOCK, new FixedClock(new Date(0)))],
  });
  const description = app.describe();

  it('lists the modules, in order', () => {
    expect(description.modules).toEqual(['kernel', 'ordering', 'billing']);
  });

  it('lists every binding with its kind, lifetime, source and dependencies, by name', () => {
    expect(description.bindings).toContainEqual({
      token: 'ordering.OrderRepository',
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
      dependencies: ['ordering.OrderRepository', 'kernel.EventPublisher', 'kernel.IdGenerator', 'kernel.Clock'],
      overridden: false,
    });
    expect(description.bindings).toContainEqual({
      token: 'kernel.Clock',
      module: 'kernel',
      lifetime: 'singleton',
      source: 'factory',
      dependencies: [],
      overridden: true,
    });
  });

  it('lists commands, queries and subscriptions with the module that declares them', () => {
    expect(description.commands).toEqual([
      { message: 'PlaceOrder', handler: 'PlaceOrderHandler', module: 'ordering' },
      { message: 'CancelOrder', handler: 'CancelOrderHandler', module: 'ordering' },
      { message: 'IssueInvoice', handler: 'IssueInvoiceHandler', module: 'billing' },
    ]);
    expect(description.queries).toEqual([
      { message: 'GetOrder', handler: 'GetOrderHandler', module: 'ordering' },
    ]);
    expect(description.subscriptions).toEqual([
      {
        event: 'ordering.order.placed',
        version: 1,
        consumer: 'billing.invoice-on-order-placed',
        handler: 'InvoiceOnOrderPlaced',
        module: 'billing',
      },
    ]);
    expect(description.overrides).toEqual(['kernel.Clock']);
  });

  it('is plain data that survives serialization', () => {
    expect(JSON.parse(JSON.stringify(description))).toEqual(description);
  });
});

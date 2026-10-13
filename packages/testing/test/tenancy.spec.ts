import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AsyncLocalStorageExecutionScope } from '@ddd-ts-kit/kernel';
import { anExecutionContext, asTenant } from '../src/index.js';
import { tenantIsolationContract } from '../src/contracts.js';
import { Order, at } from './support/order.js';
import { TenantOrders } from './support/tenant-orders.js';

const runner = { describe, it, expect, beforeEach, afterEach };
let next = 0;

const orders = {
  createAggregate: () =>
    Order.place(`order-${(next += 1)}`, { id: 'c-1', name: 'Ada' }, [{ sku: 'a', quantity: 1 }], at),
  mutate: (order: Order) => order.addLine({ sku: 'c', quantity: 3 }, at),
  idOf: (order: Order) => order.id,
  stateOf: (order: Order) => order.toSnapshot(),
};

tenantIsolationContract<Order>(runner, {
  ...orders,
  name: 'in memory, shared storage confined by the tenant of the work',
  recreate: (order: Order) => Order.place(order.id, { id: 'c-2', name: 'Bob' }, [{ sku: 'b', quantity: 2 }], at),
  elevatedReads: true,
  createRepository: (scope) => new TenantOrders(scope),
});

tenantIsolationContract<Order>(runner, {
  ...orders,
  name: 'in memory, without the inserts and the reads of an elevation',
  createRepository: (scope) => new TenantOrders(scope),
});

describe('asTenant', () => {
  it('runs work as a member of the tenant, in that tenant', async () => {
    const scope = new AsyncLocalStorageExecutionScope();

    const context = await asTenant(scope, 'acme', async () => scope.require());

    expect(context.tenantId).toBe('acme');
    expect(context.actor.tenantId).toBe('acme');
  });

  it('opens an elevation over tenants, as acrossTenants would, for a spec', () => {
    expect(anExecutionContext().elevatedOver(['acme']).build().elevation).toEqual({
      reason: 'TEST',
      tenants: ['acme'],
    });
  });
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AsyncLocalStorageExecutionScope, NoCurrentTenantError, type Repository } from '@ddd-ts-kit/kernel';
import { anExecutionContext, asTenant } from '../src';
import { tenantIsolationContract } from '../src/contracts';
import { CollectingRunner } from './support/collecting-runner';
import { Order, at } from './support/order';
import { TenantOrders } from './support/tenant-orders';

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

/** Row-level security alone: the database shows nothing to work that names no tenant, and refuses its writes. */
class RowLevelSecurityOrders extends TenantOrders {
  override findById(id: string): Promise<Order | undefined> {
    return Promise.resolve()
      .then(() => super.findById(id))
      .catch((error: unknown) => (error instanceof NoCurrentTenantError ? undefined : Promise.reject(error)));
  }
}

tenantIsolationContract<Order>(runner, {
  ...orders,
  name: 'in memory, under row-level security alone',
  elevatedReads: true,
  createRepository: (scope) => new RowLevelSecurityOrders(scope),
});

/** A repository that takes every save and finds nothing back. */
class ForgetfulOrders implements Repository<Order> {
  async findById(): Promise<Order | undefined> {
    return undefined;
  }

  async save(): Promise<void> {
    return undefined;
  }
}

describe('the tenant isolation contract and a repository that keeps nothing', () => {
  it.each([true, false])(
    'fails it on every test, with or without the reads of an elevation (%s)',
    async (elevatedReads) => {
      const collecting = new CollectingRunner();

      tenantIsolationContract<Order>(collecting, {
        ...orders,
        name: 'forgetful',
        recreate: (order: Order) => Order.place(order.id, { id: 'c-2', name: 'Bob' }, [{ sku: 'b', quantity: 2 }], at),
        elevatedReads,
        createRepository: () => new ForgetfulOrders(),
      });

      const { failed, passed } = await collecting.run();

      expect(failed).toEqual([
        'hides from a tenant what another tenant saved, and keeps it for its owner',
        'leaves untouched what a tenant saved when another saves under the same id',
        'leaves untouched what a tenant saved when another inserts a new aggregate under its id',
        'lets an elevation read what it reaches when the strategy allows it, and write nothing',
        'refuses a write of work that names no tenant, and shows it nothing',
      ]);

      expect(passed).toEqual([]);
    },
  );
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

import { beforeEach, describe, expect, it } from 'vitest';
import { ConcurrencyError, type Repository, UniqueViolationError } from '@ddd-ts-kit/kernel';
import { InMemoryRepository, resetSequences } from '../src';
import { repositoryContract } from '../src/contracts';
import { anOrder } from './support/builders';
import { CollectingRunner } from './support/collecting-runner';
import { Order, at } from './support/order';

beforeEach(() => {
  resetSequences();
});

/** One order per customer, the storage keeping the customer unique: a second one is refused with `refusal`. */
class OneOrderPerCustomer implements Repository<Order> {
  private readonly orders = new InMemoryRepository<Order>({ clone: (order) => Order.rehydrate(order.toSnapshot()) });

  private readonly customers = new Map<string, string>();

  constructor(private readonly refusal: (order: Order) => Error) {}

  findById(id: string): Promise<Order | undefined> {
    return this.orders.findById(id);
  }

  async save(order: Order): Promise<void> {
    const customer = order.toSnapshot().customer.id;
    const holder = this.customers.get(customer);

    if (holder !== undefined && holder !== order.id) {
      throw this.refusal(order);
    }

    await this.orders.save(order);
    this.customers.set(customer, order.id);
  }
}

const orders = {
  createAggregate: () => anOrder().build(),
  createAggregateTaking: (holder: Order) => anOrder().placedBy(holder.toSnapshot().customer).build(),
  mutate: (order: Order) => order.addLine({ sku: 'pen', quantity: 1 }, at),
  idOf: (order: Order) => order.id,
  stateOf: (order: Order) => order.toSnapshot(),
};

describe('the repository contract and a unique value of the storage', () => {
  it('passes a repository that refuses a taken value as a conflict, and stores nothing of the second aggregate', async () => {
    const collecting = new CollectingRunner();

    repositoryContract<Order>(collecting, {
      ...orders,
      name: 'one order per customer',
      createRepository: () => new OneOrderPerCustomer((order) => new UniqueViolationError(order.id)),
    });

    const { failed, passed } = await collecting.run();

    expect(failed).toEqual([]);

    expect(passed).toContain(
      'refuses a new aggregate that takes a unique value of another as a conflict, not a lost update',
    );
  });

  it('fails a repository that reads a taken value as a lost update, and on that alone', async () => {
    const collecting = new CollectingRunner();

    repositoryContract<Order>(collecting, {
      ...orders,
      name: 'taken value read as a lost update',
      createRepository: () => new OneOrderPerCustomer((order) => new ConcurrencyError(order.id)),
    });

    const { failed } = await collecting.run();

    expect(failed).toEqual([
      'refuses a new aggregate that takes a unique value of another as a conflict, not a lost update',
    ]);
  });
});

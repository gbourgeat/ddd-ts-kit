import { beforeEach, describe, expect, it } from 'vitest';
import { FixedClock, type Lock, type LockHandle, type Repository } from '@ddd-ts-kit/kernel';
import { InMemoryRepository, resetSequences } from '../src';
import { lockContract, repositoryContract } from '../src/contracts';
import { anOrder } from './support/builders';
import { CollectingRunner } from './support/collecting-runner';
import { Order, at, type OrderSnapshot } from './support/order';

beforeEach(() => {
  resetSequences();
});

const orders = {
  createAggregate: () => anOrder().build(),
  mutate: (order: Order) => order.addLine({ sku: 'pen', quantity: 1 }, at),
  idOf: (order: Order) => order.id,
  stateOf: (order: Order) => order.toSnapshot(),
};

/** A repository that takes every save and finds nothing back. */
class ForgetfulOrders implements Repository<Order> {
  async findById(): Promise<Order | undefined> {
    return undefined;
  }

  async save(): Promise<void> {
    return undefined;
  }
}

/** A repository where the last save wins, whatever version it was loaded at. */
class LastWriteWinsOrders implements Repository<Order> {
  private readonly rows = new Map<string, { readonly snapshot: OrderSnapshot; readonly version: number }>();

  async findById(id: string): Promise<Order | undefined> {
    const row = this.rows.get(id);

    if (row === undefined) {
      return undefined;
    }

    const order = Order.rehydrate(row.snapshot);

    order.version = row.version;

    return order;
  }

  async save(order: Order): Promise<void> {
    order.version += 1;
    this.rows.set(order.id, { snapshot: order.toSnapshot(), version: order.version });
  }
}

describe('the repository contract and a mutate that changes nothing', () => {
  it('says so in the stale-save case instead of waiting for a conflict', async () => {
    const collecting = new CollectingRunner();

    repositoryContract<Order>(collecting, {
      ...orders,
      mutate: () => undefined,
      name: 'unchanged',
      createRepository: () => new InMemoryRepository<Order>({ clone: (order) => Order.rehydrate(order.toSnapshot()) }),
    });

    const { failed, messages } = await collecting.run();

    expect(failed).toEqual(['refuses to overwrite a change it has not seen']);
    expect(messages.join('\n')).toContain('mutate changed nothing: give the contract a change of state');
  });
});

describe('the repository contract without a mutate', () => {
  it('leaves the stale-save case pending with its reason, and passes the others', async () => {
    const collecting = new CollectingRunner();

    const { mutate: _left, ...withoutMutate } = orders;

    repositoryContract<Order>(collecting, {
      ...withoutMutate,
      name: 'no mutate',
      createRepository: () => new InMemoryRepository<Order>({ clone: (order) => Order.rehydrate(order.toSnapshot()) }),
    });

    const { failed, passed } = await collecting.run();

    expect(failed).toEqual([]);
    expect(passed).toHaveLength(6);

    expect(collecting.pending).toEqual([
      expect.stringContaining('give the contract a mutate that records a change of state'),
    ]);
  });
});

describe('the repository contract and a broken repository', () => {
  it('fails a repository that loses what it saved wherever a saved aggregate is read back', async () => {
    const collecting = new CollectingRunner();

    repositoryContract<Order>(collecting, {
      ...orders,
      name: 'forgetful',
      createRepository: () => new ForgetfulOrders(),
    });

    const { failed } = await collecting.run();

    expect(failed).toEqual([
      'finds a saved aggregate with the state it was saved in',
      'keeps aggregates apart',
      'stores the changes of a loaded aggregate that is saved again',
      'accepts several saves of the same instance in a row',
      'is not affected by a mutation that is not saved',
      'refuses to overwrite a change it has not seen',
    ]);
  });

  it('fails a repository where the last save wins on the change it has not seen, and on that alone', async () => {
    const collecting = new CollectingRunner();

    repositoryContract<Order>(collecting, {
      ...orders,
      name: 'last write wins',
      createRepository: () => new LastWriteWinsOrders(),
    });

    const { failed, passed } = await collecting.run();

    expect(failed).toEqual(['refuses to overwrite a change it has not seen']);
    expect(passed).toHaveLength(6);
  });
});

/** A lock whose keys stay taken once given: a release frees nothing, and neither does time. */
class NeverFreedLock implements Lock {
  private readonly taken = new Set<string>();

  private token = 0;

  async acquire(key: string): Promise<LockHandle | undefined> {
    if (this.taken.has(key)) {
      return undefined;
    }

    this.taken.add(key);
    this.token += 1;

    return { key, fencingToken: this.token, release: async () => undefined };
  }
}

describe('the lock contract and a lock that never frees a key', () => {
  it('fails it wherever a key is expected back, by a release or by time', async () => {
    const collecting = new CollectingRunner();
    const clock = new FixedClock(new Date('2026-03-01T10:00:00.000Z'));

    lockContract(collecting, {
      name: 'never freed',
      createLock: () => new NeverFreedLock(),
      elapse: (ms) => clock.advance(ms),
    });

    const { failed } = await collecting.run();

    expect(failed).toEqual([
      'frees the key when its holder releases it, once or twice',
      'frees the key by itself when the time to live has passed',
      'numbers the acquisitions of a key with a token that only grows',
      'waits for a key that is released within the time it was told to wait',
    ]);
  });
});

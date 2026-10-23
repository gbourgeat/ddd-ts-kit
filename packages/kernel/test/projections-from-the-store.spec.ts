import { describe, expect, it } from 'vitest';
import {
  CONCURRENCY_CONFLICT,
  CatchUpSubscription,
  EventSerializer,
  EventSourcedRepository,
  EventStoreProjectionRebuild,
  InMemoryCheckpointStore,
  InMemoryEventStore,
  InMemoryReadModelTable,
  InMemorySubjectKeyStore,
  InMemoryUnitOfWork,
  PersonalDataCipher,
  ShadowReadModelStore,
  TableReadModelStore,
  type StoredEvent,
} from '../src';
import { applyingProjection, declarationOf } from '../src/declarations';
import { Account, type AccountEvent, type AccountState } from './support/bank/account';
import { accountEvents } from './support/bank/account-events';
import { BalancesProjection, balanceCriteria, type BalanceRow } from './fixtures/event-sourcing/balances';
import { TwoAggregatesProjection } from './fixtures/event-sourcing/two-aggregates';

const serializer = new EventSerializer<AccountEvent>(accountEvents, {
  cipher: new PersonalDataCipher(new InMemorySubjectKeyStore()),
});

async function bank() {
  const store = new InMemoryEventStore();

  const accounts = new EventSourcedRepository<Account, AccountEvent, AccountState>({
    store,
    serializer,
    category: 'bank.account',
    rehydrate: (id, history) => Account.rehydrate(id, history),
  });

  await accounts.save(Account.open('a1', 'Ada').deposit(500).withdraw(200));
  await accounts.save(Account.open('a2', 'Alan').deposit(70));

  const table = new InMemoryReadModelTable<BalanceRow>();
  const projection = new BalancesProjection(new TableReadModelStore(table, balanceCriteria));
  const checkpoints = new InMemoryCheckpointStore();

  return { store, accounts, table, projection, checkpoints };
}

describe('a projection fed by the event store', () => {
  it('is declared with its feed', () => {
    expect(declarationOf(BalancesProjection)).toMatchObject({ role: 'projection', feed: 'event-store' });
  });

  it('catches up from position zero, by batches, each one committed with its checkpoint', async () => {
    const { store, projection, checkpoints, table } = await bank();

    const subscription = new CatchUpSubscription({
      name: 'bank.balances',
      store,
      checkpoints,
      unitOfWork: new InMemoryUnitOfWork(),
      apply: applyingProjection(projection, serializer),
      batchSize: 2,
    });

    expect(await subscription.catchUp()).toBe(5);
    expect(await checkpoints.position('bank.balances')).toBe(5);
    expect((await table.find('a1'))?.row).toEqual({ accountId: 'a1', cents: 300 });
    expect((await table.find('a2'))?.row).toEqual({ accountId: 'a2', cents: 70 });
    expect(await subscription.poll()).toBe(0);
  });

  it('leaves its checkpoint where it was when an event fails, and applies the batch again at the next poll', async () => {
    const { store, projection, checkpoints, table } = await bank();
    let failing = true;
    const apply = applyingProjection(projection, serializer);

    const subscription = new CatchUpSubscription({
      name: 'bank.balances',
      store,
      checkpoints,
      unitOfWork: new InMemoryUnitOfWork(),
      apply: async (event: StoredEvent) => {
        if (failing && event.position === 3) {
          throw new Error('the read model is down');
        }

        await apply(event);
      },
    });

    await expect(subscription.poll()).rejects.toThrow('the read model is down');
    expect(await checkpoints.position('bank.balances')).toBe(0);

    failing = false;
    await subscription.catchUp();

    expect((await table.find('a1'))?.row).toEqual({ accountId: 'a1', cents: 300 });
  });

  it('refuses the second of two runs that applied the same batch', async () => {
    const checkpoints = new InMemoryCheckpointStore();

    await checkpoints.advance('bank.balances', 0, 3);

    await expect(checkpoints.advance('bank.balances', 0, 3)).rejects.toMatchObject({ code: CONCURRENCY_CONFLICT });
  });
});

describe('a projection fed by the event store, rebuilt', () => {
  it('is rebuilt from position zero into a copy that takes the place of the table, the events of the meantime included', async () => {
    const { store, accounts, table, projection } = await bank();

    await table.insert({
      key: 'a1',
      row: { accountId: 'a1', cents: -1 },
      stamp: { eventId: 'x', occurredAt: new Date(0) },
    });

    const rebuild = new EventStoreProjectionRebuild<BalanceRow>({
      table,
      store,
      unitOfWork: new InMemoryUnitOfWork(),
      applierOn: (copy) => applyingProjection(new BalancesProjection(copy), serializer),
      batchSize: 2,
    });

    const report = await rebuild.run();
    const again = await accounts.findById('a2');

    await accounts.save(again?.deposit(5) ?? Account.open('a3', 'x'));

    await new EventStoreProjectionRebuild<BalanceRow>({
      table,
      store,
      unitOfWork: new InMemoryUnitOfWork(),
      applierOn: (copy) => applyingProjection(new BalancesProjection(copy), serializer),
    }).run();

    expect(report).toEqual({ replayed: 5 });
    expect((await table.find('a1'))?.row).toEqual({ accountId: 'a1', cents: 300 });
    expect((await table.find('a2'))?.row).toEqual({ accountId: 'a2', cents: 75 });
    expect(projection.applied).toBe(0);
  });

  it('leaves the table as it was when the rebuild fails', async () => {
    const { store, table } = await bank();

    await table.insert({
      key: 'a1',
      row: { accountId: 'a1', cents: 1 },
      stamp: { eventId: 'x', occurredAt: new Date(0) },
    });

    const failing = new EventStoreProjectionRebuild<BalanceRow>({
      table,
      store,
      unitOfWork: new InMemoryUnitOfWork(),
      applierOn: () => () => Promise.reject(new Error('the projection is wrong')),
    });

    await expect(failing.run()).rejects.toThrow('the projection is wrong');
    expect(await table.rebuilding()).toBe(false);
    expect((await table.find('a1'))?.row).toEqual({ accountId: 'a1', cents: 1 });
  });

  it('applies through the projection only the events it declares, and refuses an undeclared class', async () => {
    const { store, projection } = await bank();
    const apply = applyingProjection(projection, serializer);

    for (const event of await store.readAll(0, 10)) {
      await apply(event);
    }

    expect(projection.applied).toBe(3);
    expect(() => applyingProjection({}, serializer)).toThrow('carries no @Projection');

    expect(() => applyingProjection(new TwoAggregatesProjection(), serializer)).toThrow(
      'TwoAggregatesProjection applies bank.loan.repaid, which the serializer it is given does not declare',
    );

    await expect(
      new ShadowReadModelStore(new InMemoryReadModelTable<BalanceRow>()).search({} as never),
    ).rejects.toThrow('never searched');
  });
});

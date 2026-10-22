import { describe, expect, it } from 'vitest';
import {
  CONCURRENCY_CONFLICT,
  EventSerializer,
  EventSourcedRepository,
  InMemoryEventStore,
  InMemorySnapshotStore,
  InMemorySubjectKeyStore,
  PersonalDataCipher,
  personalData,
  type SnapshotPolicy,
} from '../src';
import { Account, type AccountEvent, type AccountState } from './support/bank/account';
import { accountEvents } from './support/bank/account-events';

const cipher = new PersonalDataCipher(new InMemorySubjectKeyStore());

function bank(snapshots?: SnapshotPolicy<Account, AccountState>, store = new InMemoryEventStore()) {
  const accounts = new EventSourcedRepository<Account, AccountEvent, AccountState>({
    store,
    category: 'bank.account',
    serializer: new EventSerializer<AccountEvent>(accountEvents, { cipher }),
    rehydrate: (id, history) => Account.rehydrate(id, history),
    ...(snapshots === undefined ? {} : { snapshots }),
  });

  return { store, accounts };
}

function everyThree(store = new InMemorySnapshotStore(), version = 1): SnapshotPolicy<Account, AccountState> {
  return {
    store,
    every: 3,
    version,
    encode: (account) => {
      const state = account.toState();

      return { ...state, holder: personalData(account.id, state.holder) };
    },
    decode: (data) => ({
      holder: data.text('holder'),
      balance: data.number('balance'),
      movements: data.number('movements'),
    }),
  };
}

describe('EventSourcedRepository', () => {
  it('appends what the aggregate recorded to its stream, and finds it again by replaying the stream', async () => {
    const { store, accounts } = bank();

    await accounts.save(Account.open('a1', 'Ada').deposit(400));

    const found = await accounts.findById('a1');

    expect(found?.toState()).toEqual({ holder: 'Ada', balance: 400, movements: 1 });
    expect(found?.version).toBe(2);

    expect((await store.readStream('bank.account-a1')).map((event) => event.type)).toEqual([
      'bank.account.opened',
      'bank.account.deposited',
    ]);

    expect(await accounts.findById('a2')).toBeUndefined();
  });

  it('saves the same aggregate again from the version its first save left it at', async () => {
    const { accounts } = bank();
    const account = Account.open('a1', 'Ada');

    await accounts.save(account);
    await accounts.save(account.deposit(10));
    await accounts.save(account);

    expect((await accounts.findById('a1'))?.version).toBe(2);
  });

  it('refuses the save of an aggregate somebody else saved since it was loaded', async () => {
    const { accounts } = bank();

    await accounts.save(Account.open('a1', 'Ada'));

    const first = await accounts.findById('a1');
    const second = await accounts.findById('a1');

    await accounts.save(first?.deposit(5) ?? Account.open('x', 'x'));

    await expect(accounts.save(second?.deposit(7) ?? Account.open('y', 'y'))).rejects.toMatchObject({
      code: CONCURRENCY_CONFLICT,
    });

    expect((await accounts.findById('a1'))?.toState().balance).toBe(5);
  });

  it('takes a snapshot when a save crosses its interval, and loads from it with the events after it', async () => {
    const snapshots = new InMemorySnapshotStore();
    const { accounts } = bank(everyThree(snapshots));
    const account = Account.open('a1', 'Ada').deposit(1);

    await accounts.save(account);
    expect(await snapshots.find('bank.account-a1')).toBeUndefined();

    await accounts.save(account.deposit(2).deposit(3));
    await accounts.save(account.withdraw(1));

    const snapshot = await snapshots.find('bank.account-a1');
    const loaded = await accounts.findById('a1');

    expect(snapshot?.version).toBe(4);
    expect(JSON.stringify(snapshot?.data)).not.toContain('Ada');
    expect(loaded?.toState()).toEqual({ holder: 'Ada', balance: 5, movements: 4 });
    expect(loaded?.version).toBe(5);
  });

  it('ignores a snapshot of another shape and replays the stream from its start', async () => {
    const store = new InMemoryEventStore();
    const outdated = new InMemorySnapshotStore();

    await bank(undefined, store).accounts.save(Account.open('a1', 'Ada').deposit(1).deposit(2));
    await outdated.save({ stream: 'bank.account-a1', version: 3, schemaVersion: 1, data: { garbage: true } });

    const loaded = await bank(everyThree(outdated, 2), store).accounts.findById('a1');

    expect(loaded?.toState()).toEqual({ holder: 'Ada', balance: 3, movements: 2 });
    expect(loaded?.version).toBe(3);
  });
});

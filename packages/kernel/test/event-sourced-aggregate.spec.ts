import { describe, expect, it } from 'vitest';
import { InMemoryEventStore, appendChanges } from '../src/index.js';
import { AT, Account, AccountOpened, MoneyDeposited, Overdraft } from './support/bank/account.js';

describe('EventSourcedAggregate', () => {
  it('changes its state through the apply method of each event it records, and keeps the events for the save', () => {
    const account = Account.open('a1', 'Ada').deposit(500).withdraw(200);

    expect(account.toState()).toEqual({ holder: 'Ada', balance: 300, movements: 2 });
    expect(account.version).toBe(0);

    expect(account.pullEvents().map((event) => event.name)).toEqual([
      'bank.account.opened',
      'bank.account.deposited',
      'bank.account.withdrawn',
    ]);
  });

  it('decides on the state its events built: a refused command records nothing', () => {
    const account = Account.open('a1', 'Ada').deposit(100);

    account.pullEvents();

    expect(() => account.withdraw(500)).toThrow(Overdraft);
    expect(account.pullEvents()).toEqual([]);
  });

  it('is rebuilt by replaying its stream, at the version of the stream, recording nothing', () => {
    const account = Account.rehydrate('a1', {
      events: [new AccountOpened('a1', AT, 'Ada'), new MoneyDeposited('a1', AT, 500), new MoneyDeposited('a1', AT, 70)],
    });

    expect(account.toState()).toEqual({ holder: 'Ada', balance: 570, movements: 2 });
    expect(account.version).toBe(3);
    expect(account.pullEvents()).toEqual([]);
  });

  it('starts from a snapshot and replays only the events after it', () => {
    const account = Account.rehydrate('a1', {
      snapshot: { version: 10, state: { holder: 'Ada', balance: 1000, movements: 9 } },
      events: [new MoneyDeposited('a1', AT, 1)],
    });

    expect(account.toState()).toEqual({ holder: 'Ada', balance: 1001, movements: 10 });
    expect(account.version).toBe(11);
  });

  it('hands what it recorded since it was loaded to the append, then stands at the new version', async () => {
    const store = new InMemoryEventStore();
    const account = Account.open('a1', 'Ada').deposit(5);
    const appended: string[] = [];

    await appendChanges(account, async ({ expected, events }) => {
      appended.push(`${expected}: ${events.map((event) => event.name).join(', ')}`);
      await store.append('a1', expected, []);
    });

    await appendChanges(account, async () => {
      appended.push('nothing left');
    });

    expect(appended).toEqual(['0: bank.account.opened, bank.account.deposited']);
    expect(account.version).toBe(2);
  });

  it('keeps what it recorded when the append is refused, at the version it was loaded at', async () => {
    const account = Account.open('a1', 'Ada');

    await expect(appendChanges(account, () => Promise.reject(new Error('refused')))).rejects.toThrow('refused');

    await appendChanges(account, async ({ expected, events }) => {
      expect([expected, events.length]).toEqual([0, 1]);
    });
  });
});

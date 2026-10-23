import { describe, expect, it } from 'vitest';
import { DomainEventDispatcher } from '@ddd-ts-kit/kernel';
import { contextModule, createApplication, createTestApplication, kernelModule } from '../src';
import * as ledger from './fixtures/contexts/ledger/ledger.declarations';

const { Balances, BalancesProjection, MoneyMoved } = ledger;

const ledgerModule = () => contextModule('ledger', ledger);

describe('a projection fed by the event store', () => {
  it('is not called where the domain events are dispatched: its catch-up subscription applies them', async () => {
    const app = createTestApplication({ modules: [ledgerModule()] });

    await app.start();
    await app.get(DomainEventDispatcher).dispatch([new MoneyMoved('account-1', new Date('2026-10-10T12:00:00Z'), 500)]);

    expect(await app.get(Balances).get('account-1')).toBeUndefined();

    await app.get(BalancesProjection).moved(new MoneyMoved('account-1', new Date('2026-10-10T12:00:00Z'), 500));

    expect(await app.get(Balances).get('account-1')).toEqual({ accountId: 'account-1', cents: 500 });
  });

  it('is described with its feed, and registers no handler of domain events', () => {
    const description = createApplication({ modules: [kernelModule(), ledgerModule()] }).describe();

    expect(description.projections).toEqual([
      expect.objectContaining({ name: 'ledger.balances', feed: 'event-store' }),
    ]);

    expect(description.domainEventHandlers).toEqual([]);
  });
});

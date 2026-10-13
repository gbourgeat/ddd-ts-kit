import { defineStoredEvent, personalData, type PersonalValue, type StoredEventTypes } from '../../../src/index.js';
import { AccountOpened, MoneyDeposited, MoneyWithdrawn, type AccountEvent } from './account.js';

interface AccountOpenedData {
  readonly holder: PersonalValue;
}

interface MoneyMovedData {
  readonly amount: { readonly cents: number; readonly currency: string };
}

/** How the events of an account are stored. Deposits were stored as plain cents in version 1. */
export const accountEvents: StoredEventTypes<AccountEvent> = {
  'bank.account.opened': defineStoredEvent(AccountOpened, {
    version: 1,
    encode: (event): AccountOpenedData => ({ holder: personalData(event.aggregateId, event.holder) }),
    decode: (data, { aggregateId, occurredAt }) => new AccountOpened(aggregateId, occurredAt, data.text('holder')),
  }),
  'bank.account.deposited': defineStoredEvent(MoneyDeposited, {
    version: 2,
    encode: (event): MoneyMovedData => ({ amount: { cents: event.cents, currency: 'EUR' } }),
    decode: (data, { aggregateId, occurredAt }) =>
      new MoneyDeposited(aggregateId, occurredAt, data.record('amount').number('cents')),
    upcasters: { 1: (data) => ({ amount: { cents: data['cents'] ?? 0, currency: 'EUR' } }) },
  }),
  'bank.account.withdrawn': defineStoredEvent(MoneyWithdrawn, {
    version: 1,
    encode: (event): MoneyMovedData => ({ amount: { cents: event.cents, currency: 'EUR' } }),
    decode: (data, { aggregateId, occurredAt }) =>
      new MoneyWithdrawn(aggregateId, occurredAt, data.record('amount').number('cents')),
  }),
};

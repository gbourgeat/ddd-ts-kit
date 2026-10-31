import { describe, expect, it } from 'vitest';
import {
  ERASED_PERSONAL_DATA,
  EventSerializer,
  InMemorySubjectKeyStore,
  PersonalDataCipher,
  SequentialIdGenerator,
  StoredEventData,
  UnreadableEventError,
  defineStoredEvent,
  personalData,
  storedDataOf,
  storedStampOf,
  type DomainEvent,
  type EventToAppend,
  type StoredEvent,
} from '../src';
import { AT, AccountOpened, MoneyDeposited, type AccountEvent } from './support/bank/account';
import { accountEvents } from './support/bank/account-events';

const keys = new InMemorySubjectKeyStore();

const serializer = new EventSerializer<AccountEvent>(accountEvents, {
  cipher: new PersonalDataCipher(keys),
  ids: new SequentialIdGenerator('evt'),
});

/** A value object of the domain, read from a text: it refuses a text that is not an address. */
function domainOf(email: string): string {
  const domain = email.split('@')[1];

  if (domain === undefined) {
    throw new RangeError(`${email} has no domain`);
  }

  return domain;
}

function stored(event: EventToAppend, version = 1): StoredEvent {
  return {
    ...event,
    stream: 'bank.account-a1',
    version,
    position: version,
    metadata: event.metadata ?? { aggregateId: 'a1' },
  };
}

describe('EventSerializer', () => {
  it('stores an event in the current version of its shape, and reads it back as the same event', async () => {
    const written = await serializer.serialize(new MoneyDeposited('a1', AT, 250));
    const read = await serializer.deserialize(stored(written, 4));

    expect(written).toEqual({
      id: 'evt-1',
      type: 'bank.account.deposited',
      schemaVersion: 2,
      data: { amount: { cents: 250, currency: 'EUR' } },
      metadata: { aggregateId: 'a1' },
      occurredAt: AT,
    });

    expect(read).toEqual(new MoneyDeposited('a1', AT, 250));
    expect(storedStampOf(read)).toEqual({ eventId: 'evt-1', occurredAt: AT, version: 4 });
  });

  it('reads an event stored in an older version through its upcasters, never rewriting it', async () => {
    const old = stored({
      id: 'old',
      type: 'bank.account.deposited',
      schemaVersion: 1,
      data: { cents: 90 },
      occurredAt: AT,
    });

    expect(await serializer.deserialize(old)).toEqual(new MoneyDeposited('a1', AT, 90));
    expect(old.data).toEqual({ cents: 90 });
  });

  it('refuses to read a version without upcaster, a version from a later release, an undeclared type', async () => {
    const withdrawn = stored({ id: 'w', type: 'bank.account.withdrawn', schemaVersion: 0, data: {}, occurredAt: AT });
    const later = stored({ id: 'l', type: 'bank.account.deposited', schemaVersion: 3, data: {}, occurredAt: AT });
    const unknown = stored({ id: 'u', type: 'bank.account.closed', schemaVersion: 1, data: {}, occurredAt: AT });

    await expect(serializer.deserialize(withdrawn)).rejects.toThrow('no upcaster from version 0');
    await expect(serializer.deserialize(later)).rejects.toThrow('reads up to 2');
    await expect(serializer.deserialize(unknown)).rejects.toThrow(UnreadableEventError);
    expect(serializer.declares('bank.account.closed')).toBe(false);
  });

  it('refuses an event of another class under a declared name', async () => {
    const impostor: DomainEvent = { name: 'bank.account.deposited', aggregateId: 'a1', occurredAt: AT };

    await expect(serializer.serialize(impostor)).rejects.toThrow('declared as a MoneyDeposited');

    expect(() =>
      defineStoredEvent(MoneyDeposited, {
        version: 0,
        encode: () => ({}),
        decode: () => new MoneyDeposited('a', AT, 1),
      }),
    ).toThrow('whole number from 1');
  });
});

describe('crypto-shredding', () => {
  it('seals the personal values held in a list, at any depth, and opens them again', async () => {
    const cipher = new PersonalDataCipher(keys);
    const contacts = [personalData('a7', 'ada@example.org'), 'public', { tags: ['vip'] }];
    const sealed = await cipher.seal(storedDataOf({ contacts }));

    expect(JSON.stringify(sealed)).not.toContain('ada@example.org');
    expect(await cipher.open(sealed)).toEqual({ contacts: ['ada@example.org', 'public', { tags: ['vip'] }] });
  });

  it('stores a personal value sealed with the key of its subject and reads it back in clear', async () => {
    const written = await serializer.serialize(new AccountOpened('a7', AT, 'Ada Lovelace'));

    expect(JSON.stringify(written.data)).not.toContain('Ada');
    expect(await serializer.deserialize(stored(written))).toEqual(new AccountOpened('a7', AT, 'Ada Lovelace'));
  });

  it('reads the erased value once the subject was erased, and a later key never opens the older values', async () => {
    const before = await serializer.serialize(new AccountOpened('a8', AT, 'Grace Hopper'));

    expect(await keys.erase('a8')).toBe(true);

    const after = await serializer.serialize(new AccountOpened('a8', AT, 'Grace H.'));

    expect(await serializer.deserialize(stored(before))).toEqual(new AccountOpened('a8', AT, ERASED_PERSONAL_DATA));
    expect(await serializer.deserialize(stored(after))).toEqual(new AccountOpened('a8', AT, 'Grace H.'));
    expect(await keys.erase('nobody')).toBe(false);
  });

  it('reads a personal value as absent once its subject was erased, whatever type it is read as', async () => {
    const cipher = new PersonalDataCipher(keys);

    const sealed = await cipher.seal(
      storedDataOf({
        born: personalData('a10', AT.toISOString()),
        email: personalData('a10', 'ada@example.org'),
        name: personalData('a10', 'Ada'),
        aliases: [personalData('a10', 'Countess')],
        typed: '[erased]',
        none: null,
      }),
    );

    const before = new StoredEventData(await cipher.open(sealed), 'hr.person.born e1');

    expect([before.personalInstant('born'), before.personal('email', domainOf), before.personalText('name')]).toEqual([
      AT,
      'example.org',
      'Ada',
    ]);

    await keys.erase('a10');

    const after = new StoredEventData(await cipher.open(sealed), 'hr.person.born e1');

    expect([after.personalInstant('born'), after.personal('email', domainOf), after.personalText('name')]).toEqual([
      undefined,
      undefined,
      undefined,
    ]);

    expect([after.optionalInstant('born'), after.personalInstant('none'), after.personalText('missing')]).toEqual([
      undefined,
      undefined,
      undefined,
    ]);

    expect(after.isErased('born')).toBe(true);
    expect(before.isErased('born')).toBe(false);
    expect([after.text('name'), after.texts('aliases')]).toEqual([ERASED_PERSONAL_DATA, [ERASED_PERSONAL_DATA]]);
    expect([after.isErased('typed'), after.personalText('typed')]).toEqual([false, '[erased]']);
    expect(() => after.instant('born')).toThrow('"born" is not an instant');
    expect(() => before.personalInstant('name')).toThrow('"name" is not an instant');
    expect(() => before.personal('born', domainOf)).toThrow('no domain');
  });

  it('hands over the values of one subject by their path, its key looked up in the key store', async () => {
    const cipher = new PersonalDataCipher(keys);

    const sealed = await cipher.seal(
      storedDataOf({ note: personalData('a11', 'Asthma'), other: personalData('b11', 'Flu') }),
    );

    expect(await cipher.valuesOf('a11', sealed)).toEqual({ values: { note: 'Asthma' }, unreadable: [] });
  });

  it('refuses to store or to read personal data without a cipher', async () => {
    const bare = new EventSerializer<AccountEvent>(accountEvents);
    const sealed = await serializer.serialize(new AccountOpened('a9', AT, 'Alan'));

    await expect(bare.serialize(new AccountOpened('a9', AT, 'Alan'))).rejects.toThrow('PersonalDataCipher');
    await expect(bare.deserialize(stored(sealed))).rejects.toThrow(UnreadableEventError);
    expect(await bare.open({ plain: 'text' })).toEqual({ plain: 'text' });
  });
});

describe('stored data', () => {
  it('keeps plain data, dates as ISO text, and leaves out what is undefined', () => {
    expect(storedDataOf({ at: AT, list: [1, 'two', null, { deep: true }], skipped: undefined })).toEqual({
      at: '2026-03-01T10:00:00.000Z',
      list: [1, 'two', null, { deep: true }],
    });
  });

  it('refuses what is not plain data', () => {
    expect(() => storedDataOf({ money: new Map() })).toThrow('data.money is not plain data');
    expect(() => storedDataOf({ ratio: Number.NaN })).toThrow('data.ratio is not plain data');
    expect(() => storedDataOf([1])).toThrow('is an object');
  });

  it('reads each field as the type it asks for, and refuses another type', () => {
    const data = new StoredEventData(
      { text: 't', count: 2, done: true, at: '2026-03-01T10:00:00.000Z', tags: ['a'], items: [{ n: 1 }], none: null },
      'shop.order.placed e1',
    );

    expect([data.text('text'), data.optionalText('none'), data.number('count'), data.flag('done')]).toEqual([
      't',
      undefined,
      2,
      true,
    ]);

    expect([data.instant('at'), data.optionalInstant('missing'), data.texts('tags')]).toEqual([AT, undefined, ['a']]);
    expect(data.records('items')[0]?.number('n')).toBe(1);
    expect(() => data.text('count')).toThrow('shop.order.placed e1: "count" is not a text');
    expect(() => data.number('text')).toThrow('is not a number');
    expect(() => data.flag('text')).toThrow('is not a boolean');
    expect(() => data.instant('text')).toThrow('is not an instant');
    expect(() => data.texts('items')).toThrow('"items[0]" is not a text');
    expect(() => data.record('tags')).toThrow('is not an object');
    expect(() => data.records('text')).toThrow('is not a list');
  });
});

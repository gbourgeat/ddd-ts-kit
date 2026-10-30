import { describe, expect, it } from 'vitest';
import { ERASED_PERSONAL_DATA } from '@ddd-ts-kit/kernel';
import { InMemoryOutboxStore, erasedPayloadOf, personalEventsInOutbox, type PersonalEvent } from '../src';

const REGISTERED: PersonalEvent = {
  type: 'billing.customer.registered',
  version: 1,
  personal: { subject: 'customer.id', fields: ['customer.email'] },
};

const registered = (id: string, customerId: string) => ({
  id,
  type: REGISTERED.type,
  version: REGISTERED.version,
  occurredAt: '2026-03-01T09:59:59.000Z',
  payload: { customer: { id: customerId, email: 'ada@example.org' } },
});

describe('the outbox as a copy of a person', () => {
  it('erases the fields its declarations list in the records that name the person, and counts them', async () => {
    const store = new InMemoryOutboxStore();
    const copy = personalEventsInOutbox(store, [REGISTERED]);

    await store.append([registered('evt-1', 'cus-1'), registered('evt-2', 'cus-2')]);

    expect(copy.name).toBe('platform.outbox');
    expect(await copy.erase('cus-1')).toBe(1);
    expect(await copy.erase('cus-1')).toBe(0);

    expect(store.records().map(({ event }) => event.payload)).toEqual([
      { customer: { id: 'cus-1', email: ERASED_PERSONAL_DATA } },
      { customer: { id: 'cus-2', email: 'ada@example.org' } },
    ]);
  });
});

describe('erasedPayloadOf', () => {
  it('finds the person in a list of lines, and erases the lines together', () => {
    const declared = {
      ...REGISTERED,
      personal: { subject: 'lines[].customerId', fields: ['lines[].email'] },
    };

    const event = {
      ...registered('evt-1', 'cus-1'),
      payload: {
        lines: [
          { customerId: 'cus-1', email: 'ada@example.org' },
          { customerId: 'cus-2', email: 'g@example.org' },
        ],
      },
    };

    expect(erasedPayloadOf(event, 'cus-1', [declared])).toEqual({
      lines: [
        { customerId: 'cus-1', email: ERASED_PERSONAL_DATA },
        { customerId: 'cus-2', email: ERASED_PERSONAL_DATA },
      ],
    });
  });

  it('skips a field the payload does not hold, or holds as something else than the declaration says', () => {
    const declared = {
      ...REGISTERED,
      personal: { subject: 'customerId', fields: ['address.city', 'phones[]', 'missing'] },
    };

    const event = {
      ...registered('evt-1', 'cus-1'),
      payload: { customerId: 'cus-1', address: 'Paris', phones: '+33 1' },
    };

    expect(erasedPayloadOf(event, 'cus-1', [declared])).toEqual({
      customerId: 'cus-1',
      address: 'Paris',
      phones: ERASED_PERSONAL_DATA,
    });
  });
});

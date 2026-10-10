import { describe, expect, it } from 'vitest';
import { unwrap } from '@ddd-ts-kit/kernel';
import { given } from '@ddd-ts-kit/testing';
import { Person } from '@/contexts/identity/domain/aggregates/person.aggregate.js';
import { DisplayName } from '@/contexts/identity/domain/value-objects/display-name.vo.js';
import { Email } from '@/contexts/identity/domain/value-objects/email.vo.js';
import { aPerson } from '@/contexts/identity/test/builders/person.builder.js';

describe('Person', () => {
  it('is born with its identity', () => {
    const bornAt = new Date('2026-03-01T00:00:00.000Z');

    const born = aPerson().identifiedBy('person-7').bornAt(bornAt).build();

    expect(born.id).toBe('person-7');
    expect(born.registeredAt).toEqual(bornAt);
  });

  it('is rehydrated in its stored state without recording a new fact', () => {
    const stored = aPerson().build();

    const loaded = Person.rehydrate(stored.id, stored.toState());

    expect(loaded.toState()).toEqual(stored.toState());
    expect(loaded.pullEvents()).toEqual([]);
  });

  it('announces that the person is registered, with the name and the address to reach them', () => {
    const bornAt = new Date('2026-03-01T00:00:00.000Z');

    const born = aPerson()
      .identifiedBy('person-7')
      .named('Ada Lovelace')
      .reachedAt('ada@example.com')
      .bornAt(bornAt)
      .build();

    expect(born.pullEvents()).toEqual([
      {
        name: 'identity.person.registered',
        aggregateId: 'person-7',
        occurredAt: bornAt,
        facts: { displayName: 'Ada Lovelace', email: 'ada@example.com' },
      },
    ]);
  });

  it('takes the new name and the new address of a person who registers again, and announces nothing new', () => {
    const contact = {
      displayName: unwrap(DisplayName.create('Ada King')),
      email: unwrap(Email.create('ada.king@example.com')),
    };

    given(aPerson().named('Ada Lovelace').reachedAt('ada@example.com'))
      .when((person) => person.registerAgain(contact))
      .thenNoEvent()
      .thenState((person) => {
        expect(person.displayName.value).toBe('Ada King');
        expect(person.email.value).toBe('ada.king@example.com');
      });
  });

  it('keeps the day of the first registration when the person registers again', () => {
    const first = new Date('2026-03-01T00:00:00.000Z');

    const contact = {
      displayName: unwrap(DisplayName.create('Ada King')),
      email: unwrap(Email.create('ada.king@example.com')),
    };

    given(aPerson().bornAt(first))
      .when((person) => person.registerAgain(contact))
      .thenState((person) => expect(person.registeredAt).toEqual(first));
  });
});

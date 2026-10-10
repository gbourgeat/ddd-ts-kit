import { describe, expect, it } from 'vitest';
import { PersonRegisteredEventHandler } from '../../application/event-handlers/person-registered.event-handler.js';
import { PersonRegistered } from '../../domain/events/person-registered.event.js';
import { FakeIdentityRelationships } from '../fakes/identity-relationships.fake.js';

const at = new Date('2026-01-01T00:00:00.000Z');

describe('When person registered', () => {
  it('records that the person is themselves', async () => {
    const relationships = new FakeIdentityRelationships();
    const handler = new PersonRegisteredEventHandler(relationships);

    await handler.handle(
      new PersonRegistered('person-1', at, { displayName: 'Ada Lovelace', email: 'ada@example.com' }),
    );

    expect(relationships.current).toEqual(['person person-1']);
  });

  it('records it once when the fact is seen twice', async () => {
    const relationships = new FakeIdentityRelationships();
    const handler = new PersonRegisteredEventHandler(relationships);
    const event = new PersonRegistered('person-1', at, { displayName: 'Ada Lovelace', email: 'ada@example.com' });

    await handler.handle(event);
    await handler.handle(event);

    expect(relationships.current).toEqual(['person person-1']);
  });
});

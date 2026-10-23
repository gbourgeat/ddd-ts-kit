import { describe, expect, it } from 'vitest';
import type { PersonDirectoryGateway } from '@/contexts/scheduling/calendars/application/ports/person-directory-gateway.port';
import { InProcessPersonDirectoryGateway } from '@/contexts/scheduling/calendars/infrastructure/external/in-process-person-directory.gateway';
import { FakePersonDirectoryGateway } from '@/contexts/scheduling/test/fakes/person-directory-gateway.fake';

const KNOWN = { 'person-1': 'Ada Martin', 'person-2': 'Zoe Bernard' };

const identity = {
  byIds: async (personIds: readonly string[]) =>
    Object.entries(KNOWN).flatMap(([personId, displayName]) =>
      personIds.includes(personId) ? [{ personId, displayName }] : [],
    ),
};

const ADAPTERS: readonly (readonly [string, () => PersonDirectoryGateway])[] = [
  ['the fake', () => new FakePersonDirectoryGateway(KNOWN)],
  ['the in-process adapter', () => new InProcessPersonDirectoryGateway(identity)],
];

describe.each(ADAPTERS)('PersonDirectoryGateway, %s', (_name, create) => {
  it('is an adapter of the port', () => {
    expect(create()).toBeDefined();
  });

  it('answers the name identity shows for each person, by identifier', async () => {
    const names = await create().namesOf(['person-2', 'person-1']);

    expect(names.get('person-1')).toEqual({ displayName: 'Ada Martin' });
    expect(names.get('person-2')).toEqual({ displayName: 'Zoe Bernard' });
  });

  it('leaves out, without failing, a person identity does not know', async () => {
    const names = await create().namesOf(['person-1', 'person-unknown']);

    expect([...names.keys()]).toEqual(['person-1']);
  });

  it('answers nothing for no identifier', async () => {
    const names = await create().namesOf([]);

    expect(names.size).toBe(0);
  });
});

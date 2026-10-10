import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Criteria, scoped } from '@ddd-ts-kit/kernel';
import type { PractitionerEntry } from '@/contexts/scheduling/application/ports/practitioner-directory.port.js';
import { KnexPractitionerDirectory } from '@/contexts/scheduling/infrastructure/persistence/knex-practitioner-directory.repository.js';
import { storableStamp } from '@/shared-kernel/storable-stamp.js';
import { openTestDatabase, type TestDatabase } from '@/platform/database/open-test-database.js';

let database: TestDatabase;
let practitioners: KnexPractitionerDirectory;

beforeAll(async () => {
  database = await openTestDatabase();
});

afterAll(async () => {
  await database.close();
});

beforeEach(async () => {
  await database.reset();
  practitioners = new KnexPractitionerDirectory(database.persistence.database);
});

describe('KnexPractitionerDirectory', () => {
  it('reads back every fact of a practitioner it was given', async () => {
    await practitioners.upsertIfNewer('practice-1.ada', stamp('event-1', '08:00'), () =>
      entry('practice-1', 'ada', 'Ada Martin'),
    );

    expect(await practitioners.get('practice-1.ada')).toEqual({
      id: 'practice-1.ada',
      practiceId: 'practice-1',
      practitionerId: 'ada',
      displayName: 'Ada Martin',
      timeZone: 'Europe/Paris',
    });
  });

  it('lists the practitioners of one practice, by name', async () => {
    await practitioners.upsertIfNewer('practice-1.zoe', stamp('event-1', '08:00'), () =>
      entry('practice-1', 'zoe', 'Zoe Bernard'),
    );

    await practitioners.upsertIfNewer('practice-1.ada', stamp('event-2', '08:00'), () =>
      entry('practice-1', 'ada', 'Ada Martin'),
    );

    await practitioners.upsertIfNewer('practice-2.ada', stamp('event-3', '08:00'), () =>
      entry('practice-2', 'ada', 'Ada Martin'),
    );

    const page = await practitioners.search(
      scoped(Criteria.of<PractitionerEntry>().where('practiceId', 'eq', 'practice-1'), { kind: 'all' }, {}),
    );

    expect(page.items.map((listed) => listed.practitionerId)).toEqual(['ada', 'zoe']);
  });

  it('forgets a removed practitioner, and an older fact delivered late does not bring them back', async () => {
    await practitioners.upsertIfNewer('practice-1.ada', stamp('event-1', '08:00'), () =>
      entry('practice-1', 'ada', 'Ada Martin'),
    );

    await practitioners.delete('practice-1.ada', stamp('event-3', '10:00'));

    const late = await practitioners.upsertIfNewer('practice-1.ada', stamp('event-2', '09:00'), () =>
      entry('practice-1', 'ada', 'Ada Martin'),
    );

    expect(late).toBe('stale');
    expect(await practitioners.get('practice-1.ada')).toBeUndefined();
  });

  // The stamps of real facts carry milliseconds, which the SQL store reads back to the second: the projections stamp with `storableStamp`.
  it('follows the facts of a practitioner milliseconds apart, as the projection stamps them', async () => {
    const writes = [
      await practitioners.upsertIfNewer('practice-1.ada', storableStamp(precise('event-1', 123)), () =>
        entry('practice-1', 'ada', 'Ada Martin'),
      ),
      await practitioners.upsertIfNewer('practice-1.ada', storableStamp(precise('event-2', 456)), () =>
        entry('practice-1', 'ada', 'Ada Lovelace'),
      ),
      await practitioners.delete('practice-1.ada', storableStamp(precise('event-3', 789))),
      await practitioners.upsertIfNewer('practice-1.ada', storableStamp(precise('event-2', 456)), () =>
        entry('practice-1', 'ada', 'Ada Lovelace'),
      ),
    ];

    expect(writes).toEqual(['applied', 'applied', 'applied', 'stale']);
    expect(await practitioners.get('practice-1.ada')).toBeUndefined();
  });
});

function precise(eventId: string, millisecond: number) {
  return { eventId, occurredAt: new Date(Date.UTC(2026, 2, 2, 8, 0, 0, millisecond)) };
}

function entry(practiceId: string, practitionerId: string, displayName: string): PractitionerEntry {
  return { id: `${practiceId}.${practitionerId}`, practiceId, practitionerId, displayName, timeZone: 'Europe/Paris' };
}

function stamp(eventId: string, time: string) {
  return { eventId, occurredAt: new Date(`2026-03-02T${time}:00.000Z`) };
}

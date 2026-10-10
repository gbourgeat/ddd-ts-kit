import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Criteria, scoped } from '@ddd-ts-kit/kernel';
import { storableStamp } from '../../../../shared-kernel/storable-stamp.js';
import { openTestDatabase, type TestDatabase } from '../../../../platform/database/open-test-database.js';
import type { Outcome, OutcomeRegister } from '../../application/ports/outcome-register.port.js';
import { ANALYTICS_SCHEMA } from '../../infrastructure/persistence/analytics.schema.js';
import { createAnalyticsTables } from '../../infrastructure/persistence/create-analytics-tables.schema.js';
import { KnexOutcomeRegister } from '../../infrastructure/persistence/knex-outcome-register.repository.js';
import { anOutcome } from '../builders/outcome.builder.js';
import { FakeOutcomeRegister } from '../fakes/outcome-register.fake.js';

let database: TestDatabase;

beforeAll(async () => {
  database = await openTestDatabase();

  const knex = database.persistence.database.executor();

  if (!(await knex.schema.withSchema(ANALYTICS_SCHEMA).hasTable('outcomes'))) await createAnalyticsTables(knex);
});

afterAll(async () => {
  await database.close();
});

const ADAPTERS: readonly (readonly [string, () => Promise<OutcomeRegister>])[] = [
  ['the fake', async () => new FakeOutcomeRegister()],
  [
    'the knex adapter',
    async () => {
      await database.reset();

      return new KnexOutcomeRegister(database.persistence.database);
    },
  ],
];

describe.each(ADAPTERS)('OutcomeRegister, %s', (_name, create) => {
  it('answers an outcome as it was written, every field of it', async () => {
    const outcomes = await create();
    const outcome = anOutcome({ state: 'cancelled-by-practice', changedAt: new Date('2026-10-01T10:00:00.123Z') });

    await outcomes.upsertIfNewer(outcome.id, at(0), () => outcome);

    expect(await outcomes.get(outcome.id)).toEqual(outcome);
  });

  it('answers nothing for an appointment it never heard of', async () => {
    const outcomes = await create();

    expect(await outcomes.get('appointment-unknown')).toBeUndefined();
  });

  it('keeps the latest fact when an earlier one is written after it', async () => {
    const outcomes = await create();

    await outcomes.upsertIfNewer('appointment-1', at(30), () => anOutcome({ state: 'completed' }));

    const write = await outcomes.upsertIfNewer('appointment-1', at(0), () => anOutcome({ state: 'held' }));

    expect(write).toBe('stale');
    expect(await outcomes.get('appointment-1')).toMatchObject({ state: 'completed' });
  });

  it('lists the outcomes of one calendar on one day', async () => {
    const outcomes = await create();
    const written = [anOutcome({ id: 'appointment-2' }), anOutcome({ id: 'appointment-1' }), anOutcome({ id: 'appointment-3', day: '2026-10-13' }), anOutcome({ id: 'appointment-4', calendarId: 'calendar-2' })];

    for (const outcome of written) await outcomes.upsertIfNewer(outcome.id, at(0), () => outcome);

    const page = await outcomes.list(scoped(Criteria.of<Outcome>().where('calendarId', 'eq', 'calendar-1').where('day', 'eq', '2026-10-12'), { kind: 'all' }));

    expect(page.items.map((outcome) => outcome.id)).toEqual(['appointment-1', 'appointment-2']);
  });

  it('lists the outcomes of a range of days, both ends included', async () => {
    const outcomes = await create();
    const written = ['2026-10-11', '2026-10-12', '2026-10-19', '2026-10-20'].map((day) => anOutcome({ id: `appointment-of-${day}`, day }));

    for (const outcome of written) await outcomes.upsertIfNewer(outcome.id, at(0), () => outcome);

    const page = await outcomes.list(scoped(Criteria.of<Outcome>().where('day', 'between', ['2026-10-12', '2026-10-19']), { kind: 'all' }));

    expect(page.items.map((outcome) => outcome.day)).toEqual(['2026-10-12', '2026-10-19']);
  });

  // The stamps of real facts carry milliseconds, which the SQL store reads back to the second: the projections stamp with `storableStamp`.
  it('follows the facts of an appointment milliseconds apart, as the projection stamps them', async () => {
    const outcomes = await create();

    const writes = [
      await outcomes.upsertIfNewer('appointment-1', storableStamp(precise('fact-1', 123)), () => anOutcome({ state: 'held' })),
      await outcomes.upsertIfNewer('appointment-1', storableStamp(precise('fact-2', 456)), () => anOutcome({ state: 'completed' })),
      await outcomes.upsertIfNewer('appointment-1', storableStamp(precise('fact-1', 123)), () => anOutcome({ state: 'held' })),
    ];

    expect(writes).toEqual(['applied', 'applied', 'stale']);
    expect(await outcomes.get('appointment-1')).toMatchObject({ state: 'completed' });
  });
});

function at(minute: number) {
  return { eventId: `fact-${minute}`, occurredAt: new Date(Date.UTC(2026, 9, 1, 10, minute)) };
}

function precise(eventId: string, millisecond: number) {
  return { eventId, occurredAt: new Date(Date.UTC(2026, 9, 1, 10, 0, 0, millisecond)) };
}
